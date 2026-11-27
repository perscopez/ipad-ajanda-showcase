"use client"

import { useEffect, useRef } from "react"
import { drawCurl } from "@/lib/pageCurl"

export type Transition = "book" | "slide" | "vertical" | "cards" | "fade" | "none"

export const TRANSITIONS: { id: Transition; label: string }[] = [
  { id: "book", label: "Page curl" },
  { id: "slide", label: "Slide" },
  { id: "vertical", label: "Scroll" },
  { id: "cards", label: "Card stack" },
  { id: "fade", label: "Fade" },
  { id: "none", label: "None" },
]

export type TurnCtl = { t: number; state: "drag" | "finish" | "cancel" }

export type TurnState = {
  /** Parmakla sürüklenen çevirme: ilerlemeyi dışarıdan okur; altta gösterilecek hedef sayfa görüntüsü */
  ctl?: TurnCtl
  under?: string
  onCommit?: () => void
  img: string
  rect: { left: number; top: number; width: number; height: number }
  dir: 1 | -1
  mode: Transition
  key: number
}

/**
 * Sayfa değişince eski sayfanın görüntüsü üstte kalır ve seçilen şekilde gider;
 * altta yeni sayfa zaten hazırdır. dir=1 ileri, dir=-1 geri.
 */
export default function PageTurn({ turn, onDone }: { turn: TurnState; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const book = turn.mode === "book"
  const canvasMode = book || !!turn.ctl
  const { rect, dir } = turn
  const padY = Math.round(rect.height * 0.12)

  useEffect(() => {
    if (canvasMode) {
      const c = canvasRef.current
      if (!c) return onDone()
      let raf = 0
      let alive = true
      const cw = book ? rect.width * 2 : rect.width
      const ch = book ? rect.height + padY * 2 : rect.height
      const dpr = Math.min(2, Math.sqrt(4_500_000 / (cw * ch)))
      c.width = Math.round(cw * dpr)
      c.height = Math.round(ch * dpr)
      const load = (src: string) =>
        new Promise<HTMLImageElement>((res, rej) => {
          const im = new Image()
          im.onload = () => res(im)
          im.onerror = rej
          im.src = src
        })
      Promise.all([load(turn.img), turn.under ? load(turn.under) : Promise.resolve(null)])
        .then(([img, under]) => {
          if (!alive) return
          const ctx = c.getContext("2d")!
          const ctl = turn.ctl
          const t0 = performance.now()
          let anim: { from: number; to: number; t0: number; dur: number; kind: "finish" | "cancel" } | null = null
          let committed = false
          const frame = (now: number) => {
            if (!alive) return
            let t: number
            if (ctl) {
              if (!anim && ctl.state !== "drag") {
                const to = ctl.state === "finish" ? 1 : 0
                anim = { from: ctl.t, to, t0: now, dur: ctl.state === "finish" ? Math.max(280, (1 - ctl.t) * 850) : Math.max(160, ctl.t * 450), kind: ctl.state }
              }
              if (anim) {
                const k = Math.min(1, (now - anim.t0) / anim.dur)
                const e = 1 - Math.pow(1 - k, 3)
                ctl.t = anim.from + (anim.to - anim.from) * e
                if (k >= 1 && !committed) {
                  committed = true
                  if (anim.kind === "finish") {
                    turn.onCommit?.()
                    setTimeout(onDone, 160) // yeni sayfa hazır olana kadar altta tutulur
                  } else onDone()
                }
              }
              t = ctl.t
            } else {
              t = Math.min(1, (now - t0) / 900)
              if (t >= 1 && !committed) {
                committed = true
                onDone()
              }
            }
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.clearRect(0, 0, cw, ch)
            if (book) {
              if (under) ctx.drawImage(under, dir > 0 ? rect.width : 0, padY, rect.width, rect.height)
              drawCurl(ctx, img, t, dir, rect.width, rect.height, padY, !!ctl)
            } else {
              // Slide / Scroll: iki sayfa şerit gibi parmakla birlikte kayar
              const vert = turn.mode === "vertical"
              const len = vert ? rect.height : rect.width
              const off = t * len
              const place = (im: HTMLImageElement, o: number) => (vert ? ctx.drawImage(im, 0, o, rect.width, rect.height) : ctx.drawImage(im, o, 0, rect.width, rect.height))
              if (under) place(under, dir * (len - off))
              ctx.save()
              ctx.shadowColor = "rgba(40,25,35,0.35)"
              ctx.shadowBlur = 24
              place(img, -dir * off)
              ctx.restore()
            }
            raf = requestAnimationFrame(frame)
          }
          raf = requestAnimationFrame(frame)
        })
        .catch(onDone)
      return () => {
        alive = false
        cancelAnimationFrame(raf)
      }
    }
    const el = ref.current?.firstElementChild as HTMLElement | null
    if (!el) return onDone()
    const { mode } = turn
    const ease = "cubic-bezier(0.22, 1, 0.36, 1)"
    let frames: Keyframe[] = []
    let duration = 480
    if (mode === "slide") {
      frames = [{ transform: "translateX(0)" }, { transform: `translateX(${dir > 0 ? -104 : 104}%)` }]
    } else if (mode === "vertical") {
      frames = [{ transform: "translateY(0)" }, { transform: `translateY(${dir > 0 ? -104 : 104}%)` }]
    } else if (mode === "cards") {
      duration = 560
      frames = [
        { transform: "translateX(0) rotate(0deg) scale(1)", opacity: 1 },
        { transform: `translateX(${dir > 0 ? -118 : 118}%) rotate(${dir > 0 ? -9 : 9}deg) scale(0.94)`, opacity: 0.92 },
      ]
    } else {
      duration = 380
      frames = [{ opacity: 1 }, { opacity: 0 }]
    }
    const anim = el.animate(frames, { duration, easing: ease, fill: "forwards" })
    anim.onfinish = onDone
    anim.oncancel = onDone
    return () => anim.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn.key])

  if (canvasMode)
    return (
      <div className="pointer-events-none fixed z-[60]" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height, overflow: book ? "visible" : "hidden" }}>
        {book ? (
          <canvas ref={canvasRef} className="absolute" style={{ left: dir > 0 ? -rect.width : 0, top: -padY, width: rect.width * 2, height: rect.height + padY * 2 }} />
        ) : (
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        )}
      </div>
    )

  return (
    <div ref={ref} className="pointer-events-none fixed z-[60]" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={turn.img} alt="" draggable={false} className="h-full w-full rounded-sm shadow-lift" />
    </div>
  )
}
