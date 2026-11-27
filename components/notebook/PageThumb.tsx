"use client"

import { useEffect, useRef } from "react"
import { renderPage } from "@/lib/render"
import { dims, type Page } from "@/lib/types"

/** Small raster preview of a page (used for covers). */
export default function PageThumb({ page, width = 240, className }: { page: Page; width?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let alive = true
    const k = (width / dims(page.orient).w) * Math.min(2, window.devicePixelRatio || 1)
    renderPage(page, k).then((c) => {
      const t = ref.current
      if (!alive || !t) return
      t.width = c.width
      t.height = c.height
      t.getContext("2d")!.drawImage(c, 0, 0)
    })
    return () => {
      alive = false
    }
  }, [page, width])
  return <canvas ref={ref} className={className} style={{ width: "100%", aspectRatio: `${dims(page.orient).w}/${dims(page.orient).h}` }} />
}
