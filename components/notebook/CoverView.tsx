"use client"

import { ChevronLeft } from "lucide-react"
import Editor from "@/components/editor/Editor"
import { useStore } from "@/lib/store"
import { type Notebook } from "@/lib/types"
import { btn } from "@/components/ui"

export default function CoverView({ nb, onBack }: { nb: Notebook; onBack: () => void }) {
  const { setPage, customStickers, addCustomSticker, deleteCustomSticker } = useStore()
  return (
    <div className="h-full">
      <Editor
        key={nb.id + "cover"}
        initial={nb.cover}
        onChange={(p) => setPage(nb.id, "cover", p)}
        customStickers={customStickers}
        onSaveCustomSticker={addCustomSticker}
        onDeleteCustomSticker={deleteCustomSticker}
        bar={
          <div className="flex items-center gap-2 px-3 pb-2 pt-[max(8px,env(safe-area-inset-top))]">
            <button className={btn} onClick={onBack}>
              <ChevronLeft size={18} /> Done
            </button>
            <span className="truncate font-semibold">Cover design · {nb.title}</span>
          </div>
        }
      />
    </div>
  )
}

