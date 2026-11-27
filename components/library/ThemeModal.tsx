"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { Modal, btn } from "@/components/ui"
import { DEFAULT_THEME, THEME_PRESETS, loadTheme, resetTheme, saveTheme, type ThemeColors } from "@/lib/theme"
import { cn } from "@/lib/utils"

const same = (a: ThemeColors, b: ThemeColors) => a.bg === b.bg && a.card === b.card && a.accent === b.accent && a.text === b.text

/** Hazır temalar ya da 4 rengi kendin seç; seçim anında uygulanır ve bu cihazda saklanır. */
export default function ThemeModal({ onClose }: { onClose: () => void }) {
  const [c, setC] = useState<ThemeColors>(() => loadTheme() ?? DEFAULT_THEME)
  const set = (patch: Partial<ThemeColors>) => {
    const next = { ...c, ...patch }
    setC(next)
    saveTheme(next)
  }
  const fields: [keyof ThemeColors, string][] = [
    ["bg", "Background"],
    ["card", "Cards & panels"],
    ["accent", "Accent (buttons, borders)"],
    ["text", "Text"],
  ]
  return (
    <Modal title="Theme colors" onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {THEME_PRESETS.map((p) => {
          const on = same(c, p.colors)
          return (
            <button
              key={p.id}
              onClick={() => {
                setC(p.colors)
                saveTheme(p.colors)
              }}
              className={cn("press relative overflow-hidden rounded-xl border-2 p-2.5 text-left", on ? "border-primary" : "border-line")}
              style={{ background: p.colors.bg }}
            >
              <div className="mb-2 flex gap-1.5">
                {[p.colors.card, p.colors.accent, p.colors.text].map((col, i) => (
                  <span key={i} className="h-6 w-6 rounded-full border border-black/10" style={{ background: col }} />
                ))}
              </div>
              <div className="text-sm font-semibold" style={{ color: p.colors.text }}>
                {p.name}
              </div>
              {on && (
                <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full text-white" style={{ background: p.colors.accent }}>
                  <Check size={13} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-5 text-xs font-bold uppercase tracking-wide text-ink-soft">Your own colors</div>
      <div className="mt-2 grid grid-cols-2 gap-2.5">
        {fields.map(([key, label]) => (
          <label key={key} className="flex items-center gap-3 rounded-xl border-2 border-line bg-paper p-2.5">
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-white shadow-soft" style={{ background: c[key] as string }}>
              <input type="color" value={c[key] as string} onChange={(e) => set({ [key]: e.target.value })} className="absolute inset-0 opacity-0" aria-label={label} />
            </span>
            <span className="text-sm font-medium leading-tight">{label}</span>
          </label>
        ))}
      </div>

      <div className="mt-5 flex justify-between gap-2">
        <button
          className={btn}
          onClick={() => {
            resetTheme()
            setC(DEFAULT_THEME)
          }}
        >
          Reset to default
        </button>
        <button className={btn} onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  )
}
