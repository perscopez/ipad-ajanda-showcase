"use client"

import { useEffect, useRef, useState } from "react"
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Cloud, CloudOff, Download, FilePlus2, LayoutGrid, MoreHorizontal, Printer, RefreshCw, SlidersHorizontal, Trash2 } from "lucide-react"
import Editor from "@/components/editor/Editor"
import SyncModal from "@/components/library/SyncModal"
import ThemeModal from "@/components/library/ThemeModal"
import { renderPage } from "@/lib/render"
import { useStore } from "@/lib/store"
import { dims, newPage, TEMPLATES, uid, type Notebook } from "@/lib/types"
import { MONTHS_TR } from "./constants"
import PageStudioModal from "./PageStudioModal"
import SpreadMode from "./SpreadMode"
import PagesMode from "./PagesMode"
import PageTurn, { TRANSITIONS, type Transition, type TurnCtl, type TurnState } from "./PageTurn"
import TabsBar from "./TabsBar"
import TabsEditor from "./TabsEditor"
import { TAB_COLORS } from "./tabs"
import { Menu, Popover, btn } from "@/components/ui"

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export default function NotebookView({
  nb,
  index,
  setIndex,
  onBack,
  onCover,
}: {
  nb: Notebook
  index: number
  setIndex: (i: number) => void
  onBack: () => void
  onCover: () => void
}) {
  const { setPage, addCustomPage, deletePages, updateNotebook, customStickers, addCustomSticker, deleteCustomSticker, syncStatus, saveState } = useStore()
  const [mode, setMode] = useState<"edit" | "spread" | "pages">("edit")
  const [studio, setStudio] = useState<null | "add" | "edit">(null)
  const [syncOpen, setSyncOpen] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [tabsOpen, setTabsOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [scrubOpen, setScrubOpen] = useState(false)
  const [edgeTaps, setEdgeTapsState] = useState(() => {
    try {
      return localStorage.getItem("defterim_edge_taps") !== "0"
    } catch {
      return true
    }
  })
  const setEdgeTaps = (v: boolean) => {
    setEdgeTapsState(v)
    try {
      localStorage.setItem("defterim_edge_taps", v ? "1" : "0")
    } catch {}
  }
  const [turn, setTurn] = useState<TurnState | null>(null)
  const turning = useRef(false)
  const [transition, setTransitionState] = useState<Transition>(() => {
    try {
      const v = localStorage.getItem("defterim_transition") as Transition | null
      return v && TRANSITIONS.some((t) => t.id === v) ? v : "book"
    } catch {
      return "book"
    }
  })
  const setTransition = (t: Transition) => {
    setTransitionState(t)
    try {
      localStorage.setItem("defterim_transition", t)
    } catch {}
  }
  const n = nb.pages.length
  const i = Math.min(index, n - 1)
  const page = nb.pages[i]

  /** Parmakla sürükleyerek sayfa çevirme (defter modu): sayfa parmağı takip eder. */
  const dragRef = useRef<null | { dir: 1 | -1; target: number | null; width: number; ctl: TurnCtl | null }>(null)
  const interactive = transition === "book" || transition === "slide" || transition === "vertical"
  const snap = async (pg: typeof page, width: number) => {
    const d = dims(pg.orient)
    const c = await renderPage(pg, Math.min(1.4, (width * Math.min(2, window.devicePixelRatio || 1)) / d.w))
    return c.toDataURL("image/jpeg", 0.88)
  }
  /** Parmakla sürükleme: curl / slide / scroll parmağı takip eder; diğer modlarda bırakınca animasyon çalışır. */
  const onTurnDrag = (phase: "start" | "move" | "end", info: { dir?: 1 | -1; dx?: number; commit?: boolean }) => {
    if (phase === "start") {
      const stage = document.querySelector("[data-page-stage]") as HTMLElement | null
      if (!stage || turning.current) return
      const dir = info.dir ?? 1
      const target = i + dir >= 0 && i + dir < n ? i + dir : null
      const r = stage.getBoundingClientRect()
      if (!interactive) {
        dragRef.current = { dir, target, width: r.width, ctl: null }
        return
      }
      turning.current = true
      const d = { dir, target, width: transition === "vertical" ? r.height : r.width, ctl: { t: 0, state: "drag" } as TurnCtl }
      dragRef.current = d
      void (async () => {
        try {
          const [img, under] = await Promise.all([snap(page, r.width), target !== null ? snap(nb.pages[target], r.width) : Promise.resolve(undefined)])
          if (d.ctl!.state === "cancel" && d.ctl!.t < 0.02) {
            turning.current = false
            return
          }
          setTurn({ img, under, rect: { left: r.left, top: r.top, width: r.width, height: r.height }, dir, mode: transition, key: Date.now(), ctl: d.ctl!, onCommit: () => target !== null && setIndex(target) })
        } catch {
          turning.current = false
        }
      })()
    } else if (phase === "move") {
      const d = dragRef.current
      if (!d?.ctl || d.ctl.state !== "drag") return
      const raw = Math.max(0, (-(info.dx ?? 0) * d.dir) / (d.width * (transition === "book" ? 0.9 : 1)))
      d.ctl.t = d.target === null ? Math.min(0.1, raw * 0.25) : Math.min(1, raw)
    } else {
      const d = dragRef.current
      if (!d) return
      dragRef.current = null
      if (!d.ctl) {
        if (info.commit && d.target !== null) void goTo(d.target)
        return
      }
      d.ctl.state = info.commit && d.target !== null ? "finish" : "cancel"
    }
  }

  /** Sayfa değiştir: seçilen geçiş animasyonuyla (defter gibi çevirme, kaydırma…). */
  const goTo = async (to: number) => {
    const target = Math.max(0, Math.min(n - 1, to))
    if (target === i) return
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const stage = document.querySelector("[data-page-stage]") as HTMLElement | null
    if (transition === "none" || reduce || !stage || turning.current) {
      setIndex(target)
      return
    }
    turning.current = true
    try {
      const r = stage.getBoundingClientRect()
      const d = dims(page.orient)
      const c = await renderPage(page, Math.min(1.4, (r.width * Math.min(2, window.devicePixelRatio || 1)) / d.w))
      setTurn({ img: c.toDataURL("image/jpeg", 0.88), rect: { left: r.left, top: r.top, width: r.width, height: r.height }, dir: target > i ? 1 : -1, mode: transition, key: Date.now() })
    } catch {
      turning.current = false
    }
    setIndex(target)
  }

  // Klavye okları ile sayfa gezinme
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return
      if (document.querySelector(".fixed.inset-0")) return
      if (e.key === "ArrowRight" || e.key === "PageDown") void goTo(i + 1)
      else if (e.key === "ArrowLeft" || e.key === "PageUp") void goTo(i - 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  if (mode === "pages")
    return (
      <PagesMode
        nb={nb}
        current={i}
        onClose={() => setMode("edit")}
        onOpen={(pi) => {
          setIndex(pi)
          setMode("edit")
        }}
        onAdd={() => {
          setMode("edit")
          setStudio("add")
        }}
      />
    )

  if (mode === "spread")
    return (
      <SpreadMode
        nb={nb}
        onClose={() => setMode("edit")}
        onOpenPage={(pi) => {
          setIndex(Math.max(0, Math.min(n - 1, pi)))
          setMode("edit")
        }}
        onCover={onCover}
      />
    )

  const handleJumpPage = (targetIdx: number) => {
    void goTo(targetIdx)
  }

  const handleJumpMonth = (monthIndex: number) => {
    const mapped = nb.monthPages?.[monthIndex]
    if (mapped !== undefined && mapped >= 0 && mapped < n) {
      setIndex(mapped)
      return
    }
    const existing = nb.pages.findIndex((p) => p.config?.monthIndex === monthIndex)
    if (existing !== -1) {
      setIndex(existing)
      return
    }
    // Create a matching monthly/weekly page for that month automatically
    const created = newPage("ivory_week", page.bg, page.orient ?? nb.cover.orient, {
      ...(page.config ?? {}),
      monthIndex,
      startDayNum: 1,
      headerTitle: `${MONTHS_TR[monthIndex].toLocaleUpperCase("en")} PLAN`,
      showMonthTabs: true,
    })
    addCustomPage(nb.id, n, created)
    updateNotebook(nb.id, { monthPages: { ...(nb.monthPages ?? {}), [monthIndex]: n } })
    setIndex(n)
  }

  const handleExportPng = async () => {
    const canvas = await renderPage(page, 2)
    const link = document.createElement("a")
    link.download = `${nb.title || "page"}-${i + 1}.png`
    link.href = canvas.toDataURL("image/png")
    link.click()
  }

  const handlePrintPdf = async () => {
    if (printing) return
    setPrinting(true)
    try {
      const imgs: string[] = []
      for (const p of nb.pages) {
        const c = await renderPage(p, 1.8)
        imgs.push(c.toDataURL("image/jpeg", 0.92))
      }
      const iframe = document.createElement("iframe")
      iframe.style.position = "fixed"
      iframe.style.right = "0"
      iframe.style.bottom = "0"
      iframe.style.width = "0"
      iframe.style.height = "0"
      iframe.style.border = "0"
      document.body.appendChild(iframe)

      const doc = iframe.contentDocument
      if (doc) {
        doc.open()
        doc.write(`<!doctype html><html><head><title>${escapeHtml(String(nb.title ?? ""))}</title><style>@page{margin:0}body{margin:0;background:#fff}img{display:block;width:100vw;height:100vh;object-fit:contain;page-break-after:always}</style></head><body>${imgs.map((s) => `<img src="${s}" />`).join("")}</body></html>`)
        doc.close()
        const loaded = Array.from(doc.images).map(
          (im) =>
            new Promise<void>((res) => {
              if (im.complete) res()
              else {
                im.onload = () => res()
                im.onerror = () => res()
              }
            }),
        )
        await Promise.all(loaded)
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        setTimeout(() => iframe.remove(), 3000)
      }
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="h-full">
      <Editor
        key={page.id}
        initial={page}
        onChange={(p) => setPage(nb.id, page.id, p)}
        onEdgeTap={(d) => void goTo(i + d)}
        edgeTapsOn={edgeTaps}
        onTurnDrag={onTurnDrag}
        swipeAxis={transition === "vertical" ? "y" : "x"}
        activePageIndex={i}
        onJumpPage={handleJumpPage}
        onJumpMonth={handleJumpMonth}
        onOpenPageStudio={() => setStudio("edit")}
        customStickers={customStickers}
        onSaveCustomSticker={addCustomSticker}
        onDeleteCustomSticker={deleteCustomSticker}
        bar={
          <>
          <div className="flex items-center gap-2 px-3 pb-2 pt-[max(8px,env(safe-area-inset-top))]">
            <button className={btn} onClick={onBack}>
              <ChevronLeft size={18} /> <span className="hidden sm:inline">Library</span>
            </button>
            <div className="min-w-0 flex-1 px-1">
              <div className="truncate font-serif text-lg font-semibold leading-tight text-ink">{nb.title}</div>
              <div className="flex items-center gap-2 text-xs">
              <span className={saveState === "error" ? "font-semibold text-red-600" : "text-ink-soft"} role="status">
                {saveState === "error" ? "⚠ Could not save" : saveState === "saving" ? "Saving…" : "✓ Saved"}
              </span>
              <button onClick={() => setSyncOpen(true)} className="flex items-center gap-1 text-xs text-ink-soft">
                {syncStatus === "syncing" ? <RefreshCw size={12} className="animate-spin" /> : syncStatus === "synced" ? <CheckCircle2 size={12} className="text-emerald-600" /> : syncStatus === "offline" ? <CloudOff size={12} /> : <Cloud size={12} />}
                {syncStatus === "syncing" ? "Syncing" : syncStatus === "synced" ? "Synced" : syncStatus === "offline" ? "Offline" : "Cloud"}
              </button>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button className={btn + " !w-11 !px-0"} disabled={i === 0} onClick={() => void goTo(i - 1)} aria-label="Previous page">
                <ChevronLeft size={18} />
              </button>
              <div className="relative">
                <button onClick={() => setScrubOpen((o) => !o)} aria-label="Jump to page" className="press min-w-14 rounded-lg px-1 py-1 text-center text-sm font-semibold tabular-nums hover:bg-rose-soft">
                  {i + 1} / {n}
                </button>
                <Popover open={scrubOpen} onClose={() => setScrubOpen(false)} className="left-1/2 top-full mt-2 w-[min(80vw,22rem)] -translate-x-1/2 p-4">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink-soft">
                    <span>Jump to page</span>
                    <span className="tabular-nums">{i + 1} / {n}</span>
                  </div>
                  <input type="range" min={1} max={n} value={i + 1} onChange={(e) => setIndex(Number(e.target.value) - 1)} className="w-full accent-primary" aria-label="Page slider" />
                </Popover>
              </div>
              <button className={btn + " !w-11 !px-0"} disabled={i === n - 1} onClick={() => void goTo(i + 1)} aria-label="Next page">
                <ChevronRight size={18} />
              </button>
            </div>
            <button className={btn} onClick={() => setMode("pages")}>
              <LayoutGrid size={18} /> <span className="hidden md:inline">Pages</span>
            </button>
            <button className={btn} onClick={() => setMode("spread")}>
              <BookOpen size={18} /> <span className="hidden md:inline">Book</span>
            </button>
            <Menu
              label="More"
              className="!w-11 !px-0"
              trigger={<MoreHorizontal size={20} />}
              items={[
                { label: "Add new page", icon: <FilePlus2 size={18} />, onSelect: () => setStudio("add") },
                { label: "Customize page", icon: <SlidersHorizontal size={18} />, onSelect: () => setStudio("edit") },
                "divider",
                { label: "Download as PNG", icon: <Download size={18} />, onSelect: () => void handleExportPng() },
                { label: printing ? "Preparing…" : "PDF / Print", icon: <Printer size={18} />, disabled: printing, onSelect: () => void handlePrintPdf() },
                { label: "Cloud sync", icon: <Cloud size={18} />, onSelect: () => setSyncOpen(true) },
                { label: "Theme colors", icon: <SlidersHorizontal size={18} />, onSelect: () => setThemeOpen(true) },
                "divider",
                { heading: "Tabs" },
                { label: "Edit tabs", icon: <SlidersHorizontal size={18} />, onSelect: () => setTabsOpen(true) },
                {
                  label: "Make this page a tab",
                  icon: <FilePlus2 size={18} />,
                  onSelect: () =>
                    updateNotebook(nb.id, {
                      tabsHidden: false,
                      tabs: [...(nb.tabs ?? []), { id: uid(), label: page.title || TEMPLATES.find((t) => t.id === page.template)?.label || `Page ${i + 1}`, emoji: "📌", color: TAB_COLORS[(nb.tabs?.length ?? 0) % TAB_COLORS.length], pageId: page.id }],
                    }),
                },
                { label: nb.tabsHidden ? "Show tab bar" : "Hide tab bar", icon: <LayoutGrid size={18} />, onSelect: () => updateNotebook(nb.id, { tabsHidden: !nb.tabsHidden }) },
                "divider",
                { heading: "Page turning" },
                { label: "Tap page edges to turn", hint: edgeTaps ? "✓" : undefined, icon: <BookOpen size={18} />, onSelect: () => setEdgeTaps(!edgeTaps) },
                ...TRANSITIONS.map((t) => ({ label: t.label, hint: transition === t.id ? "✓" : undefined, onSelect: () => setTransition(t.id) })),
                "divider",
                {
                  label: "Delete page",
                  icon: <Trash2 size={18} />,
                  danger: true,
                  onSelect: () => {
                    if (confirm("Delete this page?")) {
                      deletePages(nb.id, i, 1)
                      setIndex(Math.max(0, Math.min(i, n - 2)))
                    }
                  },
                },
              ]}
            />
          </div>
            {!nb.tabsHidden && (
              <TabsBar tabs={nb.tabs ?? []} pages={nb.pages} activeIndex={i} onGo={(idx) => void goTo(idx)} onEdit={() => setTabsOpen(true)} />
            )}
          </>
        }
      />

      {studio && (
        <PageStudioModal
          mode={studio}
          initialPage={studio === "edit" ? page : undefined}
          defaultOrient={page.orient ?? nb.cover.orient}
          onClose={() => setStudio(null)}
          onApply={(draft) => {
            if (studio === "add") {
              addCustomPage(nb.id, i + 1, draft)
              setIndex(i + 1)
            } else {
              setPage(nb.id, page.id, draft)
            }
          }}
        />
      )}
      {syncOpen && <SyncModal onClose={() => setSyncOpen(false)} />}
      {themeOpen && <ThemeModal onClose={() => setThemeOpen(false)} />}
      {tabsOpen && (
        <TabsEditor
          nb={nb}
          currentIndex={i}
          onChange={(tabs) => updateNotebook(nb.id, { tabs })}
          onHiddenChange={(h) => updateNotebook(nb.id, { tabsHidden: h })}
          onClose={() => setTabsOpen(false)}
        />
      )}
      {turn && (
        <PageTurn
          turn={turn}
          onDone={() => {
            turning.current = false
            setTurn(null)
          }}
        />
      )}
    </div>
  )
}

