"use client"

import { useState, type ReactNode } from "react"
import { Eraser, Fingerprint, Hand, Highlighter, ImagePlus, LassoSelect, Layers, Minus, Pen, Plus, Redo2, Shapes, SlidersHorizontal, Smile, Sparkles, StickyNote, Type, Undo2, Ruler, PanelBottom, PanelLeft, PanelRight, EyeOff, Move } from "lucide-react"
import { INK, NEON, PEN_STYLES } from "./constants"
import { Popover } from "@/components/ui"
import { PAPER } from "@/lib/render"
import { TEMPLATES, type PenStyle, type Template } from "@/lib/types"
import { cn } from "@/lib/utils"

export type Tool = "pen" | "marker" | "eraser" | "lasso" | "text" | "move"
export type DockPos = "bottom" | "left" | "right" | "hidden"
export type Panel = null | "pen" | "add" | "page"

export type DockProps = {
  tool: Tool
  setTool: (t: Tool) => void
  panel: Panel
  setPanel: (p: Panel) => void
  color: string
  setColor: (c: string) => void
  size: number
  setSize: (n: number) => void
  penStyle: PenStyle
  setPenStyle: (s: PenStyle) => void
  streamline: number
  setStreamline: (n: number) => void
  sensitivity: number
  setSensitivity: (n: number) => void
  smartShapeOn: boolean
  setSmartShapeOn: (b: boolean) => void
  straight: boolean
  setStraight: (b: boolean) => void
  eraserMode: "part" | "stroke"
  setEraserMode: (m: "part" | "stroke") => void
  onClearInk: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onAddPhoto: () => void
  onAddSticker: () => void
  onAddMine: () => void
  onAddEmoji: () => void
  onAddText: (pill: boolean) => void
  template: Template
  setTemplate: (t: Template) => void
  bg: string
  setBg: (c: string) => void
  texture: boolean
  setTexture: (b: boolean) => void
  onOpenPageStudio?: () => void
  pencilOnly: boolean
  setPencilOnly: (b: boolean) => void
  zoom: number
  onZoom: (z: number) => void
  pos: DockPos
  setPos: (p: DockPos) => void
}

const TOOLS: { id: Tool; icon: ReactNode; label: string }[] = [
  { id: "pen", icon: <Pen size={20} />, label: "Pen" },
  { id: "marker", icon: <Highlighter size={20} />, label: "Highlighter" },
  { id: "eraser", icon: <Eraser size={20} />, label: "Eraser" },
  { id: "lasso", icon: <LassoSelect size={20} />, label: "Lasso" },
  { id: "text", icon: <Type size={20} />, label: "Text" },
  { id: "move", icon: <Hand size={20} />, label: "Object" },
]

const Divider = ({ v }: { v?: boolean }) => <div className={cn("shrink-0 bg-line", v ? "my-1 h-px w-9" : "mx-1 h-8 w-px")} />

function DockBtn({ active, disabled, onClick, label, children, className }: { active?: boolean; disabled?: boolean; onClick: () => void; label: string; children: ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn("press flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-semibold disabled:opacity-30", active ? "bg-rose text-ink shadow-soft" : "text-ink-soft hover:bg-cream", className)}
    >
      {children}
    </button>
  )
}

const Row = ({ title, value, children }: { title: string; value?: string; children: ReactNode }) => (
  <div className="mt-4 first:mt-0">
    <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink-soft">
      <span>{title}</span>
      {value && <span className="normal-case tabular-nums">{value}</span>}
    </div>
    {children}
  </div>
)

const Switch = ({ on, onChange, label, icon }: { on: boolean; onChange: (b: boolean) => void; label: string; icon?: ReactNode }) => (
  <button onClick={() => onChange(!on)} className="press flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left text-sm font-medium text-ink hover:bg-cream" role="switch" aria-checked={on}>
    <span className="text-ink-soft">{icon}</span>
    <span className="flex-1">{label}</span>
    <span className={cn("relative h-6 w-10 rounded-full transition-colors duration-300", on ? "bg-primary" : "bg-line")}>
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-paper shadow transition-all duration-300 ease-soft", on ? "left-[1.1rem]" : "left-0.5")} />
    </span>
  </button>
)

export default function Dock(p: DockProps) {
  const drawing = p.tool === "pen" || p.tool === "marker"
  const hasPanel = drawing || p.tool === "eraser"
  const palette = p.tool === "marker" ? NEON : INK

  const pick = (t: Tool) => {
    if (p.tool === t && (t === "pen" || t === "marker" || t === "eraser")) p.setPanel(p.panel === "pen" ? null : "pen")
    else {
      p.setTool(t)
      p.setPanel(null)
    }
  }
  const toggle = (name: Panel) => p.setPanel(p.panel === name ? null : name)
  const dotSize = Math.max(4, Math.min(30, p.tool === "marker" ? p.size * 2.2 : p.size * 1.3))

  const side = p.pos === "left" || p.pos === "right"
  const v = side
  /** Panel konumu: altta yukarı açılır, yan dock'ta yana açılır. */
  const pc = (bottom: string) => (side ? cn("top-1/2 max-h-[84dvh] -translate-y-1/2 overflow-y-auto", p.pos === "left" ? "left-full ml-3" : "right-full mr-3") : bottom)
  const [layoutOpen, setLayoutOpen] = useState(false)

  if (p.pos === "hidden")
    return (
      <div className="pointer-events-none fixed bottom-3 right-3 z-30 pb-[env(safe-area-inset-bottom)]">
        <button onClick={() => p.setPos("bottom")} aria-label="Show toolbar" title="Show toolbar" className="press pointer-events-auto grid h-12 w-12 place-items-center rounded-full border-2 border-primary bg-paper text-primary shadow-lift">
          <PanelBottom size={20} />
        </button>
      </div>
    )

  return (
    <div className={cn(side ? cn("pointer-events-none fixed top-1/2 z-30 -translate-y-1/2", p.pos === "left" ? "left-2" : "right-2") : "relative flex shrink-0 justify-center px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2")}>
      {/* Kalem / silgi paneli */}
      <Popover open={p.panel === "pen" && hasPanel} onClose={() => p.setPanel(null)} className={cn("w-[min(94vw,25rem)] p-4", pc("bottom-full left-1/2 mb-3 -translate-x-1/2"))}>
        {drawing ? (
          <>
            {p.tool === "pen" && (
              <Row title="Pen tip">
                <div className="grid grid-cols-5 gap-1.5">
                  {PEN_STYLES.map((ps) => (
                    <button key={ps.id} onClick={() => p.setPenStyle(ps.id)} title={ps.hint} className={cn("press rounded-2xl py-2.5 text-xs font-semibold", p.penStyle === ps.id ? "bg-rose text-ink" : "bg-cream text-ink-soft")}>
                      {ps.label}
                    </button>
                  ))}
                </div>
              </Row>
            )}
            <Row title="Color">
              <div className="flex flex-wrap items-center gap-2">
                {palette.map((c) => (
                  <button key={c} aria-label={c} onClick={() => p.setColor(c)} className={cn("press h-9 w-9 rounded-full border-2 transition-transform duration-300", p.color === c ? "scale-110 border-primary" : "border-white shadow-soft")} style={{ background: c }} />
                ))}
                <label className="press relative h-9 w-9 overflow-hidden rounded-full border-2 border-white shadow-soft" style={{ background: "conic-gradient(#f4b6c2,#f9cfa5,#f6e58d,#b8e0c0,#a9d6e5,#cbb7ea,#f4b6c2)" }}>
                  <input type="color" value={p.color} onChange={(e) => p.setColor(e.target.value)} className="absolute inset-0 opacity-0" aria-label="Custom color" />
                </label>
              </div>
            </Row>
            <Row title="Thickness" value={String(p.size)}>
              <div className="flex items-center gap-3">
                <input type="range" min={1} max={20} value={p.size} onChange={(e) => p.setSize(+e.target.value)} className="flex-1 accent-primary" aria-label="Thickness" />
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cream">
                  <span className="rounded-full transition-all duration-200" style={{ width: dotSize, height: dotSize, background: p.color, opacity: p.tool === "marker" ? 0.5 : 1, border: p.color === "#ffffff" ? "1px solid #ddd3c4" : undefined }} />
                </div>
              </div>
            </Row>
            {p.tool === "pen" && (
              <>
                <Row title="Pressure sensitivity" value={`${Math.round(p.sensitivity * 100)}%`}>
                  <input type="range" min={0} max={1} step={0.05} value={p.sensitivity} onChange={(e) => p.setSensitivity(+e.target.value)} className="w-full accent-primary" aria-label="Pressure sensitivity" />
                </Row>
                <Row title="Smoothing" value={`${Math.round(p.streamline * 100)}%`}>
                  <input type="range" min={0} max={0.9} step={0.05} value={p.streamline} onChange={(e) => p.setStreamline(+e.target.value)} className="w-full accent-primary" aria-label="Smoothing" />
                </Row>
              </>
            )}
            <div className="mt-3 border-t border-line pt-2">
              <Switch on={p.straight} onChange={p.setStraight} label="Draw straight lines" icon={<Ruler size={18} />} />
              <Switch on={p.smartShapeOn} onChange={p.setSmartShapeOn} label="Hold to straighten shapes" icon={<Shapes size={18} />} />
            </div>
          </>
        ) : (
          <>
            <Row title="Eraser type">
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    ["part", "Erase part", "Erases where you touch"],
                    ["stroke", "Erase stroke", "Erases the whole stroke"],
                  ] as const
                ).map(([id, t, d]) => (
                  <button key={id} onClick={() => p.setEraserMode(id)} className={cn("press rounded-2xl p-3 text-left", p.eraserMode === id ? "bg-rose text-ink" : "bg-cream text-ink-soft")}>
                    <div className="text-sm font-semibold">{t}</div>
                    <div className="text-[11px] opacity-80">{d}</div>
                  </button>
                ))}
              </div>
            </Row>
            <Row title="Eraser size" value={String(p.size)}>
              <input type="range" min={1} max={24} value={p.size} onChange={(e) => p.setSize(+e.target.value)} className="w-full accent-primary" aria-label="Eraser size" />
            </Row>
            <button onClick={p.onClearInk} className="press mt-4 w-full rounded-2xl bg-rose-soft py-2.5 text-sm font-semibold text-red-700">
              Clear all drawings on the page
            </button>
          </>
        )}
      </Popover>

      {/* Ekle menüsü */}
      <Popover open={p.panel === "add"} onClose={() => p.setPanel(null)} className={cn("w-64 p-1.5", pc("bottom-full right-3 mb-3 sm:right-1/2 sm:translate-x-[7rem]"))}>
        {(
          [
            [<ImagePlus key="i" size={19} />, "Photo from gallery", p.onAddPhoto],
            [<StickyNote key="s" size={19} />, "Stickers, widgets, tape", p.onAddSticker],
            [<Sparkles key="m" size={19} />, "My stickers & letters", p.onAddMine],
            [<Smile key="e" size={19} />, "Emoji", p.onAddEmoji],
            [<Type key="t" size={19} />, "Text box", () => p.onAddText(false)],
            [<Layers key="l" size={19} />, "Title label", () => p.onAddText(true)],
          ] as [ReactNode, string, () => void][]
        ).map(([icon, label, fn]) => (
          <button key={label} onClick={() => { p.setPanel(null); fn() }} className="press flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-ink hover:bg-rose-soft">
            <span className="text-ink-soft">{icon}</span>
            {label}
          </button>
        ))}
      </Popover>

      {/* Sayfa menüsü */}
      <Popover open={p.panel === "page"} onClose={() => p.setPanel(null)} className={cn("w-[min(94vw,22rem)] p-4", pc("bottom-full right-3 mb-3 sm:right-1/2 sm:translate-x-[11rem]"))}>
        <Row title="Template">
          <select value={p.template} onChange={(e) => p.setTemplate(e.target.value as Template)} className="w-full rounded-2xl border border-line bg-paper px-3 py-2.5 text-sm" aria-label="Page template">
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Row>
        <Row title="Paper color">
          <div className="flex items-center gap-2">
            {["#fbf8f1", "#ffffff", "#f6efe2", "#fdf2f4", "#f2f8f4", "#f1f5fb", "#f5f1fa", "#23252d"].map((c) => (
              <button key={c} aria-label={c} onClick={() => p.setBg(c)} className={cn("press h-8 w-8 rounded-full border-2", p.bg === c ? "scale-110 border-primary" : "border-line")} style={{ background: c }} />
            ))}
          </div>
        </Row>
        <div className="mt-3 border-t border-line pt-2">
          <Switch on={p.texture} onChange={p.setTexture} label="Paper texture" icon={<Layers size={18} />} />
          <Switch on={p.pencilOnly} onChange={p.setPencilOnly} label="Apple Pencil only" icon={<Fingerprint size={18} />} />
        </div>
        <Row title="Zoom" value={`${Math.round(p.zoom * 100)}%`}>
          <div className="flex items-center gap-2">
            <button className="press grid h-10 w-10 place-items-center rounded-full bg-cream" onClick={() => p.onZoom(p.zoom / 1.4)} disabled={p.zoom <= 1} aria-label="Zoom out">
              <Minus size={18} />
            </button>
            <button className="press h-10 flex-1 rounded-full bg-cream text-sm font-semibold" onClick={() => p.onZoom(1)}>
              Reset
            </button>
            <button className="press grid h-10 w-10 place-items-center rounded-full bg-cream" onClick={() => p.onZoom(p.zoom * 1.4)} disabled={p.zoom >= 5} aria-label="Zoom in">
              <Plus size={18} />
            </button>
          </div>
        </Row>
        {p.onOpenPageStudio && (
          <button onClick={() => { p.setPanel(null); p.onOpenPageStudio?.() }} className="press mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-2.5 text-sm font-semibold text-white">
            <SlidersHorizontal size={17} /> Page studio
          </button>
        )}
      </Popover>

      <div className={cn("pointer-events-auto flex gap-0.5 rounded-2xl border-2 border-primary bg-paper p-1.5 shadow-lift", side ? "max-h-[88dvh] flex-col items-center overflow-y-auto" : "max-w-full items-center overflow-x-auto")}>
        {TOOLS.map((t) => (
          <DockBtn key={t.id} active={p.tool === t.id} onClick={() => pick(t.id)} label={t.label}>
            {t.icon}
            <span>{t.label}</span>
          </DockBtn>
        ))}
        <Divider v={v} />
        <DockBtn onClick={p.onUndo} disabled={!p.canUndo} label="Undo">
          <Undo2 size={20} />
          <span>Back</span>
        </DockBtn>
        <DockBtn onClick={p.onRedo} disabled={!p.canRedo} label="Redo">
          <Redo2 size={20} />
          <span>Redo</span>
        </DockBtn>
        {drawing && (
          <>
            <Divider v={v} />
            <button onClick={() => toggle("pen")} aria-label="Color and pen settings" className="press mx-1 h-11 w-11 shrink-0 rounded-full border-4 border-white shadow-soft ring-1 ring-line" style={{ background: p.color }} />
          </>
        )}
        <Divider v={v} />
        <DockBtn active={p.panel === "add"} onClick={() => toggle("add")} label="Add">
          <Plus size={20} />
          <span>Add</span>
        </DockBtn>
        <DockBtn active={p.panel === "page"} onClick={() => toggle("page")} label="Page">
          <SlidersHorizontal size={20} />
          <span>Page</span>
        </DockBtn>
        <Divider v={v} />
        <DockBtn active={layoutOpen} onClick={() => setLayoutOpen((o) => !o)} label="Move toolbar">
          <Move size={20} />
          <span>Layout</span>
        </DockBtn>
      </div>
      <Popover open={layoutOpen} onClose={() => setLayoutOpen(false)} className={cn("w-44 p-1.5", pc("bottom-full right-3 mb-3"))}>
        {([["bottom", "Bottom", <PanelBottom key="b" size={18} />], ["left", "Left side", <PanelLeft key="l" size={18} />], ["right", "Right side", <PanelRight key="r" size={18} />], ["hidden", "Hide", <EyeOff key="h" size={18} />]] as const).map(([id, label, icon]) => (
          <button key={id} onClick={() => { p.setPos(id); setLayoutOpen(false) }} className={cn("press flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium", p.pos === id ? "bg-rose text-ink" : "text-ink-soft hover:bg-cream")}>
            {icon}
            {label}
          </button>
        ))}
      </Popover>
    </div>
  )
}

export { PAPER }
