"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import JournalSpreadCarousel, { type JournalAction, type JournalSpread } from "@/components/ui/journal-spread-carousel"
import { useStore } from "@/lib/store"
import { type Notebook } from "@/lib/types"
import { spreadImage } from "./spread-image"
import { btn } from "@/components/ui"

export default function SpreadMode({
  nb,
  onClose,
  onOpenPage,
  onCover,
}: {
  nb: Notebook
  onClose: () => void
  onOpenPage: (i: number) => void
  onCover: () => void
}) {
  const { addPages, deletePages } = useStore()
  const [spreads, setSpreads] = useState<JournalSpread[] | null>(null)
  const [cur, setCur] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const out: JournalSpread[] = [{ id: "cover", label: "Cover", image: await spreadImage(null, nb.cover) }]
      for (let k = 0; k < nb.pages.length; k += 2) {
        out.push({
          id: nb.pages[k].id,
          label: `Page ${k + 1}–${Math.min(k + 2, nb.pages.length)}`,
          image: await spreadImage(nb.pages[k], nb.pages[k + 1] ?? null),
        })
      }
      if (alive) setSpreads(out)
    })()
    return () => {
      alive = false
    }
  }, [nb.cover, nb.pages])

  const onAction = (a: JournalAction, idx: number) => {
    if (a === "add") addPages(nb.id, idx * 2, ["dots", "dots"])
    else if (a === "delete" && idx > 0 && confirm("Delete the pages in this spread?")) deletePages(nb.id, (idx - 1) * 2, 2)
  }
  const first = (cur - 1) * 2

  return (
    <div className="relative h-full bg-[#2d3149]">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-3 pt-[max(8px,env(safe-area-inset-top))]">
        <button className={btn} onClick={onClose}>
          <X size={18} /> Close
        </button>
        <div className="flex-1" />
        {cur === 0 ? (
          <button className={btn} onClick={onCover}>
            Edit cover
          </button>
        ) : (
          <>
            <button className={btn} onClick={() => onOpenPage(first)}>
              Open left page
            </button>
            {first + 1 < nb.pages.length && (
              <button className={btn} onClick={() => onOpenPage(first + 1)}>
                Open right page
              </button>
            )}
          </>
        )}
      </div>
      {spreads ? (
        <JournalSpreadCarousel
          spreads={spreads}
          title={nb.title}
          meta={`${nb.pages.length} pages`}
          height="100%"
          initialIndex={cur}
          onIndexChange={setCur}
          onAction={onAction}
          actions={["delete", "add"]}
          className="pt-12"
        />
      ) : (
        <div className="grid h-full place-items-center text-white/70">Preparing notebook…</div>
      )}
    </div>
  )
}

