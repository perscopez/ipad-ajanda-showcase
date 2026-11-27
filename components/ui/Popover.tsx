"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Açılır panel: dışarı dokununca kapanır, yumuşakça belirir. Konumu className ile verilir. */
export default function Popover({ open, onClose, className, children }: { open: boolean; onClose: () => void; className?: string; children: ReactNode }) {
  if (!open) return null
  return (
    <>
      <div className="pointer-events-auto fixed inset-0 z-30" onPointerDown={onClose} />
      <div className={cn("pointer-events-auto absolute z-40 animate-pop rounded-2xl border-2 border-primary bg-paper p-3 shadow-lift", className)}>{children}</div>
    </>
  )
}
