import type { Stroke } from "./types"

/** Çizgiyi her ~2 birimde bir nokta olacak şekilde sıklaştırır (parçalı silgi için hassasiyet). */
export function densify(p: number[], step = 2): number[] {
  if (p.length < 6) return p.slice()
  const out = [p[0], p[1], p[2]]
  for (let i = 3; i < p.length; i += 3) {
    const ax = p[i - 3], ay = p[i - 2], ap = p[i - 1]
    const bx = p[i], by = p[i + 1], bp = p[i + 2]
    const n = Math.floor(Math.hypot(bx - ax, by - ay) / step)
    for (let k = 1; k <= n; k++) {
      const t = k / (n + 1)
      out.push(ax + (bx - ax) * t, ay + (by - ay) * t, ap + (bp - ap) * t)
    }
    out.push(bx, by, bp)
  }
  return out
}

/**
 * Silginin (x,y,R) dokunduğu kısmı keser, kalan parçaları ayrı çizgiler olarak döndürür.
 * Hiç dokunmuyorsa null.
 */
export function eraseFromStroke(s: Stroke, x: number, y: number, R: number): Stroke[] | null {
  const p0 = s.pts
  let touched = false
  for (let i = 0; i < p0.length; i += 3) {
    if (Math.hypot(p0[i] - x, p0[i + 1] - y) < R * 1.6) {
      touched = true
      break
    }
  }
  if (!touched && p0.length >= 6) {
    // iki nokta arasından geçen bölümler için
    for (let i = 3; i < p0.length; i += 3) {
      const ax = p0[i - 3], ay = p0[i - 2], dx = p0[i] - ax, dy = p0[i + 1] - ay
      const l2 = dx * dx + dy * dy
      if (!l2) continue
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2))
      if (Math.hypot(ax + t * dx - x, ay + t * dy - y) < R) {
        touched = true
        break
      }
    }
  }
  if (!touched) return null
  const p = densify(p0)
  const frags: number[][] = []
  let cur: number[] = []
  let cut = false
  for (let i = 0; i < p.length; i += 3) {
    if (Math.hypot(p[i] - x, p[i + 1] - y) < R) {
      cut = true
      if (cur.length) frags.push(cur)
      cur = []
    } else cur.push(p[i], p[i + 1], p[i + 2])
  }
  if (cur.length) frags.push(cur)
  if (!cut) return null
  return frags.filter((f) => f.length >= 6).map((pts) => ({ ...s, pts }))
}

export function pointInPolygon(x: number, y: number, poly: number[]): boolean {
  let inside = false
  const n = poly.length / 2
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i * 2], yi = poly[i * 2 + 1], xj = poly[j * 2], yj = poly[j * 2 + 1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) inside = !inside
  }
  return inside
}

/** Kementin içinde kalan noktaların oranı en az `ratio` olan çizgiler. */
export function strokesInLasso(strokes: Stroke[], poly: number[], ratio = 0.55): Stroke[] {
  if (poly.length < 6) return []
  return strokes.filter((s) => {
    let inN = 0
    const n = s.pts.length / 3
    for (let i = 0; i < n; i++) if (pointInPolygon(s.pts[i * 3], s.pts[i * 3 + 1], poly)) inN++
    return n > 0 && inN / n >= ratio
  })
}

export function bboxOf(strokes: Stroke[]): { x0: number; y0: number; x1: number; y1: number } | null {
  let b: { x0: number; y0: number; x1: number; y1: number } | null = null
  for (const s of strokes) {
    const m = Math.max(2, s.size * (s.tool === "marker" ? 1.4 : 1))
    for (let i = 0; i < s.pts.length; i += 3) {
      const x = s.pts[i], y = s.pts[i + 1]
      if (!b) b = { x0: x - m, y0: y - m, x1: x + m, y1: y + m }
      else {
        b.x0 = Math.min(b.x0, x - m)
        b.y0 = Math.min(b.y0, y - m)
        b.x1 = Math.max(b.x1, x + m)
        b.y1 = Math.max(b.y1, y + m)
      }
    }
  }
  return b
}

export function moveStroke(s: Stroke, dx: number, dy: number): Stroke {
  const pts = s.pts.slice()
  for (let i = 0; i < pts.length; i += 3) {
    pts[i] += dx
    pts[i + 1] += dy
  }
  return { ...s, pts }
}

/** (ox,oy) noktasına göre k kat büyütür; kalem kalınlığı da orantılı değişir. */
export function scaleStroke(s: Stroke, ox: number, oy: number, k: number): Stroke {
  const pts = s.pts.slice()
  for (let i = 0; i < pts.length; i += 3) {
    pts[i] = ox + (pts[i] - ox) * k
    pts[i + 1] = oy + (pts[i + 1] - oy) * k
  }
  return { ...s, pts, size: Math.max(0.6, Math.min(60, s.size * k)) }
}
