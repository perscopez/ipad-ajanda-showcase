"use client"

import { useRef, useState } from "react"
import { BookmarkPlus, ImagePlus, X } from "lucide-react"
import PageThumb from "./PageThumb"
import { fileToDataUrl, PAPER } from "@/lib/render"
import { useStore } from "@/lib/store"
import { newPage, TEMPLATES, type CustomTemplate, type Orient, type Page, type PageConfig, type Template } from "@/lib/types"
import { cn } from "@/lib/utils"
import { MONTHS_TR, PAPER_SWATCHES } from "./constants"

export default function PageStudioModal({
  mode,
  initialPage,
  defaultOrient,
  onClose,
  onApply,
}: {
  mode: "add" | "edit"
  initialPage?: Page
  defaultOrient?: Orient
  onClose: () => void
  onApply: (draft: Page) => void
}) {
  const { customTemplates, addCustomTemplate, deleteCustomTemplate } = useStore()
  const [template, setTemplate] = useState<Template>(initialPage?.template ?? "ivory_week")
  const [orient, setOrient] = useState<Orient>(initialPage?.orient ?? defaultOrient ?? "landscape")
  const [bg, setBg] = useState<string>(initialPage?.bg ?? PAPER)
  const [cfg, setCfg] = useState<PageConfig>(initialPage?.config ?? { spacing: 30, lineWidth: 1.2, monthIndex: 3, year: 2026, startDayNum: 15 })
  const [tplName, setTplName] = useState("")
  const bgFileRef = useRef<HTMLInputElement>(null)

  const previewPage: Page = {
    id: initialPage?.id ?? "preview",
    orient,
    template,
    bg,
    config: cfg,
    strokes: initialPage?.strokes ?? [],
    items: initialPage?.items ?? [],
  }

  const applyCustomTpl = (ct: CustomTemplate) => {
    setTemplate(ct.template)
    if (ct.orient) setOrient(ct.orient)
    setBg(ct.bg ?? PAPER)
    setCfg(ct.config ? { ...ct.config } : {})
  }

  const handleSaveAsTemplate = () => {
    const name = tplName.trim() || window.prompt("Template name:", "My custom page")
    if (!name) return
    addCustomTemplate({
      name,
      orient,
      template,
      bg,
      config: { ...cfg },
    })
    setTplName("")
  }

  const updateCfg = (patch: Partial<PageConfig>) => setCfg((prev) => ({ ...prev, ...patch }))

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-lg font-bold text-ink">{mode === "add" ? "Create & add custom page" : "Customize page design"}</h2>
            <p className="text-xs text-ink-soft">Set the template, line spacing, background image, color and planner tabs</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-full bg-cream-deep p-2">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 md:grid-cols-[260px_1fr]">
          {/* Left: Live Preview & Quick Paper Controls */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-full max-w-[240px] overflow-hidden rounded-lg border border-line bg-paper shadow-soft">
              <PageThumb page={previewPage} width={240} className="block" />
            </div>

            <div className="grid w-full grid-cols-2 gap-1.5">
              {(
                [
                  ["landscape", "Landscape"],
                  ["portrait", "Portrait"],
                ] as const
              ).map(([id, lbl]) => (
                <button
                  key={id}
                  onClick={() => setOrient(id)}
                  className={cn(
                    "rounded-xl border py-2 text-xs font-semibold",
                    orient === id ? "border-primary bg-primary text-primary-foreground" : "border-line bg-paper text-ink",
                  )}
                >
                  {lbl}
                </button>
              ))}
            </div>

            <div className="w-full">
              <div className="mb-1.5 text-xs font-semibold text-ink-soft">Paper color</div>
              <div className="flex flex-wrap gap-1.5">
                {PAPER_SWATCHES.map((sw) => (
                  <button
                    key={sw.color}
                    onClick={() => setBg(sw.color)}
                    title={sw.label}
                    className={cn("h-7 w-7 rounded-full border-2", bg === sw.color ? "border-primary scale-110" : "border-line")}
                    style={{ background: sw.color }}
                  />
                ))}
                <label
                  className="relative h-7 w-7 overflow-hidden rounded-full border-2 border-line"
                  style={{ background: "conic-gradient(red,yellow,lime,aqua,blue,magenta,red)" }}
                  title="Custom color"
                >
                  <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="absolute inset-0 opacity-0" />
                </label>
              </div>
            </div>

            <button
              onClick={handleSaveAsTemplate}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-paper py-2.5 text-xs font-semibold text-ink active:bg-cream"
            >
              <BookmarkPlus size={15} /> Save to my templates
            </button>
          </div>

          {/* Right: Templates & Customization Controls */}
          <div className="space-y-4">
            {/* Saved Custom Templates */}
            {customTemplates.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">My saved templates</div>
                <div className="flex flex-wrap gap-2">
                  {customTemplates.map((ct) => (
                    <div key={ct.id} className="flex items-center gap-1 rounded-xl border border-line bg-paper px-2.5 py-1.5 text-xs font-semibold shadow-soft">
                      <button onClick={() => applyCustomTpl(ct)} className="text-ink">
                        {ct.name}
                      </button>
                      <button onClick={() => deleteCustomTemplate(ct.id)} className="text-ink-soft/70 hover:text-red-600" aria-label="Delete template">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Template Grid */}
            <div>
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">Planner templates</div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplate(t.id)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left text-xs font-semibold transition",
                      template === t.id ? "border-primary bg-primary text-primary-foreground shadow-soft" : "border-line bg-paper text-ink hover:bg-cream",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fine-Grained Customization */}
            <div className="rounded-2xl border border-line bg-paper p-3.5 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wide text-ink-soft">Page details & sizes</div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-soft">Custom title</label>
                  <input
                    type="text"
                    value={cfg.headerTitle ?? ""}
                    placeholder="e.g. APRIL 15–21 WEEK"
                    onChange={(e) => updateCfg({ headerTitle: e.target.value })}
                    className="w-full rounded-xl border border-line px-3 py-2 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-soft">Month</label>
                    <select
                      value={cfg.monthIndex ?? 3}
                      onChange={(e) => updateCfg({ monthIndex: Number(e.target.value) })}
                      className="w-full rounded-xl border border-line bg-paper px-2 py-2 text-xs"
                    >
                      {MONTHS_TR.map((m, idx) => (
                        <option key={m} value={idx}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-soft">Day</label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={cfg.startDayNum ?? 15}
                      onChange={(e) => updateCfg({ startDayNum: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })}
                      className="w-full rounded-xl border border-line px-2 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-ink-soft">Year</label>
                    <input
                      type="number"
                      min={2020}
                      max={2035}
                      value={cfg.year ?? 2026}
                      onChange={(e) => updateCfg({ year: Number(e.target.value) || 2026 })}
                      className="w-full rounded-xl border border-line px-2 py-2 text-xs"
                    />
                  </div>
                </div>
              </div>

              {template === "daily" && (
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-ink-soft">Time range</label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-ink-soft">Start</label>
                      <select
                        value={cfg.startHour ?? 6}
                        onChange={(e) => {
                          const v = Number(e.target.value)
                          updateCfg({ startHour: v, endHour: Math.max(cfg.endHour ?? 22, v + 1) })
                        }}
                        className="w-full rounded-xl border border-line bg-paper px-2 py-2 text-xs"
                      >
                        {Array.from({ length: 24 }, (_, h) => (
                          <option key={h} value={h}>
                            {String(h).padStart(2, "0")}:00
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-ink-soft">End</label>
                      <select
                        value={cfg.endHour ?? 22}
                        onChange={(e) => updateCfg({ endHour: Number(e.target.value) })}
                        className="w-full rounded-xl border border-line bg-paper px-2 py-2 text-xs"
                      >
                        {Array.from({ length: 24 }, (_, i) => i + 1)
                          .filter((h) => h > (cfg.startHour ?? 6))
                          .map((h) => (
                            <option key={h} value={h}>
                              {String(h % 24).padStart(2, "0")}:00
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-ink-soft">December</label>
                      <select
                        value={cfg.stepMin ?? 60}
                        onChange={(e) => updateCfg({ stepMin: Number(e.target.value) as 15 | 30 | 60 | 120 })}
                        className="w-full rounded-xl border border-line bg-paper px-2 py-2 text-xs"
                      >
                        {([15, 30, 60, 120] as const).map((m) => (
                          <option key={m} value={m}>
                            {m === 60 ? "1 hour" : m === 120 ? "2 hours" : `${m} dk`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <div className="flex justify-between text-xs font-medium text-ink-soft">
                    <span>Dot / line spacing</span>
                    <span>{cfg.spacing ?? 30}px</span>
                  </div>
                  <input
                    type="range"
                    min={16}
                    max={64}
                    step={2}
                    value={cfg.spacing ?? 30}
                    onChange={(e) => updateCfg({ spacing: Number(e.target.value) })}
                    className="mt-1 w-full accent-primary"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-medium text-ink-soft">
                    <span>Line thickness</span>
                    <span>{(cfg.lineWidth ?? 1.2).toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.6}
                    max={3}
                    step={0.2}
                    value={cfg.lineWidth ?? 1.2}
                    onChange={(e) => updateCfg({ lineWidth: Number(e.target.value) })}
                    className="mt-1 w-full accent-primary"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-ink-soft">Line / dot color</span>
                  <input
                    type="color"
                    value={cfg.lineColor ?? "#c8c0b2"}
                    onChange={(e) => updateCfg({ lineColor: e.target.value })}
                    className="h-8 w-10 rounded border border-line bg-transparent p-0"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={cfg.showMonthTabs ?? (template === "ivory_freestyle" || template === "pastel_week")}
                    onChange={(e) => updateCfg({ showMonthTabs: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Month tabs on the right (JAN..DEC)
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-ink">
                  <input
                    type="checkbox"
                    checked={cfg.showTopTabs ?? template === "pastel_week"}
                    onChange={(e) => updateCfg({ showTopTabs: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Top category tabs (PROJECT, TRACKER…)
                </label>
              </div>

              {/* Custom Image Template Upload */}
              <div className="border-t border-stone-100 pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => bgFileRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-xl bg-cream px-3 py-2 text-xs font-semibold text-ink hover:bg-cream-deep"
                  >
                    <ImagePlus size={15} /> Upload custom template / image from gallery
                  </button>
                  {cfg.bgImage && (
                    <>
                      <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                        Opacity
                        <input
                          type="range"
                          min={0.15}
                          max={1}
                          step={0.05}
                          value={cfg.bgOpacity ?? 1}
                          onChange={(e) => updateCfg({ bgOpacity: Number(e.target.value) })}
                          className="w-20 accent-primary"
                        />
                      </label>
                      <select
                        value={cfg.overlayTemplate ?? "none"}
                        onChange={(e) => updateCfg({ overlayTemplate: e.target.value as PageConfig["overlayTemplate"] })}
                        className="rounded-lg border border-line bg-paper px-2 py-1 text-xs"
                      >
                        <option value="none">Overlay: None</option>
                        <option value="dots">Overlay: Dotted</option>
                        <option value="grid">Overlay: Grid</option>
                        <option value="lines">Overlay: Lined</option>
                      </select>
                      <button
                        onClick={() => {
                          updateCfg({ bgImage: undefined })
                          if (template === "custom") setTemplate("dots")
                        }}
                        className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700"
                      >
                        Remove image
                      </button>
                    </>
                  )}
                </div>
                <input
                  ref={bgFileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    const { src } = await fileToDataUrl(f, 1600)
                    updateCfg({ bgImage: src, bgOpacity: cfg.bgOpacity ?? 1 })
                    setTemplate("custom")
                    e.target.value = ""
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-line bg-paper px-5 py-3">
          <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-soft hover:bg-cream">
            Cancel
          </button>
          <button
            onClick={() => {
              onApply(
                mode === "add"
                  ? newPage(template, bg, orient, cfg)
                  : {
                      ...initialPage!,
                      orient,
                      template,
                      bg,
                      config: cfg,
                    },
              )
              onClose()
            }}
            className="rounded-xl border-2 border-primary bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft active:bg-primary/90"
          >
            {mode === "add" ? "Add page" : "Apply changes"}
          </button>
        </div>
      </div>
    </div>
  )
}

