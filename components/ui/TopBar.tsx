"use client"

import type { ReactNode } from "react"
import { ChevronLeft } from "lucide-react"
import { btn } from "./styles"

/** Defter, kapak, sayfa sıralama ve kitap görünümü aynı üst çubuğu kullanır. */
export default function TopBar({ onBack, backLabel = "Back", title, subtitle, children }: { onBack: () => void; backLabel?: string; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 pb-2 pt-[max(8px,env(safe-area-inset-top))]">
      <button className={btn} onClick={onBack}>
        <ChevronLeft size={18} /> {backLabel}
      </button>
      <div className="min-w-0 flex-1 px-1">
        <div className="truncate font-semibold text-ink">{title}</div>
        {subtitle && <div className="truncate text-xs text-ink-soft">{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}
