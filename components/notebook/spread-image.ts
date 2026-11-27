import { renderPage } from "@/lib/render"
import { dims, type Page } from "@/lib/types"

export async function spreadImage(left: Page | null, right: Page | null) {
  const c = document.createElement("canvas")
  c.width = 1500
  c.height = 1200
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#e6dfd0"
  ctx.fillRect(0, 0, 1500, 1200)
  for (const [i, p] of [left, right].entries()) {
    if (!p) continue
    const d = dims(p.orient)
    const s = Math.min(750 / d.w, 1200 / d.h)
    const pc = await renderPage(p, s)
    ctx.drawImage(pc, i * 750 + (750 - pc.width) / 2, (1200 - pc.height) / 2)
  }
  return c.toDataURL("image/jpeg", 0.82)
}
