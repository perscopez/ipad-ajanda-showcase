"use client"

import { Check, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import FolderIcon from "./FolderIcon"
import type { Folder } from "@/lib/types"

export default function FolderCard({ folder, count, index = 0, onOpen, onEdit, selecting, selected }: { folder: Folder; count: number; index?: number; onOpen: () => void; onEdit: () => void; selecting?: boolean; selected?: boolean }) {
  return (
    <div className={cn("group relative flex animate-rise flex-col items-center rounded-2xl transition-colors", selected && "bg-primary/10 ring-4 ring-primary/30")} style={{ animationDelay: `${Math.min(index, 10) * 70}ms` }}>
      <button onClick={onOpen} className="press flex flex-col items-center gap-3 transition-transform duration-500 ease-soft group-hover:-translate-y-1" aria-label={`Open ${folder.name} folder`}>
        <FolderIcon folder={folder} count={count} size={150} />
        <span className="max-w-[10rem] truncate font-serif text-base font-semibold text-ink">{folder.name}</span>
        <span className="-mt-1.5 rounded-full bg-paper/80 px-3 py-0.5 text-xs font-medium text-ink-soft shadow-soft">{folder.meta || `${count} notebooks`}</span>
      </button>
      {selecting ? (
        <span className={cn("pointer-events-none absolute right-3 top-0 grid h-7 w-7 place-items-center rounded-full border-2 border-primary", selected ? "bg-primary text-primary-foreground" : "bg-paper")}>{selected && <Check size={16} />}</span>
      ) : (
        <button aria-label="Edit folder" onClick={onEdit} className="press absolute right-2 top-0 rounded-full bg-paper p-1.5 text-ink-soft shadow-soft">
          <MoreHorizontal size={16} />
        </button>
      )}
    </div>
  )
}
