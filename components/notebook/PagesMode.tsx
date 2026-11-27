"use client"

import { useState } from "react"
import { ArrowLeft, ArrowRight, Check, CheckSquare, ChevronLeft, Copy, FilePlus2, Trash2, X } from "lucide-react"
import PageThumb from "./PageThumb"
import { useStore } from "@/lib/store"
import { type Notebook } from "@/lib/types"
import { btn, btnDanger } from "@/components/ui"
import { cn } from "@/lib/utils"

export default function PagesMode({
  nb,
  current,
  onClose,
  onOpen,
  onAdd,
}: {
  nb: Notebook
  current: number
  onClose: () => void
  onOpen: (i: number) => void
  onAdd: () => void
}) {
  const { movePage, duplicatePage, deletePages, deletePagesByIds, duplicatePagesByIds } = useStore()
  const [selecting, setSelecting] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const n = nb.pages.length
  const small = "press flex h-11 w-11 items-center justify-center rounded-xl border-2 border-primary bg-paper shadow-soft disabled:opacity-30"
  const toggle = (id: string) =>
    setSel((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const exit = () => {
    setSelecting(false)
    setSel(new Set())
  }

  return (
    <div className="flex h-full animate-screen flex-col bg-cream-deep">
      <div className="flex items-center gap-2 px-3 pb-2 pt-[max(8px,env(safe-area-inset-top))]">
        <button className={btn} onClick={onClose}>
          <ChevronLeft size={18} /> Back
        </button>
        <span className="flex-1 truncate font-semibold">
          {nb.title} · {n} pages
        </span>
        <button className={selecting ? btnDanger : btn} onClick={() => (selecting ? exit() : setSelecting(true))}>
          {selecting ? <X size={18} /> : <CheckSquare size={18} />} {selecting ? "Cancel" : "Select"}
        </button>
        {!selecting && (
          <button className={btn} onClick={onAdd}>
            <FilePlus2 size={18} /> Add custom page
          </button>
        )}
      </div>
      <p className="px-4 pb-2 text-sm text-ink-soft">{selecting ? "Tap several pages to select them, then delete or duplicate in bulk." : "Move pages left/right with the arrow buttons. Tap a page to open it."}</p>
      <div className="grid flex-1 grid-cols-2 content-start gap-x-4 gap-y-6 overflow-y-auto px-4 pb-28 sm:grid-cols-3 md:grid-cols-4">
        {nb.pages.map((p, k) => {
          const on = sel.has(p.id)
          return (
            <div key={p.id} className="flex animate-rise flex-col items-center gap-2" style={{ animationDelay: `${Math.min(k, 12) * 35}ms` }}>
              <button
                onClick={() => (selecting ? toggle(p.id) : onOpen(k))}
                className={cn("press relative w-full overflow-hidden rounded-md border-2 shadow-soft", on ? "border-primary ring-4 ring-primary/30" : k === current && !selecting ? "border-primary" : "border-transparent")}
              >
                <PageThumb page={p} width={240} className="block" />
                {selecting && (
                  <span className={cn("absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border-2 border-primary", on ? "bg-primary text-primary-foreground" : "bg-paper")}>
                    {on && <Check size={16} />}
                  </span>
                )}
              </button>
              <span className="text-sm font-medium tabular-nums">{k + 1}</span>
              {!selecting && (
                <div className="flex gap-1.5">
                  <button className={small} disabled={k === 0} onClick={() => movePage(nb.id, k, k - 1)} aria-label="Move left">
                    <ArrowLeft size={18} />
                  </button>
                  <button className={small} disabled={k === n - 1} onClick={() => movePage(nb.id, k, k + 1)} aria-label="Move right">
                    <ArrowRight size={18} />
                  </button>
                  <button className={small} onClick={() => duplicatePage(nb.id, k)} aria-label="Duplicate">
                    <Copy size={18} />
                  </button>
                  <button
                    className={small}
                    disabled={n === 1}
                    onClick={() => {
                      if (confirm(`Delete page ${k + 1}?`)) deletePages(nb.id, k, 1)
                    }}
                    aria-label="Delete"
                  >
                    <Trash2 size={18} className="text-red-600" />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="flex animate-pop flex-wrap items-center gap-2 rounded-2xl border-2 border-primary bg-paper p-2 shadow-lift">
            <span className="px-2 text-sm font-semibold tabular-nums">{sel.size} selected</span>
            <button className={btn} onClick={() => setSel(new Set(nb.pages.map((p) => p.id)))}>
              Select all
            </button>
            <button className={btn} disabled={!sel.size} onClick={() => setSel(new Set())}>
              Clear selection
            </button>
            <button
              className={btn}
              disabled={!sel.size}
              onClick={() => {
                duplicatePagesByIds(nb.id, [...sel])
                exit()
              }}
            >
              <Copy size={17} /> Duplicate
            </button>
            <button
              className={btnDanger}
              disabled={!sel.size}
              onClick={() => {
                if (confirm(`Permanently delete ${sel.size} pages?`)) {
                  deletePagesByIds(nb.id, [...sel])
                  exit()
                }
              }}
            >
              <Trash2 size={17} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
