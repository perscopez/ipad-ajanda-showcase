import { useEffect, useState } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { kvGet, kvSet } from "./db"
import { ensureFonts, getFonts, importFont } from "./fonts"
import { ensurePacks, getPacks, importPack, loadPack } from "./packs"

/**
 * Sticker paketleri ve yüklenen fontlar büyük olduğu için ana veriden ayrı tutulur, ama kaybolmasınlar diye
 * `user_assets` tablosuyla buluta yedeklenir ve diğer cihazlara iner. Tablo yoksa sessizce atlanır.
 */
const toB64 = (buf: ArrayBuffer) => {
  const u = new Uint8Array(buf)
  let s = ""
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}
const fromB64 = (b: string) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0)).buffer

export async function exportAssets() {
  await Promise.all([ensurePacks(), ensureFonts()])
  return {
    packs: await Promise.all(getPacks().map(async pack => ({ pack, stickers: await loadPack(pack.id) }))),
    fonts: await Promise.all(getFonts().map(async font => {
      const buffer = await kvGet<ArrayBuffer>("font:" + font.id)
      if (!buffer) throw new Error("Missing font file")
      return { font, b64: toB64(buffer) }
    })),
  }
}

export async function restoreAssets(assets: Awaited<ReturnType<typeof exportAssets>>) {
  if (!Array.isArray(assets.packs) || !Array.isArray(assets.fonts)) throw new Error("Invalid asset list")
  for (const { pack, stickers } of assets.packs) {
    if (!pack?.id || !Array.isArray(stickers) || !stickers.every(s => typeof s.src === "string" && s.w > 0 && s.h > 0)) throw new Error("Invalid sticker pack")
  }
  const fonts = assets.fonts.map(({font, b64}) => {
    if (!font?.id || typeof b64 !== "string") throw new Error("Invalid font")
    return {font, buffer: fromB64(b64)}
  })
  for (const {font, buffer} of fonts) await importFont(font, buffer)
  for (const {pack, stickers} of assets.packs) await importPack(pack, stickers)
  const restored = new Set([...assets.packs.map(p => "pack:" + p.pack.id), ...fonts.map(f => "font:" + f.font.id)])
  const removed = await kvGet<string[]>("assetDeleted") ?? []
  await kvSet("assetDeleted", removed.filter(id => !restored.has(id)))
  window.dispatchEvent(new Event("assets-changed"))
}

let running = false
let pendingUser: string | null = null

export type AssetBackup = "none" | "ok" | "missing" | "error"
let status: AssetBackup = "none"
const subs = new Set<() => void>()
const setStatus = (s: AssetBackup) => {
  status = s
  subs.forEach((f) => f())
}
/** Paket/font yedeğinin durumu: "ok" = buluta yedekli, "missing" = Supabase tablosu kurulmamış, "none" = henüz yedeklenmedi (giriş yok). */
export function useAssetBackup(): AssetBackup {
  const [s, setS] = useState(status)
  useEffect(() => {
    const f = () => setS(status)
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  }, [])
  return s
}

export async function syncAssets(client: SupabaseClient, userId: string): Promise<void> {
  if (running) {
    pendingUser = userId
    return
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) return
  running = true
  try {
    await Promise.all([ensurePacks(), ensureFonts()])
    const { data: rows, error } = await client.from("user_assets").select("key").eq("user_id", userId)
    if (error) {
      if (/relation|does not exist|schema cache|42P01|PGRST205/i.test(error.message)) {
        setStatus("missing")
      } else setStatus("error")
      return
    }
    const cloud = new Set((rows ?? []).map((r) => r.key as string))
    // Silinenler (iki yönlü): yerelde silinenler buluttan da gider, bulutta silinenler yerelden de
    const delRow = cloud.has("deleted") ? await client.from("user_assets").select("value").eq("user_id", userId).eq("key", "deleted").maybeSingle() : null
    if (delRow?.error) throw delRow.error
    const cloudDel = new Set<string>(((delRow?.data?.value as { ids?: string[] } | undefined)?.ids) ?? [])
    const localDel = (await kvGet<string[]>("assetDeleted")) ?? []
    const allDel = new Set([...cloudDel, ...localDel])
    if (allDel.size !== cloudDel.size) await client.from("user_assets").upsert({ user_id: userId, key: "deleted", value: { ids: [...allDel] }, updated_at: new Date().toISOString() }, { onConflict: "user_id,key" }).throwOnError()
    for (const k of localDel) if (cloud.has(k)) await client.from("user_assets").delete().eq("user_id", userId).eq("key", k).throwOnError()
    await kvSet("assetDeleted", [...allDel])

    // Yükle: buluta yedekle
    for (const p of getPacks()) {
      const key = `pack:${p.id}`
      if (allDel.has(key) || cloud.has(key)) continue
      await client.from("user_assets").upsert({ user_id: userId, key, value: { pack: p, stickers: await loadPack(p.id) }, updated_at: new Date().toISOString() }, { onConflict: "user_id,key" }).throwOnError()
    }
    for (const f of getFonts()) {
      const key = `font:${f.id}`
      if (allDel.has(key) || cloud.has(key)) continue
      const buf = await kvGet<ArrayBuffer>(`font:${f.id}`)
      if (!buf) throw new Error("Missing font")
      await client.from("user_assets").upsert({ user_id: userId, key, value: { font: f, b64: toB64(buf) }, updated_at: new Date().toISOString() }, { onConflict: "user_id,key" }).throwOnError()
    }
    // İndir: bu cihazda olmayanları getir
    for (const key of cloud) {
      if (key === "deleted" || allDel.has(key)) continue
      if (key.startsWith("pack:") && getPacks().some((p) => `pack:${p.id}` === key)) continue
      if (key.startsWith("font:") && getFonts().some((f) => `font:${f.id}` === key)) continue
      const { data } = await client.from("user_assets").select("value").eq("user_id", userId).eq("key", key).maybeSingle().throwOnError()
      const v = data?.value as { pack?: Parameters<typeof importPack>[0]; stickers?: Parameters<typeof importPack>[1]; font?: Parameters<typeof importFont>[0]; b64?: string } | undefined
      if (!v) throw new Error("Missing asset")
      if (key.startsWith("pack:") && v.pack && v.stickers) await importPack(v.pack, v.stickers)
      else if (v.font && v.b64) await importFont(v.font, fromB64(v.b64))
    }
    setStatus("ok")
  } catch {
    setStatus("error")
  } finally {
    running = false
    if (pendingUser) {
      const next = pendingUser
      pendingUser = null
      void syncAssets(client, next)
    }
  }
}
