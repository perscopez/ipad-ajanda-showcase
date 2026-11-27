"use client"

import { dataStats, logSync, saveBackup, saveCloudHistory } from "./backup"
import { mergePage, stampPage } from "./pageSync"
import { exportAssets, restoreAssets, syncAssets } from "./assetSync"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js"
import { kvGet, kvSet } from "./db"
import { consumeAuthTransferFromHash, getSupabaseClient } from "./supabase"
import {
  newPage,
  uid,
  type CustomSticker,
  type CustomTemplate,
  type Folder,
  type Notebook,
  type Orient,
  type Page,
  type Template,
} from "./types"

export type SaveState = "saved" | "saving" | "error"

export type SyncStatus = "unconfigured" | "signed_out" | "syncing" | "synced" | "offline" | "error"

export type Data = {
  folders: Folder[]
  notebooks: Notebook[]
  customStickers?: CustomSticker[]
  customTemplates?: CustomTemplate[]
  deleted?: Record<string, number> // silinen öğelerin mezar taşları (id → zaman)
  ownerId?: string | null // bu verinin ait olduğu hesap (başka hesabın verisiyle karışmasın)
  updatedAt?: number
  isSeed?: boolean
}

export const COVER_COLORS = ["#e8b4b8", "#f2c9a0", "#f4e2a1", "#b9d8b0", "#a9d3d8", "#aab8e6", "#cdb4e6", "#4a5070", "#2f3a35", "#8a5a44"]

export function presetPages(preset: "ajanda" | "bos", o: Orient): Template[] {
  if (preset === "bos") return ["dots", "dots"]
  return o === "landscape"
    ? ["ivory_week", "ivory_freestyle", "week_grid", "pastel_week", "daily", "tracker", "monthplan", "dots"]
    : ["year", "month", "ivory_week", "pastel_week", "daily", "grid", "dots"]
}

function defaultTabs() {
  return [
    { id: "project", label: "PROJECT", emoji: "☁️", color: "#cfe5ff", pageIndex: 0 },
    { id: "tracker", label: "TRACKER", emoji: "🍀", color: "#d6efcd", pageIndex: 4 },
    { id: "expense", label: "EXPENSE", emoji: "📒", color: "#f9e3bc", pageIndex: 5 },
    { id: "reflect", label: "REFLECT", emoji: "🩷", color: "#f8d4de", pageIndex: 2 },
    { id: "journal", label: "JOURNAL", emoji: "📖", color: "#e8dfd1", pageIndex: 1 },
  ]
}

function defaultFolders(): Folder[] {
  return [
    { id: "folder-notes", name: "Planner & Notes", color: "#f4b6c2", emoji: "📚" },
    { id: "folder-archive", name: "Archives", color: "#a9d6e5", emoji: "🗂️" },
    { id: "folder-design", name: "Designs", color: "#cbb7ea", emoji: "🎨" },
  ]
}

function seed(): Data {
  const nb: Notebook = {
    id: uid(),
    folderId: null,
    title: "My Planner",
    cover: {
      ...newPage("blank", "#e8b4b8", "landscape"),
      items: [{ id: uid(), kind: "emoji", text: "📖", x: 450, y: 270, w: 280, h: 280, rot: -6 }],
    },
    pages: presetPages("ajanda", "landscape").map((t) => newPage(t, undefined, "landscape")),
    tabs: defaultTabs(),
  }
  return { folders: defaultFolders(), notebooks: [nb], customStickers: [], customTemplates: [], updatedAt: 0, isSeed: true }
}

function normalizePage(p: Partial<Page> | undefined, fallbackBg?: string): Page {
  const base = newPage(p?.template ?? "blank", p?.bg ?? fallbackBg, p?.orient ?? "landscape")
  return {
    ...base,
    ...p,
    template: p?.template ?? base.template,
    strokes: Array.isArray(p?.strokes) ? p.strokes : [],
    items: Array.isArray(p?.items) ? p.items : [],
  }
}

/** Saati ileri olan bir cihazın damgaları sonraki düzenlemeleri sonsuza dek ezmesin: yeni düzenlemeler her zaman görülen en yeni damganın üstünde damgalanır (aşağıdaki clockFloor). Saçma değerler (>30 gün ileri) kırpılır. */
const FUTURE_SLACK = 30 * 24 * 3600 * 1000
const clampT = (t: number | undefined, limit: number) => (typeof t === "number" && t > limit ? limit : t)
function clampStamps<T extends { updatedAt?: number }>(x: T, limit: number): T {
  return typeof x?.updatedAt === "number" && x.updatedAt > limit ? { ...x, updatedAt: limit } : x
}
/** Görülen en yeni damga: yeni düzenlemeler her zaman bunun üstünde damgalanır (saat farkı olsa bile yeni yazı eskiyi ezer). */
let clockFloor = 0

function normalizeData(raw: Partial<Data> | null | undefined): Data {
  if (!raw || !Array.isArray(raw.notebooks)) return seed()
  const limit = Date.now() + FUTURE_SLACK
  const deleted: Record<string, number> = {}
  if (raw.deleted && typeof raw.deleted === "object") for (const [k, v] of Object.entries(raw.deleted)) deleted[k] = clampT(v, limit) ?? v
  const out: Data = {
    folders: Array.isArray(raw.folders) ? raw.folders.map((f) => clampStamps(f, limit)) : [],
    notebooks: raw.notebooks.map((nb) =>
      clampStamps(
        {
          ...nb,
          cover: clampStamps(normalizePage(nb.cover, "#e8b4b8"), limit),
          pages: Array.isArray(nb.pages) ? nb.pages.map((p) => clampStamps(normalizePage(p), limit)) : [],
        },
        limit,
      ),
    ),
    customStickers: Array.isArray(raw.customStickers) ? raw.customStickers.map((x) => clampStamps(x, limit)) : [],
    customTemplates: Array.isArray(raw.customTemplates) ? raw.customTemplates.map((x) => clampStamps(x, limit)) : [],
    updatedAt: typeof raw.updatedAt === "number" ? Math.min(raw.updatedAt, limit) : Date.now(),
    deleted,
    ownerId: typeof raw.ownerId === "string" ? raw.ownerId : null,
    isSeed: Boolean(raw.isSeed),
  }
  // Bu cihazın saatinden bağımsız: görülen en yeni damgayı kaydet
  let mx = out.updatedAt ?? 0
  for (const t of Object.values(deleted)) mx = Math.max(mx, t)
  for (const l of [out.folders, out.customStickers, out.customTemplates] as { updatedAt?: number }[][]) for (const x of l) mx = Math.max(mx, x.updatedAt ?? 0)
  for (const n of out.notebooks) {
    mx = Math.max(mx, n.updatedAt ?? 0, n.cover.updatedAt ?? 0)
    for (const p of n.pages) mx = Math.max(mx, p.updatedAt ?? 0)
  }
  clockFloor = Math.max(clockFloor, mx)
  return out
}

const TOMBSTONE_TTL = 90 * 24 * 3600 * 1000

type Stamped = { id: string; updatedAt?: number }

/** Değişen öğelere zaman damgası vurur, kaybolan öğeler için mezar taşı yazar. */
function stamp<T extends Stamped>(prev: T[] | undefined, next: T[] | undefined, now: number, del: Record<string, number>): T[] {
  const pm = new Map((prev ?? []).map((x) => [x.id, x]))
  const out = (next ?? []).map((x) => (pm.get(x.id) === x ? x : { ...x, updatedAt: now }))
  const ids = new Set(out.map((x) => x.id))
  for (const x of pm.values()) if (!ids.has(x.id)) del[x.id] = now
  return out
}

/** Defterlerde sayfa bazında damga: değişen sayfalar damgalanır, silinen sayfalar için mezar taşı yazılır. */
function stampPages(prev: Notebook[] | undefined, next: Notebook[], now: number, del: Record<string, number>): Notebook[] {
  const pm = new Map((prev ?? []).map((n) => [n.id, n]))
  return next.map((n) => {
    const old = pm.get(n.id)
    if (old === n) return n
    const op = new Map(old?.pages.map((p) => [p.id, p]))
    const pages = n.pages.map((p) => stampPage(op.get(p.id), p, now))
    const ids = new Set(pages.map((p) => p.id))
    for (const p of old?.pages ?? []) if (!ids.has(p.id)) del[p.id] = now
    const cover = stampPage(old?.cover, n.cover, now)
    return { ...n, pages, cover }
  })
}

/** Aynı defterin iki sürümünü sayfa bazında birleştirir: farklı sayfalarda yapılan değişiklikler birbirini ezmez. */
function mergeNotebook(a: Notebook, b: Notebook, preferB: boolean, del: Record<string, number>): Notebook {
  const ta = a.updatedAt ?? 0, tb = b.updatedAt ?? 0
  const bWins = tb > ta || (tb === ta && preferB)
  const win = bWins ? b : a
  const lose = bWins ? a : b
  const lp = new Map(lose.pages.map((p) => [p.id, p]))
  const wp = new Map(win.pages.map((p) => [p.id, p]))
  const pick = mergePage
  const pages = win.pages.map((p) => pick(p, lp.get(p.id))).filter((p) => !(p.id in del) || del[p.id] < (p.updatedAt ?? 0))
  // Sadece diğer tarafta olan sayfalar: yeni eklenmişse (damgalı ve silinmemişse) korunur
  for (const p of lose.pages) if (!wp.has(p.id) && p.updatedAt && (!(p.id in del) || del[p.id] < p.updatedAt)) pages.push(p)
  const cover = mergePage(win.cover, lose.cover)
  return { ...win, pages, cover }
}

/** Öğe bazında birleştirme: aynı id'de daha yeni olan kazanır, silinenler geri gelmez. */
function mergeById<T extends Stamped>(a: T[], b: T[], preferB: boolean, del: Record<string, number>, combine?: (x: T, y: T) => T): T[] {
  const map = new Map<string, T>()
  for (const x of [...a, ...b]) {
    const cur = map.get(x.id)
    if (!cur) {
      map.set(x.id, x)
      continue
    }
    if (combine) {
      map.set(x.id, combine(cur, x))
      continue
    }
    const ta = cur.updatedAt ?? 0, tb = x.updatedAt ?? 0
    if (tb > ta || (tb === ta && preferB)) map.set(x.id, x)
  }
  return Array.from(map.values()).filter((x) => !(x.id in del) || del[x.id] < (x.updatedAt ?? 0))
}

/** Her birleştirmenin kaydını tutar; sonuç, iki taraftan birinden daha az çizgi/sayfa/nesne içeriyorsa o taraf HEMEN (sınırsız) yedeğe alınır. */
async function guardMerge(source: string, local: Data, remote: Data, merged: Data) {
  try {
    const a = dataStats(local), b = dataStats(remote), m = dataStats(merged)
    const lost = m.strokes < Math.max(a.strokes, b.strokes) || m.pages < Math.max(a.pages, b.pages) || m.items < Math.max(a.items, b.items) || m.nb < Math.max(a.nb, b.nb)
    void logSync({ ts: Date.now(), source, local: a, remote: b, merged: m, shrink: lost })
    if (lost) {
      await saveBackup(local, `shrink-guard-${source}-local`)
      await saveBackup(remote, `shrink-guard-${source}-cloud`)
    }
  } catch {}
}

export function mergeData(local: Data, remote: Data): Data {
  if (local.isSeed && !remote.isSeed) return normalizeData(remote)
  if (remote.isSeed && !local.isSeed) return normalizeData(local)
  const preferRemote = (remote.updatedAt ?? 0) >= (local.updatedAt ?? 0)
  const now = Date.now()
  const del: Record<string, number> = {}
  for (const src of [local.deleted ?? {}, remote.deleted ?? {}]) for (const [id, t] of Object.entries(src)) if (now - t < TOMBSTONE_TTL) del[id] = Math.max(del[id] ?? 0, t)
  return {
    folders: mergeById(local.folders, remote.folders, preferRemote, del),
    notebooks: mergeById(local.notebooks, remote.notebooks, preferRemote, del, (x, y) => mergeNotebook(x, y, preferRemote, del)),
    customStickers: mergeById(local.customStickers ?? [], remote.customStickers ?? [], preferRemote, del),
    customTemplates: mergeById(local.customTemplates ?? [], remote.customTemplates ?? [], preferRemote, del),
    deleted: del,
    ownerId: local.ownerId ?? remote.ownerId ?? null,
    updatedAt: Math.max(local.updatedAt ?? 0, remote.updatedAt ?? 0, now),
    isSeed: false,
  }
}

type Store = {
  loaded: boolean
  folders: Folder[]
  notebooks: Notebook[]
  customStickers: CustomSticker[]
  customTemplates: CustomTemplate[]
  saveState: SaveState
  syncStatus: SyncStatus
  syncError: string | null
  userEmail: string | null
  userId: string | null
  lastSyncedAt: number | null
  syncNow: () => Promise<void>
  refreshAuthClient: () => Promise<void>
  signOut: () => Promise<void>
  exportBackupJson: () => Promise<string>
  importBackupJson: (json: string) => Promise<boolean>
  restoreData: (d: Data) => Promise<void>
  reloadFromCloud: () => Promise<{ ok: boolean; message: string }>
  addFolder: (f: Omit<Folder, "id">) => string
  updateFolder: (id: string, patch: Partial<Folder>) => void
  deleteFolder: (id: string) => void
  addNotebook: (title: string, folderId: string | null, preset: "ajanda" | "bos", color: string, orient: Orient) => string
  updateNotebook: (id: string, patch: Partial<Omit<Notebook, "id">>) => void
  deleteNotebook: (id: string) => void
  setPage: (nbId: string, which: "cover" | string, page: Page) => void
  addPages: (nbId: string, at: number, templates: Template[]) => void
  addCustomPage: (nbId: string, at: number, page: Page) => void
  deletePages: (nbId: string, from: number, count: number) => void
  movePage: (nbId: string, from: number, to: number) => void
  duplicatePage: (nbId: string, at: number) => void
  /** Toplu işlemler */
  deletePagesByIds: (nbId: string, ids: string[]) => void
  duplicatePagesByIds: (nbId: string, ids: string[]) => void
  deleteNotebooks: (ids: string[]) => void
  moveNotebooks: (ids: string[], folderId: string | null) => void
  deleteFolders: (ids: string[]) => void
  addCustomSticker: (s: Omit<CustomSticker, "id">) => void
  deleteCustomSticker: (id: string) => void
  addCustomTemplate: (t: Omit<CustomTemplate, "id">) => void
  deleteCustomTemplate: (id: string) => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>({ folders: [], notebooks: [], customStickers: [], customTemplates: [] })
  const [loaded, setLoaded] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>("saved")
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("unconfigured")
  const [syncError, setSyncError] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [clientGen, setClientGen] = useState(0)

  const ref = useRef(data)
  const loadedRef = useRef(loaded)
  const userIdRef = useRef<string | null>(null)
  const localDirtyRef = useRef(false)
  const lastPushedAtRef = useRef(0)

  useEffect(() => {
    ref.current = data
  }, [data])

  useEffect(() => {
    loadedRef.current = loaded
  }, [loaded])

  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  // Değişiklik hemen `ref`e yazılır (arka plana geçerken bile güncel kalır), sonra React durumu ve disk güncellenir.
  const mutate = useCallback((updater: (prev: Data) => Data) => {
    localDirtyRef.current = true
    setSaveState("saving")
    const prev = ref.current
    const next0 = updater(prev)
    const now = Math.max(Date.now(), clockFloor + 1)
    clockFloor = now
    const deleted = { ...(next0.deleted ?? prev.deleted ?? {}) }
    const next: Data = {
      ...next0,
      folders: stamp(prev.folders, next0.folders, now, deleted),
      notebooks: stampPages(prev.notebooks, stamp(prev.notebooks, next0.notebooks, now, deleted), now, deleted),
      customStickers: stamp(prev.customStickers, next0.customStickers, now, deleted),
      customTemplates: stamp(prev.customTemplates, next0.customTemplates, now, deleted),
      deleted,
      updatedAt: now,
      isSeed: false,
    }
    ref.current = next
    setData(next)
  }, [])

  // 1. Initial local load from IndexedDB + QR Auth Transfer consumption
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const local = await kvGet<Data>("state")
        let nextData = local ? normalizeData(local) : seed()
        if (active) {
          if (nextData.folders.length === 0 && typeof localStorage !== "undefined" && localStorage.getItem("defterim_glass_folders_v2") !== "1") {
            localStorage.setItem("defterim_glass_folders_v2", "1")
            nextData = { ...nextData, folders: defaultFolders() }
            void kvSet("state", nextData)
          }
          setData(nextData)
        }
      } catch {
        if (active) setData(seed())
      } finally {
        if (active) setLoaded(true)
      }
      navigator.storage?.persist?.()

      const qrResult = await consumeAuthTransferFromHash()
      if (qrResult.error && active) {
        setSyncError(qrResult.error)
      }
      if (qrResult.transferred && active) {
        setClientGen((g) => g + 1)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  // 2. IndexedDB persistence
  useEffect(() => {
    if (!loaded) return
    const t = setTimeout(() => {
      setSaveState("saving")
      kvSet("state", data)
        .then(() => setSaveState((st) => (ref.current === data ? "saved" : st)))
        .catch((err) => {
          console.error("Save failed", err)
          setSaveState("error")
        })
    }, 150)
    return () => clearTimeout(t)
  }, [data, loaded])

  useEffect(() => {
    // Uygulama arka plana geçerken / kapanırken hemen yaz; editörün son bekleyen değişikliği de yakalansın diye bir de sonraki turda yaz.
    const flush = () => {
      if (!loadedRef.current) return
      void kvSet("state", ref.current)
      setTimeout(() => void kvSet("state", ref.current), 0)
    }
    const vis = () => document.visibilityState === "hidden" && flush()
    window.addEventListener("pagehide", flush)
    window.addEventListener("beforeunload", flush)
    document.addEventListener("visibilitychange", vis)
    return () => {
      window.removeEventListener("pagehide", flush)
      window.removeEventListener("beforeunload", flush)
      document.removeEventListener("visibilitychange", vis)
    }
  }, [])

  // 3. Push helper
  const pushStateToCloud = useCallback(async (client: SupabaseClient, uidVal: string, payload: Data) => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncStatus("offline")
      return
    }
    setSyncStatus("syncing")
    setSyncError(null)
    // Körü körüne üzerine yazma yok: önce buluttaki sürümü al, birleştir, sadece değişmediyse yaz (compare-and-swap).
    let toPush = payload
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data: row, error: re } = await client.from("user_states").select("state, updated_at").eq("user_id", uidVal).maybeSingle()
      if (re) {
        setSyncStatus("error")
        setSyncError(re.message)
        return
      }
      if (row) {
        const remote = normalizeData(row.state as Partial<Data>)
        // Başka cihazdan gelen sürüm ezilmeden önce hem yerelde hem bulut geçmişinde saklanır
        if ((remote.updatedAt ?? 0) !== lastPushedAtRef.current) {
          await saveBackup(remote, "cloud-before-write", 60000)
          await saveCloudHistory(client, uidVal, remote, 0)
        }
        const mergedPush = { ...mergeData(toPush, remote), ownerId: toPush.ownerId ?? null }
        await guardMerge("push", toPush, remote, mergedPush)
        toPush = mergedPush
      }
      const ts = Math.max(toPush.updatedAt ?? 0, Date.now(), row ? new Date(row.updated_at as string).getTime() + 1 : 0)
      const cleanPayload: Data = { ...toPush, updatedAt: ts, isSeed: false }
      const body = { user_id: uidVal, state: cleanPayload, updated_at: new Date(ts).toISOString() }
      let error: { message: string } | null = null
      let won = true
      if (!row) {
        const r = await client.from("user_states").insert(body)
        error = r.error
        if (error && /duplicate|unique|23505/i.test(error.message)) {
          error = null
          won = false
        }
      } else {
        const r = await client.from("user_states").update(body).eq("user_id", uidVal).eq("updated_at", row.updated_at as string).select("user_id")
        error = r.error
        won = !!r.data?.length
      }
      if (error) {
        setSyncStatus("error")
        setSyncError(error.message)
        return
      }
      if (!won) continue // başka cihaz araya girdi: tekrar çek-birleştir-yaz
      lastPushedAtRef.current = ts
      // Başka cihazın değişiklikleri birleştirildiyse ekrana da yansıt (yerelde bu arada yeni düzenleme yoksa)
      if ((ref.current.updatedAt ?? 0) <= (payload.updatedAt ?? 0)) {
        localDirtyRef.current = false
        const m: Data = { ...cleanPayload, ownerId: ref.current.ownerId ?? null }
        ref.current = m
        setData(m)
        void kvSet("state", m)
      }
      void saveCloudHistory(client, uidVal, cleanPayload)
      setLastSyncedAt(Date.now())
      if (!localDirtyRef.current) setSyncStatus("synced")
      return
    }
    localDirtyRef.current = true
    setSyncStatus("error")
    setSyncError("Another device is editing. Your changes are on this device. Tap Sync to retry.")
  }, [])

  // Hesap sahipliği: yerel veri hangi hesaba aitse sadece o hesapla birleşir.
  // Farklı bir hesapla giriş yapılırsa eski hesabın verisi ayrı bir kayıt alanına saklanır, yenisinin verisi yüklenir.
  const ensureOwner = useCallback(async (uidVal: string) => {
    const cur = ref.current
    if (cur.ownerId === uidVal) return
    if (!cur.ownerId) {
      const next: Data = { ...cur, ownerId: uidVal }
      ref.current = next
      setData(next)
      await kvSet("state", next)
      return
    }
    await kvSet(`state:${cur.ownerId}`, cur)
    const stored = await kvGet<Data>(`state:${uidVal}`)
    const base = stored ? normalizeData(stored) : seed()
    const next: Data = { ...base, ownerId: uidVal }
    ref.current = next
    setData(next)
    await kvSet("state", next)
  }, [])

  // 4. Pull & Merge helper
  const pullAndMerge = useCallback(
    async (client: SupabaseClient, uidVal: string) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setSyncStatus("offline")
        return
      }
      setSyncStatus("syncing")
      setSyncError(null)
      await ensureOwner(uidVal)
      const { data: row, error } = await client
        .from("user_states")
        .select("state, updated_at")
        .eq("user_id", uidVal)
        .maybeSingle()

      if (error) {
        setSyncStatus("error")
        setSyncError(error.message)
        return
      }

      if (!row) {
        if (!ref.current.isSeed) {
          await pushStateToCloud(client, uidVal, ref.current)
        } else {
          setLastSyncedAt(Date.now())
          setSyncStatus("synced")
        }
        return
      }

      const remote = normalizeData(row.state as Partial<Data>)
      await saveBackup(ref.current, "before-sync", 60000)
      await saveBackup(remote, "cloud-copy", 120000)
      const merged: Data = { ...mergeData(ref.current, remote), ownerId: ref.current.ownerId ?? null }
      void guardMerge("pull", ref.current, remote, merged)
      ref.current = merged
      setData(merged)
      void kvSet("state", merged)

      const remoteTs = remote.updatedAt ?? 0
      if ((merged.updatedAt ?? 0) > remoteTs || (!ref.current.isSeed && merged.notebooks.length !== remote.notebooks.length)) {
        await pushStateToCloud(client, uidVal, merged)
      } else {
        localDirtyRef.current = false
        setLastSyncedAt(Date.now())
        setSyncStatus("synced")
      }
    },
    [pushStateToCloud, ensureOwner],
  )

  // 5. Supabase Auth + Realtime subscription lifecycle
  useEffect(() => {
    if (!loaded) return
    const client = getSupabaseClient()
    if (!client) {
      queueMicrotask(() => {
        setSyncStatus("unconfigured")
        setUserEmail(null)
        setUserId(null)
      })
      return
    }

    let channel: RealtimeChannel | null = null
    let alive = true

    const attachRealtime = (uidVal: string) => {
      if (channel) {
        void client.removeChannel(channel)
        channel = null
      }
      channel = client
        .channel(`user_state_sync_${uidVal}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_states",
            filter: `user_id=eq.${uidVal}`,
          },
          (payload) => {
            const rec = payload.new as { state?: Partial<Data> } | null
            if (!rec?.state) return
            if (ref.current.ownerId && ref.current.ownerId !== uidVal) return
            const remote = normalizeData(rec.state)
            const remoteTs = remote.updatedAt ?? 0
            // Ignore echo from our own push or older snapshots
            if (!localDirtyRef.current && remoteTs === lastPushedAtRef.current) {
              return
            }
            void saveBackup(ref.current, "before-sync", 60000)
            const merged: Data = { ...mergeData(ref.current, remote), ownerId: ref.current.ownerId ?? null }
            void guardMerge("realtime", ref.current, remote, merged)
            ref.current = merged
            setData(merged)
            void kvSet("state", merged)
            setLastSyncedAt(Date.now())
            if (!localDirtyRef.current) setSyncStatus("synced")
          },
        )
        .subscribe()
    }

    const syncSession = async () => {
      const { data: sessionData, error } = await client.auth.getSession()
      if (!alive) return
      if (error) {
        setSyncStatus("error")
        setSyncError(error.message)
        return
      }
      const user = sessionData.session?.user
      if (!user) {
        setUserId(null)
        setUserEmail(null)
        setSyncStatus("signed_out")
        return
      }
      setUserId(user.id)
      setUserEmail(user.email ?? null)
      attachRealtime(user.id)
      await pullAndMerge(client, user.id)
    }

    void syncSession()

    const { data: authSub } = client.auth.onAuthStateChange((_event, session) => {
      if (!alive) return
      const user = session?.user
      if (!user) {
        setUserId(null)
        setUserEmail(null)
        setSyncStatus("signed_out")
        if (channel) {
          void client.removeChannel(channel)
          channel = null
        }
        return
      }
      setUserId(user.id)
      setUserEmail(user.email ?? null)
      attachRealtime(user.id)
      void pullAndMerge(client, user.id)
    })

    const onOnline = () => {
      const uidVal = userIdRef.current
      if (uidVal) void pullAndMerge(client, uidVal)
    }
    const onOffline = () => {
      if (userIdRef.current) setSyncStatus("offline")
    }
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)

    return () => {
      alive = false
      authSub.subscription.unsubscribe()
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
      if (channel) void client.removeChannel(channel)
    }
  }, [loaded, clientGen, pullAndMerge])

  // Sticker paketleri ve fontlar: giriş yapılınca ve yeni biri eklenince buluta yedekle / diğer cihazdan indir
  useEffect(() => {
    if (!loaded || !userId) return
    const client = getSupabaseClient()
    if (!client) return
    const run = () => void syncAssets(client, userId)
    const t = setTimeout(run, 1500)
    let t2: ReturnType<typeof setTimeout> | null = null
    const on = () => {
      if (t2) clearTimeout(t2)
      t2 = setTimeout(run, 1500)
    }
    window.addEventListener("assets-changed", on)
    window.addEventListener("online", on)
    return () => {
      clearTimeout(t)
      if (t2) clearTimeout(t2)
      window.removeEventListener("assets-changed", on)
      window.removeEventListener("online", on)
    }
  }, [loaded, userId])

  // Düzenli yerel anlık görüntü (veri değiştikçe en fazla birkaç dakikada bir)
  useEffect(() => {
    if (!loaded || data.isSeed) return
    const t = setTimeout(() => void saveBackup(data, "auto", 3 * 60000), 45000)
    return () => clearTimeout(t)
  }, [data, loaded])

  // 6. Debounced Cloud Push whenever local data changes
  useEffect(() => {
    if (!loaded || !userId || !localDirtyRef.current || data.isSeed) return
    if (data.ownerId !== userId) return // başka hesabın verisini asla bu hesaba yükleme
    const client = getSupabaseClient()
    if (!client) return
    const t = setTimeout(() => {
      void pushStateToCloud(client, userId, data)
    }, 1000)
    return () => clearTimeout(t)
  }, [data, loaded, userId, pushStateToCloud])

  const syncNow = useCallback(async () => {
    const client = getSupabaseClient()
    if (!client) {
      setSyncStatus("unconfigured")
      return
    }
    const { data: sessionData } = await client.auth.getSession()
    const user = sessionData.session?.user
    if (!user) {
      setSyncStatus("signed_out")
      return
    }
    await pullAndMerge(client, user.id)
  }, [pullAndMerge])

  const refreshAuthClient = useCallback(async () => {
    setClientGen((g) => g + 1)
  }, [])

  const signOut = useCallback(async () => {
    const client = getSupabaseClient()
    if (client) await client.auth.signOut()
    setUserId(null)
    setUserEmail(null)
    setLastSyncedAt(null)
    setSyncStatus(client ? "signed_out" : "unconfigured")
  }, [])

  const exportBackupJson = useCallback(async () => {
    return JSON.stringify({ ...ref.current, assets: await exportAssets(), exportedAt: new Date().toISOString() }, null, 2)
  }, [])

  /** Bir yedeği/geçmiş sürümü geri yükle: mevcut durum önce ayrı bir kopya olarak saklanır, sonra yüklenen veri "en yeni" sayılır. */
  const restoreData = useCallback(
    async (d: Data) => {
      await saveBackup(ref.current, "before-restore")
      const now = Date.now()
      const n = normalizeData({ ...d, isSeed: false, updatedAt: now })
      // Geri yüklenen her öğe "şimdi" damgasıyla gelir: aynı kimlikte eski sürümün yerine geçer, silme kayıtları onları ezemez.
      // Şu an var olup yedekte olmayan hiçbir şey silinmez (birleştirme).
      const stampAll = <T extends { id: string; updatedAt?: number }>(l: T[] | undefined) => (l ?? []).map((x) => ({ ...x, updatedAt: now }))
      const restored: Data = {
        ...n,
        folders: stampAll(n.folders),
        notebooks: n.notebooks.map((nb) => ({ ...nb, updatedAt: now, cover: { ...nb.cover, updatedAt: now }, pages: nb.pages.map((p) => ({ ...p, updatedAt: now })) })),
        customStickers: stampAll(n.customStickers),
        customTemplates: stampAll(n.customTemplates),
        deleted: {},
      }
      mutate((cur) => ({ ...mergeData(cur, restored), ownerId: cur.ownerId ?? null }))
    },
    [mutate],
  )

  /** Buluttaki kopyayı olduğu gibi bu cihaza yükler (birleştirme yok). Yerel veri önce yedeğe alınır. */
  const reloadFromCloud = useCallback(async () => {
    const client = getSupabaseClient()
    const uidVal = userIdRef.current
    if (!client || !uidVal) return { ok: false, message: "Not signed in." }
    if (typeof navigator !== "undefined" && !navigator.onLine) return { ok: false, message: "You are offline." }
    const { data: row, error } = await client.from("user_states").select("state, updated_at").eq("user_id", uidVal).maybeSingle()
    if (error) return { ok: false, message: error.message }
    if (!row) return { ok: false, message: "Nothing is stored in the cloud for this account." }
    const remote = normalizeData(row.state as Partial<Data>)
    const nb = remote.notebooks.length
    if (!nb && !(remote.customStickers ?? []).length) return { ok: false, message: "The cloud copy is empty; nothing was changed." }
    await saveBackup(ref.current, "before-cloud-reload")
    const next: Data = { ...remote, ownerId: uidVal, isSeed: false, updatedAt: Math.max(remote.updatedAt ?? 0, Date.now()) }
    ref.current = next
    setData(next)
    await kvSet("state", next)
    localDirtyRef.current = true // yeni damga buluta yansısın
    return { ok: true, message: `Loaded from the cloud: ${nb} notebooks, ${(remote.customStickers ?? []).length} stickers, ${remote.folders.length} folders.` }
  }, [])

  const importBackupJson = useCallback(
    async (json: string) => {
      try {
        const parsed = JSON.parse(json) as Partial<Data> & { assets?: Awaited<ReturnType<typeof exportAssets>> }
        if (!parsed || !Array.isArray(parsed.notebooks)) return false
        const normalized = normalizeData({ ...parsed, isSeed: false, updatedAt: Date.now() })
        if (parsed.assets) await restoreAssets(parsed.assets)
        await saveBackup(ref.current, "before-file-restore")
        mutate((d) => ({ ...normalized, ownerId: d.ownerId ?? null })) // yedekteki hesap bilgisi değil, bu cihazdaki hesap geçerli
        return true
      } catch {
        return false
      }
    },
    [mutate],
  )

  const mapNb = useCallback(
    (id: string, fn: (n: Notebook) => Notebook) =>
      mutate((d) => ({ ...d, notebooks: d.notebooks.map((n) => (n.id === id ? fn(n) : n)) })),
    [mutate],
  )

  const store = useMemo<Store>(
    () => ({
      loaded,
      folders: data.folders,
      notebooks: data.notebooks,
      customStickers: data.customStickers ?? [],
      customTemplates: data.customTemplates ?? [],
      saveState,
      syncStatus,
      syncError,
      userEmail,
      userId,
      lastSyncedAt,
      syncNow,
      refreshAuthClient,
      signOut,
      exportBackupJson,
      importBackupJson,
      restoreData,
      reloadFromCloud,
      addFolder: (f) => {
        const id = uid()
        mutate((d) => ({ ...d, folders: [...d.folders, { ...f, id }] }))
        return id
      },
      updateFolder: (id, patch) =>
        mutate((d) => ({ ...d, folders: d.folders.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
      deleteFolder: (id) =>
        mutate((d) => ({
          ...d,
          folders: d.folders.filter((f) => f.id !== id),
          notebooks: d.notebooks.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)),
        })),
      addNotebook: (title, folderId, preset, color, orient) => {
        const id = uid()
        const pages = presetPages(preset, orient).map((t) => newPage(t, undefined, orient))
        mutate((d) => ({
          ...d,
          notebooks: [
            ...d.notebooks,
            {
              id,
              folderId,
              title,
              cover: newPage("blank", color, orient),
              pages,
              tabs: preset === "ajanda" ? defaultTabs() : undefined,
            },
          ],
        }))
        return id
      },
      updateNotebook: (id, patch) => mapNb(id, (n) => ({ ...n, ...patch })),
      deleteNotebook: (id) => mutate((d) => ({ ...d, notebooks: d.notebooks.filter((n) => n.id !== id) })),
      setPage: (nbId, which, page) =>
        mapNb(nbId, (n) =>
          which === "cover" ? { ...n, cover: page } : { ...n, pages: n.pages.map((p) => (p.id === which ? page : p)) },
        ),
      addPages: (nbId, at, templates) =>
        mapNb(nbId, (n) => {
          const pages = n.pages.slice()
          pages.splice(at, 0, ...templates.map((t) => newPage(t, undefined, n.cover.orient)))
          return { ...n, pages }
        }),
      addCustomPage: (nbId, at, page) =>
        mapNb(nbId, (n) => {
          const pages = n.pages.slice()
          pages.splice(at, 0, { ...page, id: uid() })
          return { ...n, pages }
        }),
      movePage: (nbId, from, to) =>
        mapNb(nbId, (n) => {
          if (to < 0 || to >= n.pages.length || from === to) return n
          const pages = n.pages.slice()
          const [p] = pages.splice(from, 1)
          pages.splice(to, 0, p)
          return { ...n, pages }
        }),
      duplicatePage: (nbId, at) =>
        mapNb(nbId, (n) => {
          const src = n.pages[at]
          if (!src) return n
          const pages = n.pages.slice()
          pages.splice(at + 1, 0, {
            ...src,
            id: uid(),
            config: src.config ? { ...src.config } : undefined,
            strokes: src.strokes.map((s) => ({ ...s, pts: s.pts.slice() })),
            items: src.items.map((i) => ({ ...i, id: uid() })),
          })
          return { ...n, pages }
        }),
      deletePagesByIds: (nbId, ids) =>
        mapNb(nbId, (n) => {
          const set = new Set(ids)
          const pages = n.pages.filter((p) => !set.has(p.id))
          return { ...n, pages: pages.length ? pages : [newPage("dots", undefined, n.cover.orient)] }
        }),
      duplicatePagesByIds: (nbId, ids) =>
        mapNb(nbId, (n) => {
          const set = new Set(ids)
          const pages = n.pages.flatMap((p) =>
            set.has(p.id)
              ? [p, { ...p, id: uid(), config: p.config ? { ...p.config } : undefined, strokes: p.strokes.map((st) => ({ ...st, pts: st.pts.slice() })), items: p.items.map((i) => ({ ...i, id: uid() })) }]
              : [p],
          )
          return { ...n, pages }
        }),
      deleteNotebooks: (ids) => mutate((d) => ({ ...d, notebooks: d.notebooks.filter((n) => !ids.includes(n.id)) })),
      moveNotebooks: (ids, folderId) => mutate((d) => ({ ...d, notebooks: d.notebooks.map((n) => (ids.includes(n.id) ? { ...n, folderId } : n)) })),
      deleteFolders: (ids) =>
        mutate((d) => ({
          ...d,
          folders: d.folders.filter((f) => !ids.includes(f.id)),
          notebooks: d.notebooks.map((n) => (n.folderId && ids.includes(n.folderId) ? { ...n, folderId: null } : n)),
        })),
      deletePages: (nbId, from, count) =>
        mapNb(nbId, (n) => {
          const pages = n.pages.slice()
          pages.splice(from, count)
          return { ...n, pages: pages.length ? pages : [newPage("dots", undefined, n.cover.orient)] }
        }),
      addCustomSticker: (s) =>
        mutate((d) => ({
          ...d,
          customStickers: [...(d.customStickers ?? []), { ...s, id: uid() }],
        })),
      deleteCustomSticker: (id) =>
        mutate((d) => ({
          ...d,
          customStickers: (d.customStickers ?? []).filter((x) => x.id !== id),
        })),
      addCustomTemplate: (t) =>
        mutate((d) => ({
          ...d,
          customTemplates: [...(d.customTemplates ?? []), { ...t, id: uid() }],
        })),
      deleteCustomTemplate: (id) =>
        mutate((d) => ({
          ...d,
          customTemplates: (d.customTemplates ?? []).filter((x) => x.id !== id),
        })),
    }),
    [
      data,
      loaded,
      saveState,
      syncStatus,
      syncError,
      userEmail,
      userId,
      lastSyncedAt,
      syncNow,
      refreshAuthClient,
      signOut,
      exportBackupJson,
      importBackupJson,
      restoreData,
      reloadFromCloud,
      mutate,
      mapNb,
    ],
  )

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error("StoreProvider missing")
  return s
}
