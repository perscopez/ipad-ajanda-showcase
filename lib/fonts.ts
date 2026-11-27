"use client"

import { useEffect, useState } from "react"
import { kvDel, kvGet, kvKeys, kvSet } from "./db"
import { uid } from "./types"

/** Kullanıcının yüklediği fontlar bu cihazda (IndexedDB) saklanır; hiçbir yere gönderilmez. */
export type CustomFont = { id: string; name: string }

const META_KEY = "fonts"
const family = (id: string) => `cf-${id}`
export const isCustomFont = (f?: string): f is string => !!f && f.startsWith("cf-")

let cache: CustomFont[] = []
let loadPromise: Promise<void> | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

async function register(font: CustomFont, buffer: ArrayBuffer) {
  const face = new FontFace(family(font.id), buffer)
  await face.load()
  document.fonts.add(face)
}

/** Kayıtlı fontları yükler (bir kez). Çizimden önce beklenir ki küçük resimlerde doğru görünsün. */
export function ensureFonts(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const meta = (await kvGet<CustomFont[]>(META_KEY)) ?? []
        try {
          const known = new Set(meta.map((f) => f.id))
          for (const k of (await kvKeys()).filter((k) => k.startsWith("font:"))) if (!known.has(k.slice(5))) meta.push({ id: k.slice(5), name: "Recovered font" })
        } catch {}
        const ok: CustomFont[] = []
        for (const f of meta) {
          try {
            const buf = await kvGet<ArrayBuffer>(`font:${f.id}`)
            if (buf) {
              await register(f, buf)
              ok.push(f)
            }
          } catch {}
        }
        cache = ok
        notify()
      } catch {}
    })()
  }
  return loadPromise
}

export function resolveCustomFamily(f: string) {
  return `"${f}", system-ui, sans-serif`
}

const FONT_RE = /\.(ttf|otf|woff2?)$/i

async function addOne(name: string, buffer: ArrayBuffer): Promise<CustomFont> {
  if (buffer.byteLength > 8 * 1024 * 1024) throw new Error(`“${name}” is too large (8 MB max).`)
  const font: CustomFont = { id: uid(), name: name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Font" }
  await register(font, buffer) // geçersiz dosyada burada hata verir
  await kvSet(`font:${font.id}`, buffer)
  cache = [...cache, font]
  await kvSet(META_KEY, cache)
  return font
}

/** TTF, OTF, WOFF, WOFF2 ya da bunları içeren bir ZIP yükler. ZIP içindeki tüm fontlar eklenir. */
export async function addFontFile(file: File): Promise<CustomFont[]> {
  await ensureFonts()
  const added: CustomFont[] = []
  if (/\.zip$/i.test(file.name)) {
    if (file.size > 60 * 1024 * 1024) throw new Error("ZIP file is too large (60 MB max).")
    const { default: JSZip } = await import("jszip")
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    const entries = Object.values(zip.files).filter((e) => !e.dir && FONT_RE.test(e.name) && !e.name.includes("__MACOSX") && !e.name.split("/").pop()!.startsWith("._"))
    if (!entries.length) throw new Error("No fonts (TTF, OTF, WOFF) found in the ZIP.")
    for (const e of entries.slice(0, 40)) {
      try {
        added.push(await addOne(e.name.split("/").pop()!, await e.async("arraybuffer")))
      } catch {}
    }
    if (!added.length) throw new Error("Could not read the fonts in the ZIP.")
  } else {
    if (!FONT_RE.test(file.name)) throw new Error("Supported types: TTF, OTF, WOFF, WOFF2 or a ZIP containing them")
    added.push(await addOne(file.name, await file.arrayBuffer()))
  }
  notify()
  window.dispatchEvent(new Event("assets-changed"))
  return added
}

export const getFonts = () => cache

/** Buluttan gelen fontu aynı kimlikle ekle (varsa atla). */
export async function importFont(font: CustomFont, buffer: ArrayBuffer) {
  await ensureFonts()
  if (cache.some((f) => f.id === font.id)) return
  await register(font, buffer)
  await kvSet(`font:${font.id}`, buffer)
  cache = [...cache, font]
  await kvSet(META_KEY, cache)
  notify()
}

export async function removeFont(id: string) {
  await kvSet("assetDeleted", Array.from(new Set([...(((await kvGet<string[]>("assetDeleted")) ?? [])), `font:${id}`])))
  cache = cache.filter((f) => f.id !== id)
  await kvSet(META_KEY, cache)
  await kvDel(`font:${id}`)
  notify()
  window.dispatchEvent(new Event("assets-changed"))
}

export function useCustomFonts(): CustomFont[] {
  const [list, setList] = useState<CustomFont[]>(cache)
  useEffect(() => {
    const on = () => setList(cache)
    listeners.add(on)
    void ensureFonts().then(on)
    return () => {
      listeners.delete(on)
    }
  }, [])
  return list
}

export { family as fontFamilyId }
