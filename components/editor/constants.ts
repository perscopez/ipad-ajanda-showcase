import type { PenStyle } from "@/lib/types"

export const INK = ["#25252b", "#e5484d", "#f76b15", "#e5a50a", "#46a758", "#12a594", "#3e63dd", "#8e4ec6", "#e93d82", "#7a5c3e", "#8b8d98", "#ffffff"]
export const NEON = ["#fff35c", "#ff8ac2", "#7fe3ff", "#9dff9d", "#ffb866", "#d9a0ff"]

export const PEN_STYLES: { id: PenStyle; label: string; hint: string }[] = [
  { id: "fountain", label: "Fountain", hint: "Pressure sensitive" },
  { id: "ballpoint", label: "Ballpoint", hint: "Fixed width" },
  { id: "brush", label: "Brush", hint: "Thick & thin" },
  { id: "pencil", label: "Pencil", hint: "Thickens when tilted" },
  { id: "dashed", label: "Dashed", hint: "Dashed" },
]
