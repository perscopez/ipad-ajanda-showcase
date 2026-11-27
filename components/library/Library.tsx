"use client"

import { useState } from "react"
import { BookOpen, CheckSquare, Palette as PaletteIcon, ChevronRight, Cloud, CloudOff, CheckCircle2, FolderPlus, Palette, Plus, RefreshCw, Search, X } from "lucide-react"
import BookCard from "./BookCard"
import FolderCard from "./FolderCard"
import FolderModal from "./FolderModal"
import NotebookModal from "./NotebookModal"
import SyncModal from "./SyncModal"
import ThemeModal from "./ThemeModal"
import { btn, btnDanger, btnPrimary } from "@/components/ui"
import { useStore } from "@/lib/store"
import type { Folder, Notebook } from "@/lib/types"
import { cn } from "@/lib/utils"

export type Resume = { nbId: string; i: number } | null

type ModalState = null | { k: "theme" } | { k: "folder"; f?: Folder } | { k: "nb"; nb?: Notebook; folderId?: string | null } | { k: "sync" }

export default function Library({
  folderId,
  resume,
  onFolder,
  onOpen,
  onCover,
}: {
  folderId: string | null
  resume: Resume
  onFolder: (id: string | null) => void
  onOpen: (id: string, pageIndex?: number) => void
  onCover: (id: string) => void
}) {
  const { folders, notebooks, loaded, syncStatus, userEmail, deleteNotebooks, deleteFolders, moveNotebooks } = useStore()
  const [selecting, setSelecting] = useState(false)
  const [selF, setSelF] = useState<Set<string>>(new Set())
  const [selB, setSelB] = useState<Set<string>>(new Set())
  const flip = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const exitSelect = () => {
    setSelecting(false)
    setSelF(new Set())
    setSelB(new Set())
  }
  const [modal, setModal] = useState<ModalState>(null)
  const [search, setSearch] = useState("")

  const cur = folders.find((f) => f.id === folderId)
  const q = search.trim().toLocaleLowerCase("en")
  const visibleFolders = !cur ? folders.filter((f) => !q || f.name.toLocaleLowerCase("en").includes(q)) : []
  const books = notebooks.filter((n) => {
    if (q && !cur) return n.title.toLocaleLowerCase("en").includes(q)
    return n.folderId === (cur ? cur.id : null) && (!q || n.title.toLocaleLowerCase("en").includes(q))
  })
  const resumeNb = resume ? notebooks.find((n) => n.id === resume.nbId) : undefined

  if (!loaded)
    return (
      <div className="grid h-full place-items-center text-ink-soft">
        <div className="animate-float text-4xl">📖</div>
      </div>
    )

  const syncLabel = syncStatus === "syncing" ? "Syncing…" : syncStatus === "synced" ? (userEmail ?? "Synced") : syncStatus === "offline" ? "Offline" : syncStatus === "error" ? "Sync error" : "Cloud"

  return (
    <div className="h-full overflow-y-auto px-5 pb-20 pt-[max(20px,env(safe-area-inset-top))] sm:px-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-center gap-2.5 py-4">
          <nav className="flex min-w-0 flex-1 items-center gap-1 font-serif text-4xl font-bold tracking-tight">
            <button onClick={() => onFolder(null)} className={cn("press", cur && "text-ink-soft/70")}>
              My Library
            </button>
            {cur && (
              <>
                <ChevronRight className="text-ink-soft/70" />
                <span className="animate-pop truncate">{cur.name}</span>
              </>
            )}
          </nav>

          <button onClick={() => setModal({ k: "theme" })} className={btn} aria-label="Theme colors">
            <PaletteIcon size={18} /> Theme
          </button>
          <button onClick={() => (selecting ? exitSelect() : setSelecting(true))} className={selecting ? btnDanger : btn}>
            <CheckSquare size={18} /> {selecting ? "Cancel" : "Select"}
          </button>
          <button
            onClick={() => setModal({ k: "sync" })}
            className={cn(btn, "h-10 text-xs", syncStatus === "synced" && "bg-mint/40 hover:bg-mint/60", syncStatus === "error" && "bg-rose-soft text-red-700")}
            title="Multi-device sync and QR sign-in"
          >
            {syncStatus === "syncing" ? <RefreshCw size={15} className="animate-spin" /> : syncStatus === "synced" ? <CheckCircle2 size={15} /> : syncStatus === "offline" ? <CloudOff size={15} /> : <Cloud size={15} />}
            <span className="max-w-[140px] truncate">{syncLabel}</span>
          </button>
          {cur ? (
            <button onClick={() => setModal({ k: "folder", f: cur })} className={btn}>
              <Palette size={18} /> Edit folder
            </button>
          ) : (
            <button onClick={() => setModal({ k: "folder" })} className={btn}>
              <FolderPlus size={18} /> Folder
            </button>
          )}
          <button onClick={() => setModal({ k: "nb" })} className={btnPrimary}>
            <Plus size={18} /> Notebook
          </button>
        </header>

        {resumeNb && !cur && !q && (
          <button
            onClick={() => onOpen(resumeNb.id, Math.min(resume!.i, resumeNb.pages.length - 1))}
            className="press mb-6 flex w-full animate-rise items-center gap-4 rounded-2xl bg-paper/80 p-3 pr-5 text-left shadow-soft hover:bg-paper"
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-cream-deep text-center text-3xl leading-[4rem]">
              <BookOpen size={28} className="mx-auto mt-[18px] text-ink-soft" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium uppercase tracking-wide text-ink-soft">Continue where you left off</div>
              <div className="truncate font-serif text-lg font-semibold">{resumeNb.title}</div>
              <div className="text-sm text-ink-soft">Page {Math.min(resume!.i, resumeNb.pages.length - 1) + 1} / {resumeNb.pages.length}</div>
            </div>
            <ChevronRight className="text-ink-soft" />
          </button>
        )}

        {(folders.length > 0 || notebooks.length > 1) && (
          <div className="relative mb-8">
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-soft/70" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={cur ? `Search in ${cur.name}…` : "Search notebooks or folders…"}
              className="w-full rounded-full border border-line bg-paper/80 py-3 pl-11 pr-10 text-sm outline-none transition focus:border-primary focus:bg-paper focus:ring-4 focus:ring-primary/20"
            />
            {search && (
              <button onClick={() => setSearch("")} className="press absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-soft/70" aria-label="Clear search">
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {visibleFolders.length > 0 && (
          <section className="mb-12 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 md:grid-cols-4">
            {visibleFolders.map((f, i) => (
              <FolderCard key={f.id} folder={f} index={i} count={notebooks.filter((n) => n.folderId === f.id).length} onOpen={() => (selecting ? flip(setSelF, f.id) : onFolder(f.id))} onEdit={() => setModal({ k: "folder", f })} selecting={selecting} selected={selF.has(f.id)} />
            ))}
          </section>
        )}

        <section className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 md:grid-cols-4">
          {books.map((nb, i) => (
            <BookCard key={nb.id} nb={nb} index={i + visibleFolders.length} onOpen={() => (selecting ? flip(setSelB, nb.id) : onOpen(nb.id))} onEdit={() => setModal({ k: "nb", nb })} selecting={selecting} selected={selB.has(nb.id)} />
          ))}
        </section>

        {books.length === 0 && (
          <div className="animate-rise py-20 text-center text-ink-soft">
            <div className="mb-3 animate-float text-5xl">{q ? "🔍" : "🌷"}</div>
            {q ? "No results match your search." : cur || folders.length === 0 ? "No notebooks yet. Start with “+ Notebook”." : null}
          </div>
        )}
      </div>

      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="flex animate-pop flex-wrap items-center gap-2 rounded-2xl border-2 border-primary bg-paper p-2 shadow-lift">
            <span className="px-2 text-sm font-semibold tabular-nums">
              {selF.size} folders · {selB.size} notebooks
            </span>
            <button
              className={btn}
              onClick={() => {
                setSelF(new Set(visibleFolders.map((f) => f.id)))
                setSelB(new Set(books.map((b) => b.id)))
              }}
            >
              Select all
            </button>
            <select
              aria-label="Move selected notebooks"
              disabled={!selB.size}
              value=""
              onChange={(e) => {
                const v = e.target.value
                if (!v) return
                moveNotebooks([...selB], v === "__root" ? null : v)
                exitSelect()
              }}
              className="h-11 rounded-xl border-2 border-primary bg-paper px-3 text-sm font-semibold disabled:opacity-40"
            >
              <option value="">Move notebooks…</option>
              <option value="__root">Library (no folder)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.emoji} {f.name}
                </option>
              ))}
            </select>
            <button
              className={btnDanger}
              disabled={!selF.size && !selB.size}
              onClick={() => {
                if (confirm(`${selF.size} folders (their notebooks move to the library) and ${selB.size} notebooks will be permanently deleted. Continue?`)) {
                  deleteNotebooks([...selB])
                  deleteFolders([...selF])
                  exitSelect()
                }
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {modal?.k === "folder" && <FolderModal folder={modal.f} onClose={() => setModal(null)} />}
      {modal?.k === "nb" && (
        <NotebookModal
          nb={modal.nb}
          folderId={modal.folderId !== undefined ? modal.folderId : (cur?.id ?? null)}
          onClose={() => setModal(null)}
          onCover={modal.nb ? () => onCover(modal.nb!.id) : undefined}
          onCreated={(id) => onOpen(id)}
        />
      )}
      {modal?.k === "sync" && <SyncModal onClose={() => setModal(null)} />}
      {modal?.k === "theme" && <ThemeModal onClose={() => setModal(null)} />}
    </div>
  )
}
