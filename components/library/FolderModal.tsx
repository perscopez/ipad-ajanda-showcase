"use client"

import { useRef, useState } from "react"
import { ImagePlus } from "lucide-react"
import FolderIcon from "./FolderIcon"
import { Modal, Swatches, btnDanger, btnPrimary, field, label } from "@/components/ui"
import { fileToDataUrl } from "@/lib/render"
import { useStore } from "@/lib/store"
import type { Folder } from "@/lib/types"

export const FOLDER_COLORS = ["#f4b6c2", "#f9cfa5", "#f6e58d", "#b8e0c0", "#a9d6e5", "#cbb7ea", "#e7c6d9", "#c9c9d6"]
const FOLDER_EMOJI = ["", "📚", "💼", "✈️", "💖", "🏠", "🎓", "🍳", "🌸", "🎨", "💪", "🎵", "🐱", "⭐"]

export default function FolderModal({ folder, onClose }: { folder?: Folder; onClose: () => void }) {
  const { addFolder, updateFolder, deleteFolder, notebooks } = useStore()
  const [f, setF] = useState<Omit<Folder, "id">>({
    name: folder?.name ?? "",
    color: folder?.color ?? FOLDER_COLORS[0],
    frontColor: folder?.frontColor,
    emoji: folder?.emoji ?? "📚",
    image: folder?.image,
    frame: folder?.frame,
    meta: folder?.meta,
  })
  const file = useRef<HTMLInputElement>(null)
  const count = folder ? notebooks.filter((n) => n.folderId === folder.id).length : 0

  return (
    <Modal title={folder ? "Edit folder" : "New folder"} onClose={onClose}>
      <div className="flex justify-center py-3">
        <FolderIcon folder={f} size={170} count={Math.max(count, 2)} />
      </div>

      <label className={label}>Name</label>
      <input className={field} value={f.name} placeholder="Folder name" onChange={(e) => setF({ ...f, name: e.target.value })} />

      <label className={label}>Back color</label>
      <Swatches colors={FOLDER_COLORS} value={f.color} onPick={(color) => setF({ ...f, color })} />

      <label className={label}>Front color</label>
      <div className="flex flex-wrap items-center gap-2.5">
        <button onClick={() => setF({ ...f, frontColor: undefined })} className={`press rounded-full px-4 py-2 text-sm ${!f.frontColor ? "bg-primary text-primary-foreground" : "bg-cream-deep text-ink-soft"}`}>
          Otomatik
        </button>
        <Swatches colors={FOLDER_COLORS} value={f.frontColor ?? ""} onPick={(frontColor) => setF({ ...f, frontColor })} />
      </div>

      <label className={label}>Icon</label>
      <div className="flex flex-wrap gap-2">
        {FOLDER_EMOJI.map((em) => (
          <button key={em || "none"} onClick={() => setF({ ...f, emoji: em, image: undefined })} className={`press h-11 w-11 rounded-2xl border text-2xl ${!f.image && f.emoji === em ? "border-primary bg-paper" : "border-line bg-cream"}`}>
            {em || "∅"}
          </button>
        ))}
        <button onClick={() => file.current?.click()} className="press flex h-11 items-center gap-1.5 rounded-2xl border border-line bg-paper px-3 text-sm">
          <ImagePlus size={18} /> Photo
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const x = e.target.files?.[0]
            if (x) setF({ ...f, image: (await fileToDataUrl(x, 600)).src })
          }}
        />
      </div>
      {f.image && (
        <label className="mt-4 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={!!f.frame} onChange={(e) => setF({ ...f, frame: e.target.checked })} className="h-5 w-5 accent-primary" />
          Show the folder shape behind the picture
        </label>
      )}

      <div className="mt-7 flex gap-2">
        {folder && (
          <button
            className={btnDanger}
            onClick={() => {
              if (confirm("Delete this folder? Its notebooks are not deleted, they move to the library.")) {
                deleteFolder(folder.id)
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
            const data = { ...f, name: f.name.trim() || "Folder" }
            if (folder) updateFolder(folder.id, data)
            else addFolder(data)
            onClose()
          }}
        >
          {folder ? "Save" : "Create"}
        </button>
      </div>
    </Modal>
  )
}
