"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Crop, Eraser, RotateCcw } from "lucide-react"
import { Modal, btn, btnPrimary } from "@/components/ui"
import { loadImg } from "@/lib/render"
import { cn } from "@/lib/utils"

type Shape = "rect" | "rounded" | "circle"
type Rect = { x: number; y: number; w: number; h: number } // 0..1
type Opts = { crop: Rect; shape: Shape; bg: boolean; tol: number; soft: number; global: boolean; color: [number, number, number] | null }

export type ImageEditResult = { src: string; aspect: number; bgRemoved: boolean }

const MAXP = 1000 // önizleme çözünürlüğü
const MAXF = 2400 // çıktı çözünürlüğü

/** Kırp → şekil maskesi → (isteğe bağlı) arka planı yumuşakça sil. Arka plan sadece KENARLARA bağlı bölgeden silinir, içerideki beyazlar korunur. */
function process(img: HTMLImageElement, o: Opts, maxSide: number): HTMLCanvasElement {
  const sw = Math.max(1, Math.round(img.naturalWidth * o.crop.w))
  const sh = Math.max(1, Math.round(img.naturalHeight * o.crop.h))
  const k = Math.min(1, maxSide / Math.max(sw, sh))
  const W = Math.max(1, Math.round(sw * k))
  const H = Math.max(1, Math.round(sh * k))
  const c = document.createElement("canvas")
  c.width = W
  c.height = H
  const ctx = c.getContext("2d", { willReadFrequently: true })!
  ctx.drawImage(img, img.naturalWidth * o.crop.x, img.naturalHeight * o.crop.y, sw, sh, 0, 0, W, H)

  if (o.bg) {
    const im = ctx.getImageData(0, 0, W, H)
    const d = im.data
    const bg = o.color ?? borderColor(d, W, H)
    const tol = o.tol
    const soft = Math.max(1, o.soft)
    const thr = tol + soft
    const dist = (i: number) => {
      const dr = d[i] - bg[0], dg = d[i + 1] - bg[1], db = d[i + 2] - bg[2]
      return Math.sqrt(dr * dr + dg * dg + db * db)
    }
    const region = new Uint8Array(W * H)
    if (o.global) {
      for (let p = 0; p < W * H; p++) if (dist(p * 4) <= thr) region[p] = 1
    } else {
      const stack: number[] = []
      const push = (p: number) => {
        if (!region[p] && dist(p * 4) <= thr) {
          region[p] = 1
          stack.push(p)
        }
      }
      for (let x = 0; x < W; x++) {
        push(x)
        push((H - 1) * W + x)
      }
      for (let y = 0; y < H; y++) {
        push(y * W)
        push(y * W + W - 1)
      }
      while (stack.length) {
        const p = stack.pop()!
        const x = p % W
        if (x > 0) push(p - 1)
        if (x < W - 1) push(p + 1)
        if (p >= W) push(p - W)
        if (p < W * (H - 1)) push(p + W)
      }
    }
    for (let p = 0; p < W * H; p++) {
      if (!region[p]) continue
      const a = Math.max(0, Math.min(1, (dist(p * 4) - tol) / soft))
      d[p * 4 + 3] = Math.round(d[p * 4 + 3] * a)
    }
    ctx.putImageData(im, 0, 0)
  }

  if (o.shape !== "rect") {
    ctx.globalCompositeOperation = "destination-in"
    ctx.beginPath()
    if (o.shape === "circle") ctx.ellipse(W / 2, H / 2, W / 2, H / 2, 0, 0, Math.PI * 2)
    else ctx.roundRect(0, 0, W, H, Math.min(W, H) * 0.14)
    ctx.fill()
    ctx.globalCompositeOperation = "source-over"
  }
  return c
}

function borderColor(d: Uint8ClampedArray, W: number, H: number): [number, number, number] {
  const rs: number[] = [], gs: number[] = [], bs: number[] = []
  const take = (p: number) => {
    rs.push(d[p * 4])
    gs.push(d[p * 4 + 1])
    bs.push(d[p * 4 + 2])
  }
  const sx = Math.max(1, Math.floor(W / 60)), sy = Math.max(1, Math.floor(H / 60))
  for (let x = 0; x < W; x += sx) {
    take(x)
    take((H - 1) * W + x)
  }
  for (let y = 0; y < H; y += sy) {
    take(y * W)
    take(y * W + W - 1)
  }
  const med = (a: number[]) => a.sort((m, n) => m - n)[Math.floor(a.length / 2)]
  return [med(rs), med(gs), med(bs)]
}

const RATIOS: { id: string; label: string; r: number | null }[] = [
  { id: "free", label: "Free", r: null },
  { id: "1", label: "1:1", r: 1 },
  { id: "43", label: "4:3", r: 4 / 3 },
  { id: "34", label: "3:4", r: 3 / 4 },
  { id: "169", label: "16:9", r: 16 / 9 },
]

/** Fotoğraf / çıkartma düzenleyici: kırpma (serbest, oranlı, yuvarlak) ve ayarlanabilir arka plan silme. */
export default function ImageEditModal({ src, original, startTab, onApply, onClose }: { src: string; original?: string; startTab: "crop" | "bg"; onApply: (r: ImageEditResult) => void; onClose: () => void }) {
  const baseSrc = original ?? src
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [tab, setTab] = useState<"crop" | "bg">(startTab)
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, w: 1, h: 1 })
  const [ratio, setRatio] = useState<number | null>(null)
  const [shape, setShape] = useState<Shape>("rect")
  const [bg, setBg] = useState(startTab === "bg")
  const [tol, setTol] = useState(34)
  const [soft, setSoft] = useState(26)
  const [global, setGlobal] = useState(false)
  const [color, setColor] = useState<[number, number, number] | null>(null)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const prevRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    loadImg(baseSrc).then((i) => alive && setImg(i)).catch(() => {})
    return () => {
      alive = false
    }
  }, [baseSrc])

  const opts = (): Opts => ({ crop, shape, bg, tol, soft, global, color })

  // Önizleme
  useEffect(() => {
    const cv = prevRef.current
    if (!img || !cv) return
    const id = requestAnimationFrame(() => {
      const out = tab === "crop" ? process(img, { ...opts(), crop: { x: 0, y: 0, w: 1, h: 1 }, bg: false, shape: "rect" }, MAXP) : process(img, opts(), MAXP)
      cv.width = out.width
      cv.height = out.height
      cv.getContext("2d")!.drawImage(out, 0, 0)
    })
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, tab, crop, shape, bg, tol, soft, global, color])

  const aspectPx = img ? img.naturalWidth / img.naturalHeight : 1

  // ---- Kırpma çerçevesi sürükleme ----
  const drag = useRef<null | { mode: string; sx: number; sy: number; start: Rect }>(null)
  const clamp = (r: Rect): Rect => {
    const w = Math.min(1, Math.max(0.05, r.w)), h = Math.min(1, Math.max(0.05, r.h))
    return { w, h, x: Math.min(1 - w, Math.max(0, r.x)), y: Math.min(1 - h, Math.max(0, r.y)) }
  }
  const onDown = (mode: string, e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: crop }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    const box = stageRef.current?.getBoundingClientRect()
    if (!d || !box) return
    const dx = (e.clientX - d.sx) / box.width, dy = (e.clientY - d.sy) / box.height
    let { x, y, w, h } = d.start
    if (d.mode === "move") return setCrop(clamp({ x: x + dx, y: y + dy, w, h }))
    if (d.mode.includes("l")) {
      const nx = Math.min(x + w - 0.05, Math.max(0, x + dx))
      w = x + w - nx
      x = nx
    }
    if (d.mode.includes("r")) w = Math.min(1 - x, Math.max(0.05, w + dx))
    if (d.mode.includes("t")) {
      const ny = Math.min(y + h - 0.05, Math.max(0, y + dy))
      h = y + h - ny
      y = ny
    }
    if (d.mode.includes("b")) h = Math.min(1 - y, Math.max(0.05, h + dy))
    if (ratio) {
      // oran kilitli: yüksekliği genişliğe göre ayarla
      const hh = (w * aspectPx) / ratio
      if (d.mode.includes("t")) y = d.start.y + d.start.h - hh
      h = hh
      if (y < 0 || y + h > 1) return
    }
    setCrop(clamp({ x, y, w, h }))
  }
  const onUp = () => (drag.current = null)

  const applyRatio = (r: number | null) => {
    setRatio(r)
    if (!r) return
    setCrop((c) => {
      let w = c.w
      let h = (w * aspectPx) / r
      if (h > 1) {
        h = 1
        w = (h * r) / aspectPx
      }
      return clamp({ x: c.x + (c.w - w) / 2, y: c.y + (c.h - h) / 2, w, h })
    })
  }

  const pick = useCallback(
    (e: React.PointerEvent) => {
      if (!picking || !img) return
      const box = stageRef.current?.getBoundingClientRect()
      if (!box) return
      const fx = (e.clientX - box.left) / box.width, fy = (e.clientY - box.top) / box.height
      const t = process(img, { ...opts(), bg: false, shape: "rect" }, MAXP)
      const px = t.getContext("2d")!.getImageData(Math.min(t.width - 1, Math.floor(fx * t.width)), Math.min(t.height - 1, Math.floor(fy * t.height)), 1, 1).data
      setColor([px[0], px[1], px[2]])
      setBg(true)
      setPicking(false)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picking, img, crop],
  )

  const apply = async () => {
    if (!img) return
    setBusy(true)
    await new Promise((r) => setTimeout(r, 30))
    const out = process(img, opts(), MAXF)
    onApply({ src: out.toDataURL("image/png"), aspect: out.width / out.height, bgRemoved: bg })
  }

  const reset = () => {
    setCrop({ x: 0, y: 0, w: 1, h: 1 })
    setRatio(null)
    setShape("rect")
    setBg(false)
    setColor(null)
    setTol(34)
    setSoft(26)
    setGlobal(false)
  }

  const seg = (on: boolean) => cn("press flex-1 rounded-xl px-3 py-2 text-sm font-semibold", on ? "bg-rose text-ink" : "bg-cream text-ink-soft")
  const handle = "absolute z-10 h-6 w-6 rounded-full border-2 border-primary bg-paper shadow"

  return (
    <Modal title="Edit image" onClose={onClose} wide>
      <div className="mb-3 flex gap-2">
        <button className={seg(tab === "crop")} onClick={() => setTab("crop")}>
          <Crop size={14} className="mr-1 inline" /> Crop
        </button>
        <button className={seg(tab === "bg")} onClick={() => setTab("bg")}>
          <Eraser size={14} className="mr-1 inline" /> Background
        </button>
      </div>

      <div
        className="mx-auto flex max-h-[46dvh] w-fit max-w-full items-center justify-center overflow-hidden rounded-xl border-2 border-line"
        style={{ backgroundImage: "linear-gradient(45deg,#d9d9d9 25%,transparent 25%,transparent 75%,#d9d9d9 75%),linear-gradient(45deg,#d9d9d9 25%,#fff 25%,#fff 75%,#d9d9d9 75%)", backgroundSize: "16px 16px", backgroundPosition: "0 0,8px 8px" }}
      >
        <div ref={stageRef} className={cn("relative touch-none", picking && "cursor-crosshair")} onPointerDown={pick} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <canvas ref={prevRef} className="block max-h-[46dvh] max-w-full" />
          {tab === "crop" && img && (
            <>
              {/* Karartma: kırpılacak alanın dışı */}
              <div className="pointer-events-none absolute inset-0 bg-ink/45" style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${crop.x * 100}% ${crop.y * 100}%,${crop.x * 100}% ${(crop.y + crop.h) * 100}%,${(crop.x + crop.w) * 100}% ${(crop.y + crop.h) * 100}%,${(crop.x + crop.w) * 100}% ${crop.y * 100}%,${crop.x * 100}% ${crop.y * 100}%)` }} />
              <div
                onPointerDown={e => onDown("move", e)}
                className={cn("absolute z-10 cursor-move border-2 border-dashed border-white shadow-[0_0_0_1px_rgba(0,0,0,0.4)]", shape === "circle" && "rounded-full", shape === "rounded" && "rounded-2xl")}
                style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
              />
              {(["tl", "tr", "bl", "br", "t", "b", "l", "r"] as const).map((m) => (
                <div
                  key={m}
                  onPointerDown={e => onDown(m, e)}
                  className={handle}
                  style={{
                    left: `calc(${(crop.x + (m.includes("l") ? 0 : m.includes("r") ? crop.w : crop.w / 2)) * 100}% - 12px)`,
                    top: `calc(${(crop.y + (m.includes("t") ? 0 : m.includes("b") ? crop.h : crop.h / 2)) * 100}% - 12px)`,
                    cursor: m === "t" || m === "b" ? "ns-resize" : m === "l" || m === "r" ? "ew-resize" : m === "tl" || m === "br" ? "nwse-resize" : "nesw-resize",
                  }}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {tab === "crop" ? (
        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">Ratio</div>
            <div className="flex flex-wrap gap-1.5">
              {RATIOS.map((r) => (
                <button key={r.id} onClick={() => applyRatio(r.r)} className={cn("press rounded-full px-3.5 py-2 text-xs font-semibold", ratio === r.r ? "bg-rose text-ink" : "bg-cream text-ink-soft")}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">Shape</div>
            <div className="flex gap-1.5">
              {(["rect", "rounded", "circle"] as const).map((s) => (
                <button key={s} onClick={() => setShape(s)} className={seg(shape === s)}>
                  {s === "rect" ? "Rectangle" : s === "rounded" ? "Rounded" : "Circle"}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-ink">
            <input type="checkbox" className="h-5 w-5 accent-primary" checked={bg} onChange={(e) => setBg(e.target.checked)} />
            Remove background
          </label>
          <div className={cn("space-y-3", !bg && "pointer-events-none opacity-40")}>
            <label className="block text-xs font-semibold text-ink-soft">
              Strength: how different from the background a pixel must be to stay <span className="float-right tabular-nums">{tol}</span>
              <input type="range" min={4} max={120} value={tol} onChange={(e) => setTol(+e.target.value)} className="mt-1 w-full accent-primary" />
            </label>
            <label className="block text-xs font-semibold text-ink-soft">
              Edge softness <span className="float-right tabular-nums">{soft}</span>
              <input type="range" min={2} max={80} value={soft} onChange={(e) => setSoft(+e.target.value)} className="mt-1 w-full accent-primary" />
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" className="h-5 w-5 accent-primary" checked={global} onChange={(e) => setGlobal(e.target.checked)} />
              Also erase matching colors inside the picture
            </label>
            <div className="flex items-center gap-2 text-xs text-ink-soft">
              <button onClick={() => setPicking((p) => !p)} className={cn("press rounded-xl px-3 py-2 text-xs font-semibold", picking ? "bg-rose text-ink" : "bg-cream text-ink")}>
                {picking ? "Tap the background…" : "Pick background color"}
              </button>
              {color && <span className="h-6 w-6 rounded-full border-2 border-white shadow" style={{ background: `rgb(${color.join(",")})` }} />}
              {color && (
                <button className="underline" onClick={() => setColor(null)}>
                  Auto
                </button>
              )}
            </div>
            <p className="text-[11px] text-ink-soft">Only the background connected to the edges is removed, so whites inside your picture stay. If something is still missing, lower Strength; if background is left, raise it.</p>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button className={btn} onClick={reset}>
          <RotateCcw size={16} /> Reset
        </button>
        <div className="flex-1" />
        <button className={btn} onClick={onClose}>
          Cancel
        </button>
        <button className={btnPrimary} onClick={apply} disabled={!img || busy}>
          {busy ? "Working…" : "Apply"}
        </button>
      </div>
    </Modal>
  )
}
