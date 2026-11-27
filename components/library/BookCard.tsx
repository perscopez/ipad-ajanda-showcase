"use client"

import { Check, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import PageThumb from "@/components/notebook/PageThumb"
import type { Notebook } from "@/lib/types"

/** Kapak resmi + sırt gölgesi; dokununca hafifçe eğilip yükselir. */
export function Book({ nb, width = 200 }: { nb: Notebook; width?: number }) {
  return (
    <div className="relative overflow-hidden rounded-l-md rounded-r-2xl shadow-lift" style={{ width }}>
      <PageThumb page={nb.cover} width={width} className="block" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[9%] bg-gradient-to-r from-black/25 via-black/5 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-[9%] w-px bg-paper/40" />
      <div className="pointer-events-none absolute inset-0 rounded-r-2xl bg-gradient-to-br from-white/25 via-transparent to-transparent" />
    </div>
  )
}

export default function BookCard({ nb, index = 0, onOpen, onEdit, selecting, selected }: { nb: Notebook; index?: number; onOpen: () => void; onEdit: () => void; selecting?: boolean; selected?: boolean }) {
  return (
    <div className={cn("group relative flex animate-rise flex-col items-center gap-2.5 rounded-2xl p-1 transition-colors", selected && "bg-primary/10 ring-4 ring-primary/30")} style={{ animationDelay: `${Math.min(index, 10) * 70}ms` }}>
      <button onClick={onOpen} className="press [perspective:900px]" aria-label={`Open ${nb.title} notebook`}>
        <div className="transition-transform duration-500 ease-soft group-hover:[transform:rotateY(-10deg)_translateY(-6px)] group-hover:drop-shadow-xl">
          <Book nb={nb} width={170} />
        </div>
      </button>
      <div className="text-center">
        <div className="max-w-[170px] truncate font-serif text-base font-semibold text-ink">{nb.title}</div>
        <div className="text-xs text-ink-soft">{nb.pages.length} pages</div>
      </div>
      {selecting ? (
        <span className={cn("pointer-events-none absolute right-0 top-0 grid h-7 w-7 place-items-center rounded-full border-2 border-primary", selected ? "bg-primary text-primary-foreground" : "bg-paper")}>{selected && <Check size={16} />}</span>
      ) : (
        <button aria-label="Edit notebook" onClick={onEdit} className="press absolute -right-1 -top-2 rounded-full bg-paper p-1.5 text-ink-soft opacity-90 shadow-soft">
          <MoreHorizontal size={16} />
        </button>
      )}
    </div>
  )
}
