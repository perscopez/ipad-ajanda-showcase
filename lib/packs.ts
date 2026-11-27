"use client"

import { useEffect, useState } from "react"
import { kvDel, kvGet, kvKeys, kvSet } from "./db"
import { uid } from "./types"
import type { SlicedSticker } from "./slice"

/** Sticker paketleri (ör. kesik harfler): büyük oldukları için bu cihazda saklanır. */
export type StickerPack = { id: string; name: string; count: number }

const META = "packs"
let cache: StickerPack[] = []
let loaded: Promise<void> | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

export function ensurePacks(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (!loaded) {
    loaded = kvGet<StickerPack[]>(META)
      .then(async (m) => {
        cache = m ?? []
        // Liste kaybolmuş ama paket verisi cihazda duruyorsa geri bağla
        try {
          const known = new Set(cache.map((p) => p.id))
          for (const k of (await kvKeys()).filter((k) => k.startsWith("pack:"))) {
            const id = k.slice(5)
            if (known.has(id)) continue
            const st = await kvGet<SlicedSticker[]>(k)
            if (st?.length) cache = [...cache, { id, name: "Recovered pack", count: st.length }]
          }
          if (cache.length !== (m ?? []).length) await kvSet(META, cache)
        } catch {}
        notify()
      })
      .catch(() => {})
  }
  return loaded
}

export async function addPack(name: string, stickers: SlicedSticker[]): Promise<StickerPack> {
  await ensurePacks()
  const pack: StickerPack = { id: uid(), name, count: stickers.length }
  await kvSet(`pack:${pack.id}`, stickers)
  cache = [...cache, pack]
  await kvSet(META, cache)
  notify()
  window.dispatchEvent(new Event("assets-changed"))
  return pack
}

export async function loadPack(id: string): Promise<SlicedSticker[]> {
  return (await kvGet<SlicedSticker[]>(`pack:${id}`)) ?? []
}

export const getPacks = () => cache

/** Buluttan gelen paketi aynı kimlikle ekle (varsa atla). */
export async function importPack(pack: StickerPack, stickers: SlicedSticker[]) {
  await ensurePacks()
  if (cache.some((p) => p.id === pack.id)) return
  await kvSet(`pack:${pack.id}`, stickers)
  cache = [...cache, pack]
  await kvSet(META, cache)
  notify()
}

export async function removePack(id: string) {
  await kvSet("assetDeleted", Array.from(new Set([...(((await kvGet<string[]>("assetDeleted")) ?? [])), `pack:${id}`])))
  cache = cache.filter((p) => p.id !== id)
  await kvSet(META, cache)
  await kvDel(`pack:${id}`)
  notify()
  window.dispatchEvent(new Event("assets-changed"))
}

export function usePacks(): StickerPack[] {
  const [list, setList] = useState<StickerPack[]>(cache)
  useEffect(() => {
    const on = () => setList(cache)
    listeners.add(on)
    void ensurePacks().then(on)
    return () => {
      listeners.delete(on)
    }
  }, [])
  return list
}
