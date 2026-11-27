"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { tabTarget } from "./tabs"
import type { NotebookTab, Page } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Defterin üstündeki renkli sekmeler: dokununca ilgili sayfaya gider. */
export default function TabsBar({ tabs, pages, activeIndex, onGo, onEdit }: { tabs: NotebookTab[]; pages: Page[]; activeIndex: number; onGo: (i: number) => void; onEdit: () => void }) {
  const [open, setOpen] = useState<string | null>(null)
  // Aktif sayfa bir sekmenin (veya alt sekmesinin) sayfasıysa o grup açık kalır.
  const owner = tabs.find((tb) => tabTarget(tb, pages) === activeIndex || (tb.subs ?? []).some((s) => tabTarget(s, pages) === activeIndex))
  const openId = open && tabs.some((t) => t.id === open && t.subs?.length) ? open : owner?.id
  const group = tabs.find((t) => t.id === openId && t.subs?.length)
  return (
    <div>
    <div className="flex items-end gap-1 overflow-x-auto px-3 pt-1 [scrollbar-width:none]" role="tablist" aria-label="Notebook tabs">
      {tabs.map((tb) => {
        const idx = tabTarget(tb, pages)
        const active = idx === activeIndex && idx >= 0
        return (
          <button
            key={tb.id}
            role="tab"
            aria-selected={active}
            disabled={idx < 0}
            onClick={() => {
              setOpen(tb.subs?.length ? (openId === tb.id && active ? null : tb.id) : null)
              onGo(idx)
            }}
            title={idx < 0 ? "Target page was deleted" : `Page ${idx + 1}`}
            className={cn(
              "press flex h-9 shrink-0 items-center gap-1.5 rounded-t-xl border-2 border-b-0 px-3.5 text-[11px] font-bold uppercase tracking-wider transition-[background-color,box-shadow,transform] duration-300 ease-soft disabled:opacity-40",
              active ? "-mb-px h-10 border-primary bg-paper text-ink shadow-soft" : "border-primary/30 text-ink/80 hover:-translate-y-0.5",
            )}
            style={active ? undefined : { backgroundColor: tb.color }}
          >
            {tb.emoji && <span className="text-sm leading-none">{tb.emoji}</span>}
            <span>{tb.label}</span>
            {!!tb.subs?.length && <span className="text-[9px] opacity-60">{openId === tb.id ? "▾" : "▸"}</span>}
          </button>
        )
      })}
      <button onClick={onEdit} aria-label="Edit tabs" className="press mb-px grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-dashed border-primary/50 text-primary hover:bg-rose-soft" title="Add / edit tabs">
        <Plus size={16} />
      </button>
    </div>
    {group && (
      <div className="animate-pop flex items-center gap-1.5 overflow-x-auto border-b-2 border-primary/30 px-3 py-1.5 [scrollbar-width:none]" role="tablist" aria-label={`${group.label} sections`} style={{ backgroundColor: `color-mix(in srgb, ${group.color} 45%, transparent)` }}>
        {(group.subs ?? []).map((sb) => {
          const si = tabTarget(sb, pages)
          const on = si === activeIndex && si >= 0
          return (
            <button key={sb.id} role="tab" aria-selected={on} disabled={si < 0} onClick={() => onGo(si)} title={si < 0 ? "Target page was deleted" : `Page ${si + 1}`} className={cn("press flex h-8 shrink-0 items-center gap-1 rounded-full border-2 px-3 text-[11px] font-semibold disabled:opacity-40", on ? "border-primary bg-paper text-ink shadow-soft" : "border-transparent bg-paper/60 text-ink/80")}>
              {sb.emoji && <span className="text-sm leading-none">{sb.emoji}</span>}
              {sb.label}
            </button>
          )
        })}
      </div>
    )}
    </div>
  )
}
