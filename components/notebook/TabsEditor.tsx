"use client"

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { TAB_COLORS, tabTarget } from "./tabs"
import { Modal, btn, btnPrimary } from "@/components/ui"
import { TEMPLATES, uid, type Notebook, type NotebookSubTab, type NotebookTab } from "@/lib/types"
import { cn } from "@/lib/utils"

const PRESET: Omit<NotebookTab, "id">[] = [
  { label: "Project", emoji: "☁️", color: TAB_COLORS[0] },
  { label: "Tracker", emoji: "🍀", color: TAB_COLORS[1] },
  { label: "Expenses", emoji: "📒", color: TAB_COLORS[2] },
  { label: "Thoughts", emoji: "🩷", color: TAB_COLORS[3] },
  { label: "Journal", emoji: "📖", color: TAB_COLORS[4] },
]

/** Sekmeleri istediğin gibi oluştur: ad, emoji, renk ve gideceği sayfa. Her değişiklik anında kaydedilir. */
export default function TabsEditor({ nb, currentIndex, onChange, onHiddenChange, onClose }: { nb: Notebook; currentIndex: number; onChange: (tabs: NotebookTab[]) => void; onHiddenChange: (hidden: boolean) => void; onClose: () => void }) {
  const tabs = nb.tabs ?? []
  const upd = (id: string, patch: Partial<NotebookTab>) => onChange(tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= tabs.length) return
    const next = tabs.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  const pageName = (i: number) => {
    const p = nb.pages[i]
    return `${i + 1}. ${p.title || TEMPLATES.find((t) => t.id === p.template)?.label || p.template}`
  }
  const addSub = (id: string) => upd(id, { subs: [...(tabs.find((t) => t.id === id)?.subs ?? []), { id: uid(), label: "Section", emoji: "•", pageId: nb.pages[currentIndex]?.id }] })
  const updSub = (id: string, sid: string, patch: Partial<NotebookSubTab>) => upd(id, { subs: (tabs.find((t) => t.id === id)?.subs ?? []).map((x) => (x.id === sid ? { ...x, ...patch } : x)) })
  const delSub = (id: string, sid: string) => upd(id, { subs: (tabs.find((t) => t.id === id)?.subs ?? []).filter((x) => x.id !== sid) })
  const add = (preset?: Omit<NotebookTab, "id">) =>
    onChange([...tabs, { id: uid(), label: preset?.label ?? "New", emoji: preset?.emoji ?? "📌", color: preset?.color ?? TAB_COLORS[tabs.length % TAB_COLORS.length], pageId: nb.pages[currentIndex]?.id }])

  return (
    <Modal title="Tabs" onClose={onClose} wide>
      <p className="mb-3 text-sm text-ink-soft">Tapping a tab jumps to the page you choose; add sub-categories to give one tab several destinations. Set the name, emoji, color and target page yourself.</p>
      <label className="mb-4 flex items-center gap-2 text-sm font-medium text-ink">
        <input type="checkbox" className="h-5 w-5 accent-primary" checked={!nb.tabsHidden} onChange={(e) => onHiddenChange(!e.target.checked)} />
        Show tab bar
      </label>

      <div className="space-y-3">
        {tabs.map((tb, i) => {
          const target = tabTarget(tb, nb.pages)
          return (
            <div key={tb.id} className="animate-pop rounded-xl border-2 border-line bg-cream p-3">
              <div className="flex items-center gap-2">
                <input value={tb.emoji ?? ""} onChange={(e) => upd(tb.id, { emoji: e.target.value.slice(0, 4) })} aria-label="Emoji" className="h-11 w-14 rounded-xl border-2 border-line bg-paper text-center text-xl outline-none focus:border-primary" placeholder="🙂" />
                <input value={tb.label} onChange={(e) => upd(tb.id, { label: e.target.value })} aria-label="Tab name" className="h-11 min-w-0 flex-1 rounded-xl border-2 border-line bg-paper px-3 text-sm font-semibold outline-none focus:border-primary" placeholder="Tab name" />
                <button className="press grid h-9 w-9 place-items-center rounded-xl bg-paper disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                  <ArrowUp size={16} />
                </button>
                <button className="press grid h-9 w-9 place-items-center rounded-xl bg-paper disabled:opacity-30" disabled={i === tabs.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                  <ArrowDown size={16} />
                </button>
                <button className="press grid h-9 w-9 place-items-center rounded-xl bg-rose-soft text-red-700" onClick={() => onChange(tabs.filter((t) => t.id !== tb.id))} aria-label="Delete tab">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {TAB_COLORS.map((c) => (
                  <button key={c} aria-label={c} onClick={() => upd(tb.id, { color: c })} className={cn("press h-7 w-7 rounded-full border-2", tb.color === c ? "scale-110 border-primary" : "border-white")} style={{ background: c }} />
                ))}
                <label className="press relative h-7 w-7 overflow-hidden rounded-full border-2 border-white" style={{ background: "conic-gradient(#f4b6c2,#f9cfa5,#f6e58d,#b8e0c0,#a9d6e5,#cbb7ea,#f4b6c2)" }}>
                  <input type="color" value={tb.color} onChange={(e) => upd(tb.id, { color: e.target.value })} className="absolute inset-0 opacity-0" aria-label="Custom color" />
                </label>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-ink-soft">Target page</span>
                <select value={target >= 0 ? nb.pages[target].id : ""} onChange={(e) => upd(tb.id, { pageId: e.target.value, pageIndex: undefined })} className="min-w-0 flex-1 rounded-xl border-2 border-line bg-paper px-2 py-2 text-xs" aria-label="Target page">
                  {target < 0 && <option value="">(page deleted)</option>}
                  {nb.pages.map((p, k) => (
                    <option key={p.id} value={p.id}>
                      {pageName(k)}
                    </option>
                  ))}
                </select>
                <button className="press rounded-xl bg-paper px-2.5 py-2 text-xs font-semibold" onClick={() => upd(tb.id, { pageId: nb.pages[currentIndex]?.id, pageIndex: undefined })}>
                  Current page
                </button>
              </div>
              <div className="mt-3 space-y-2 border-t-2 border-dashed border-line pt-3">
                {(tb.subs ?? []).map((sb) => {
                  const st = tabTarget(sb, nb.pages)
                  return (
                    <div key={sb.id} className="flex items-center gap-2 pl-3">
                      <input value={sb.emoji ?? ""} onChange={(e) => updSub(tb.id, sb.id, { emoji: e.target.value.slice(0, 4) })} aria-label="Sub emoji" className="h-9 w-11 rounded-lg border-2 border-line bg-paper text-center outline-none focus:border-primary" />
                      <input value={sb.label} onChange={(e) => updSub(tb.id, sb.id, { label: e.target.value })} aria-label="Sub-tab name" className="h-9 min-w-0 flex-1 rounded-lg border-2 border-line bg-paper px-2 text-xs font-semibold outline-none focus:border-primary" />
                      <select value={st >= 0 ? nb.pages[st].id : ""} onChange={(e) => updSub(tb.id, sb.id, { pageId: e.target.value, pageIndex: undefined })} className="w-40 rounded-lg border-2 border-line bg-paper px-1 py-2 text-xs" aria-label="Sub-tab page">
                        {st < 0 && <option value="">(page deleted)</option>}
                        {nb.pages.map((p, k) => (
                          <option key={p.id} value={p.id}>
                            {pageName(k)}
                          </option>
                        ))}
                      </select>
                      <button className="press grid h-8 w-8 place-items-center rounded-lg bg-rose-soft text-red-700" onClick={() => delSub(tb.id, sb.id)} aria-label="Delete sub-tab">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
                <button className="press ml-3 rounded-xl bg-paper px-3 py-1.5 text-xs font-semibold" onClick={() => addSub(tb.id)}>
                  + Add sub-category
                </button>
              </div>
            </div>
          )
        })}
        {tabs.length === 0 && <div className="rounded-xl border-2 border-dashed border-line p-6 text-center text-sm text-ink-soft">No tabs yet.</div>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className={btnPrimary} onClick={() => add()}>
          <Plus size={18} /> Add tab
        </button>
        {tabs.length === 0 && (
          <button className={btn} onClick={() => onChange(PRESET.map((p, k) => ({ ...p, id: uid(), pageId: nb.pages[Math.min(k, nb.pages.length - 1)]?.id })))}>
            Add preset tabs
          </button>
        )}
        <div className="flex-1" />
        <button className={btn} onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  )
}
