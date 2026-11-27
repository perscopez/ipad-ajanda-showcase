import type { Page, Stroke } from "./types"

type Clock = Record<string, number>
const fingerprints = new WeakMap<Stroke, string>()

// Ink operations replace immutable strokes. A content key also identifies strokes
// drawn before sync metadata existed. Count identical strokes separately.
function strokeKey(stroke: Stroke) {
  const cached = fingerprints.get(stroke)
  if (cached) return cached
  const data = JSON.stringify([stroke.tool, stroke.penStyle, stroke.color, stroke.size, stroke.opacity, stroke.pts])
  let a = 2166136261, b = 5381
  for (let i = 0; i < data.length; i++) {
    a = Math.imul(a ^ data.charCodeAt(i), 16777619)
    b = Math.imul(b, 33) ^ data.charCodeAt(i)
  }
  const key = `s${a >>> 0}.${b >>> 0}.${data.length}`
  fingerprints.set(stroke, key)
  return key
}

function strokes(page: Page) {
  const counts = new Map<string, number>()
  return page.strokes.map(stroke => {
    const base = strokeKey(stroke)
    const n = counts.get(base) ?? 0
    counts.set(base, n + 1)
    return [base + "." + n, stroke] as const
  })
}

const items = (page: Page) => page.items.map(item => ["i:" + item.id, item] as const)

export function stampPage(old: Page | undefined, page: Page, now: number): Page {
  if (old === page) return page
  const changed: Clock = { ...page.contentClock, ...old?.contentClock }
  const before = new Map<string, unknown>(old ? [...strokes(old), ...items(old)] : [])
  for (const [key, value] of [...strokes(page), ...items(page)]) {
    if (!before.has(key) || (key.startsWith("i:") && before.get(key) !== value)) changed[key] = now
    before.delete(key)
  }
  for (const key of before.keys()) changed[key] = now
  return { ...page, updatedAt: now, contentClock: changed }
}

export function mergePage(preferred: Page, other?: Page): Page {
  if (!other) return preferred
  const [a, b] = (other.updatedAt ?? 0) > (preferred.updatedAt ?? 0) ? [other, preferred] : [preferred, other]
  // Older app versions write whole pages. Preserve their historical ordering rule.
  if (!a.contentClock || !b.contentClock) return a
  const ac = a.contentClock, bc = b.contentClock
  const clock = { ...ac }
  for (const [k, v] of Object.entries(bc)) clock[k] = Math.max(clock[k] ?? 0, v)
  function merge<T>(left: readonly (readonly [string, T])[], right: readonly (readonly [string, T])[]) {
    const first = new Map(left), second = new Map(right)
    const result: T[] = []
    for (const k of new Set([...first.keys(), ...second.keys()])) {
      const leftTime = ac[k] ?? 0, rightTime = bc[k] ?? 0
      let value = rightTime > leftTime ? second.get(k) : first.get(k)
      if (leftTime === rightTime && leftTime > 0) {
        const x = first.get(k), y = second.get(k)
        if (x === undefined || y === undefined) value = undefined
        else if (k.startsWith("i:") && JSON.stringify(y) > JSON.stringify(x)) value = y
      }
      if (value !== undefined) result.push(value)
    }
    return result
  }
  return { ...a, strokes: merge(strokes(a), strokes(b)), items: merge(items(a), items(b)), contentClock: clock }
}
