import type { SupabaseClient } from "@supabase/supabase-js"
import { kvDel, kvGet, kvKeys, kvSet } from "./db"
import type { Data } from "./store"

/**
 * Veri kaybını imkânsız kılan güvenlik ağı: veri her riskli işlemden önce (bulutla birleştirme, buluta yazma,
 * geri yükleme) ve düzenli aralıklarla ayrı bir yere "anlık görüntü" olarak saklanır. Hiçbir senkron hatası
 * bu kopyaları silemez; Sync → Backups ekranından istenen ana geri dönülebilir.
 * Yerel kopyalar bu cihazın IndexedDB'sinde, bulut geçmişi `user_state_history` tablosunda tutulur.
 */

export type BackupMeta = { id: string; ts: number; reason: string; nb: number; pages: number; strokes: number; items: number }

const IDX = "backup:index"
const lastAt: Record<string, number> = {}

export function dataStats(d: Data) {
  let pages = 0, strokes = 0, items = 0
  for (const n of d.notebooks) {
    for (const p of [n.cover, ...n.pages]) {
      pages++
      strokes += p.strokes.length
      items += p.items.length
    }
  }
  return { nb: d.notebooks.length, pages, strokes, items }
}

/** Eski kopyaları seyrelt: son 3 saat hepsi, 2 güne kadar saatte bir, 45 güne kadar günde bir. */
export function thin<T extends { ts: number }>(list: T[], now = Date.now()): T[] {
  const keep: T[] = []
  const seen = new Set<string>()
  for (const b of [...list].sort((a, c) => c.ts - a.ts)) {
    const age = now - b.ts
    if (age > 45 * 864e5) continue
    const bucket = age < 3 * 36e5 ? `m${b.ts}` : age < 2 * 864e5 ? `h${Math.floor(b.ts / 36e5)}` : `d${Math.floor(b.ts / 864e5)}`
    if (seen.has(bucket)) continue
    seen.add(bucket)
    keep.push(b)
  }
  return keep.slice(0, 80)
}

export async function listBackups(): Promise<BackupMeta[]> {
  try {
    return ((await kvGet<BackupMeta[]>(IDX)) ?? []).sort((a, b) => b.ts - a.ts)
  } catch {
    return []
  }
}

/** Yerel anlık görüntü. `minGapMs`: aynı nedenle üst üste çok sık kopya alma. */
let pendingBackup = Promise.resolve()
export function saveBackup(d: Data, reason: string, minGapMs = 0): Promise<void> {
  pendingBackup = pendingBackup.then(() => writeBackup(d, reason, minGapMs))
  return pendingBackup
}

async function writeBackup(d: Data, reason: string, minGapMs: number): Promise<void> {
  try {
    if (d.isSeed) return
    const now = Date.now()
    if (minGapMs && now - (lastAt[reason] ?? 0) < minGapMs) return
    const st = dataStats(d)
    if (st.pages === 0 && st.nb === 0) return
    const list = await listBackups()
    const prev = list.find((b) => b.reason === reason)
    if (prev && prev.nb === st.nb && prev.pages === st.pages && prev.strokes === st.strokes && prev.items === st.items && now - prev.ts < 30 * 6e4) {
      const prior = await loadBackup(prev.id)
      if (JSON.stringify(prior) === JSON.stringify(d)) return
    }
    lastAt[reason] = now
    const id = `${now}-${Math.random().toString(36).slice(2, 6)}`
    await kvSet(`backup:${id}`, d)
    const next = thin([{ id, ts: now, reason, ...st }, ...list], now)
    await kvSet(IDX, next)
    const keepIds = new Set(next.map((b) => b.id))
    for (const b of list) if (!keepIds.has(b.id)) await kvDel(`backup:${b.id}`)
  } catch {
    /* yedek alınamasa da uygulama çalışmaya devam eder */
  }
}

export async function loadBackup(id: string): Promise<Data | undefined> {
  if (id.startsWith("state")) return kvGet<Data>(id)
  return kvGet<Data>(`backup:${id}`)
}

/** Bu cihazda saklı tüm veri kopyaları: şu anki veri ve (başka hesapla girişte kenara alınan) diğer hesapların verisi. */
export async function listDeviceStates(): Promise<BackupMeta[]> {
  const out: BackupMeta[] = []
  try {
    for (const k of (await kvKeys()).filter((k) => k === "state" || k.startsWith("state:"))) {
      const d = await kvGet<Data>(k)
      if (!d?.notebooks) continue
      out.push({ id: k, ts: d.updatedAt ?? 0, reason: k === "state" ? "current data on this device" : "stored data of another sign-in", ...dataStats(d) })
    }
  } catch {}
  return out
}

// ---- Bulut geçmişi (en iyi çaba: tablo yoksa sessizce atlanır) --------------------------------------------------
export type CloudVersion = { id: number; created_at: string; meta: Omit<BackupMeta, "id" | "ts" | "reason"> | null }
let lastCloudAt = 0
let cloudMissing = false

export async function saveCloudHistory(client: SupabaseClient, userId: string, d: Data, minGapMs = 10 * 6e4): Promise<void> {
  try {
    if (cloudMissing || d.isSeed) return
    const now = Date.now()
    if (now - lastCloudAt < minGapMs) return
    lastCloudAt = now
    const { error } = await client.from("user_state_history").insert({ user_id: userId, state: d, meta: dataStats(d) })
    if (error) {
      if (/relation|does not exist|schema cache|42P01|PGRST205/i.test(error.message)) cloudMissing = true
      return
    }
    const { data: rows } = await client.from("user_state_history").select("id, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(300)
    if (!rows) return
    const kept = new Set(thin(rows.map((r) => ({ id: r.id as number, ts: new Date(r.created_at as string).getTime() }))).map((r) => r.id))
    const drop = rows.filter((r) => !kept.has(r.id as number)).map((r) => r.id as number)
    if (drop.length) await client.from("user_state_history").delete().in("id", drop)
  } catch {
    /* yoksay */
  }
}

export async function listCloudHistory(client: SupabaseClient, userId: string): Promise<CloudVersion[] | null> {
  const { data, error } = await client.from("user_state_history").select("id, created_at, meta").eq("user_id", userId).order("created_at", { ascending: false }).limit(60)
  if (error) return null
  return (data ?? []) as CloudVersion[]
}

export async function loadCloudVersion(client: SupabaseClient, id: number): Promise<Data | undefined> {
  const { data } = await client.from("user_state_history").select("state").eq("id", id).maybeSingle()
  return (data?.state as Data | undefined) ?? undefined
}

// ---- Eşitleme günlüğü: veri nerede ve ne zaman azaldı, sonradan görülebilsin -------------------------------------
export type SyncLog = { ts: number; source: string; local: ReturnType<typeof dataStats>; remote: ReturnType<typeof dataStats>; merged: ReturnType<typeof dataStats>; shrink: boolean }
export async function logSync(e: SyncLog) {
  try {
    const cur = (await kvGet<SyncLog[]>("synclog")) ?? []
    // aynı sayıları üst üste yazma
    const last = cur[0]
    if (last && !e.shrink && JSON.stringify([last.local, last.remote, last.merged]) === JSON.stringify([e.local, e.remote, e.merged])) return
    await kvSet("synclog", [e, ...cur].slice(0, 60))
  } catch {}
}
export async function getSyncLog(): Promise<SyncLog[]> {
  return (await kvGet<SyncLog[]>("synclog")) ?? []
}
