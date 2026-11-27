"use client"

import { useState, type ReactNode } from "react"
import Popover from "./Popover"
import { btn } from "./styles"
import { cn } from "@/lib/utils"

export type MenuItem = { heading: string } | { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean; hint?: string } | "divider"

/** Tek tuşla açılan liste menüsü (üst çubuktaki “⋯” gibi). */
export default function Menu({ trigger, label, items, align = "right", side = "down", className }: { trigger: ReactNode; label: string; items: MenuItem[]; align?: "left" | "right"; side?: "up" | "down"; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button className={cn(btn, className)} aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className={cn("max-h-[72dvh] w-64 overflow-y-auto p-1.5", align === "right" ? "right-0" : "left-0", side === "down" ? "top-full mt-2" : "bottom-full mb-2")}>
        {items.map((it, i) =>
          typeof it === "object" && "heading" in it ? (
            <div key={i} className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
              {it.heading}
            </div>
          ) : it === "divider" ? (
            <div key={i} className="mx-2 my-1 h-px bg-line" />
          ) : (
            <button
              key={it.label}
              disabled={it.disabled}
              onClick={() => {
                setOpen(false)
                it.onSelect()
              }}
              className={cn("press flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium hover:bg-rose-soft disabled:opacity-40", it.danger ? "text-red-700" : "text-ink")}
            >
              <span className="grid h-5 w-5 place-items-center text-ink-soft">{it.icon}</span>
              <span className="flex-1">{it.label}</span>
              {it.hint && <span className="text-xs text-ink-soft">{it.hint}</span>}
            </button>
          ),
        )}
      </Popover>
    </div>
  )
}
