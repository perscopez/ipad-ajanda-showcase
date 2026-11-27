"use client"

import type { ReactNode } from "react"
import { X } from "lucide-react"

/** Tüm pencereler aynı: arkaplan yumuşakça belirir, panel alttan kayarak gelir. */
export default function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div
      className="fixed inset-0 z-50 flex animate-fade items-end justify-center bg-ink/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`max-h-[92dvh] w-full animate-sheet overflow-y-auto rounded-t-2xl border-2 border-primary bg-paper p-5 shadow-lift sm:rounded-2xl ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="press rounded-full bg-cream-deep p-2 text-ink-soft">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
