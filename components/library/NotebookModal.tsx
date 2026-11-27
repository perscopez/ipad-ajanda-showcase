"use client"

import { useState } from "react"
import { Palette } from "lucide-react"
import { Modal, Swatches, btn, btnDanger, btnPrimary, choice, field, label } from "@/components/ui"
import { COVER_COLORS, useStore } from "@/lib/store"
import type { Notebook, Orient } from "@/lib/types"

export default function NotebookModal({ nb, folderId, onClose, onCover, onCreated }: { nb?: Notebook; folderId: string | null; onClose: () => void; onCover?: () => void; onCreated?: (id: string) => void }) {
  const { folders, addNotebook, updateNotebook, deleteNotebook } = useStore()
  const [title, setTitle] = useState(nb?.title ?? "")
  const [fid, setFid] = useState<string | null>(nb ? nb.folderId : folderId)
  const [preset, setPreset] = useState<"ajanda" | "bos">("ajanda")
  const [orient, setOrient] = useState<Orient>("landscape")
  const [color, setColor] = useState(COVER_COLORS[0])

  return (
    <Modal title={nb ? "Edit notebook" : "New notebook"} onClose={onClose}>
      <label className={label}>Name</label>
      <input className={field} value={title} placeholder="e.g. 2026 Planner, Travel journal…" onChange={(e) => setTitle(e.target.value)} />

      <label className={label}>Folder</label>
      <select className={field} value={fid ?? ""} onChange={(e) => setFid(e.target.value || null)}>
        <option value="">Library (no folder)</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.emoji} {f.name}
          </option>
        ))}
      </select>

      {!nb && (
        <>
          <label className={label}>Page orientation</label>
          <div className="grid grid-cols-2 gap-2">
            {([["landscape", "Landscape", "For holding the iPad sideways"], ["portrait", "Portrait", "Tall, book-like page"]] as const).map(([id, t, d]) => (
              <button key={id} onClick={() => setOrient(id)} className={choice(orient === id)}>
                <div className="font-semibold">{t}</div>
                <div className="text-xs text-ink-soft">{d}</div>
              </button>
            ))}
          </div>
          <label className={label}>Contents</label>
          <div className="grid grid-cols-2 gap-2">
            {([["ajanda", "Planner", "Weekly, monthly, daily and tracker pages"], ["bos", "Blank notebook", "Dotted pages only"]] as const).map(([id, t, d]) => (
              <button key={id} onClick={() => setPreset(id)} className={choice(preset === id)}>
                <div className="font-semibold">{t}</div>
                <div className="text-xs text-ink-soft">{d}</div>
              </button>
            ))}
          </div>
          <label className={label}>Cover color (you can fully design it later)</label>
          <Swatches colors={COVER_COLORS} value={color} onPick={setColor} />
        </>
      )}

      {nb && onCover && (
        <button onClick={onCover} className={btn + " mt-5 w-full"}>
          <Palette size={18} /> Design the cover
        </button>
      )}

      <div className="mt-7 flex gap-2">
        {nb && (
          <button
            className={btnDanger}
            onClick={() => {
              if (confirm("Permanently delete this notebook and all its pages?")) {
                deleteNotebook(nb.id)
                onClose()
              }
            }}
          >
            Delete
          </button>
        )}
        <button
          className={btnPrimary + " flex-1"}
          onClick={() => {
            const t = title.trim() || "Untitled notebook"
            if (nb) updateNotebook(nb.id, { title: t, folderId: fid })
            else onCreated?.(addNotebook(t, fid, preset, color, orient))
            onClose()
          }}
        >
          {nb ? "Save" : "Create"}
        </button>
      </div>
    </Modal>
  )
}
