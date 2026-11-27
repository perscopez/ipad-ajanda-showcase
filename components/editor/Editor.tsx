"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  Check,
  Palette,
  BookmarkPlus,
  Copy,
  FlipHorizontal2,
  Italic,
  Lock,
  RotateCw,
  Sparkles,
  Trash2,
  Unlock,
  Wand2,
  Crop,
} from "lucide-react"
import ImageEditModal from "./ImageEditModal"
import Dock, { type DockPos, type Panel, type Tool } from "./Dock"
import { INK, NEON } from "./constants"
import { DECOR, type Decor, type DecorCategory } from "@/lib/decor"
import { useAssetBackup } from "@/lib/assetSync"
import { addPack, loadPack, removePack, usePacks } from "@/lib/packs"
import { sliceSheet, type SlicedSticker } from "@/lib/slice"
import { addFontFile, isCustomFont, removeFont, useCustomFonts } from "@/lib/fonts"
import { bboxOf, eraseFromStroke, moveStroke, scaleStroke, strokesInLasso } from "@/lib/ink"
import {
  drawAll,
  drawStroke,
  drawTemplate,
  fileToDataUrl,
  grainDataUrl,
  loadImg,
  PAPER,
  removeWhiteBackground,
  resolveFontFamily,
  snapShape,
} from "@/lib/render"
import {
  dims,
  uid,
  type CustomSticker,
  type Item,
  type ItemFrame,
  type NotebookTab,
  type Page,
  type PenStyle,
  type Stroke,
} from "@/lib/types"
import { cn } from "@/lib/utils"

type DrawMode = "smart" | "pencilOnly"
type StickerTab = "all" | DecorCategory | "mine"

const PREF_KEY = "defterim_editor_prefs_v2"
type Prefs = { tool: Tool; penStyle: PenStyle; colors: { pen: string; marker: string }; size: number; streamline: number; smartShapeOn: boolean; drawMode: DrawMode; sensitivity: number; eraserMode: "part" | "stroke" }
let PREFS: Partial<Prefs> | null = null
/** Kalem, renk, kalınlık gibi seçimler sayfa değiştirince ve uygulama yeniden açılınca korunur. */
function prefs(): Partial<Prefs> {
  if (PREFS) return PREFS
  try {
    PREFS = JSON.parse(localStorage.getItem(PREF_KEY) || "{}")
  } catch {
    PREFS = {}
  }
  return PREFS ?? {}
}

function collapseStraight(s: Stroke): Stroke {
  const n = s.pts.length
  return { ...s, pts: [s.pts[0], s.pts[1], s.pts[2], s.pts[n - 3], s.pts[n - 2], s.pts[n - 1]] }
}

function strokeBox(s: Stroke) {
  const p = s.pts
  let bb = BOXES.get(s)
  if (!bb || bb.n !== p.length) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < x0) x0 = p[i]
      if (p[i] > x1) x1 = p[i]
      if (p[i + 1] < y0) y0 = p[i + 1]
      if (p[i + 1] > y1) y1 = p[i + 1]
    }
    bb = { n: p.length, x0, y0, x1, y1 }
    BOXES.set(s, bb)
  }
  return bb
}

/** Çizgi silgisi: dokunulan çizgi bütünüyle silinir. */
function strokeHit(s: Stroke, x: number, y: number, R: number) {
  const p = s.pts
  for (let i = 0; i < p.length; i += 3) {
    if (Math.hypot(p[i] - x, p[i + 1] - y) < R) return true
    if (i >= 3) {
      const ax = p[i - 3], ay = p[i - 2], dx = p[i] - ax, dy = p[i + 1] - ay
      const l2 = dx * dx + dy * dy
      if (l2 > 0) {
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2))
        if (Math.hypot(ax + t * dx - x, ay + t * dy - y) < R) return true
      }
    }
  }
  return false
}

// Sayfa değişince editör yeniden kurulur; son ölçüler hatırlanır ki sayfa "zoom atmasın"
const LAST_FIT = { scale: 0.6, t: 0, b: 0 }

const BOXES = new WeakMap<Stroke, { n: number; x0: number; y0: number; x1: number; y1: number }>() // silgi için çizgi sınır kutuları
const HIST = new Map<string, { u: Page[]; r: Page[] }>()

const EMOJI = ["⭐", "💖", "🌸", "🌷", "🍀", "☀️", "🌙", "☁️", "🌈", "✨", "🎀", "🎈", "🎂", "☕", "🍓", "🍒", "🐱", "🦋", "✈️", "📌", "📍", "✅", "❤️", "🔥", "📚", "🎧", "🥑", "🪴"]
const TAG_BGS = ["transparent", "#fbcfe8", "#fde68a", "#bfdbfe", "#ddd6fe", "#bbf7d0", "#fed7aa", "#f5f5f4", "#27272a"]
const MONTHS_SHORT = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]


const FRAMES: { id: ItemFrame; label: string }[] = [
  { id: "none", label: "None" },
  { id: "polaroid", label: "Polaroid" },
  { id: "pin", label: "Pinned" },
  { id: "tape", label: "Taped" },
  { id: "rounded", label: "Rounded" },
  { id: "shadow", label: "Shadow" },
]

export type EditorProps = {
  initial: Page
  onChange: (p: Page) => void
  bar?: ReactNode
  tabs?: NotebookTab[]
  activePageIndex?: number
  onJumpPage?: (pageIndex: number) => void
  onJumpMonth?: (monthIndex: number) => void
  onOpenPageStudio?: () => void
  customStickers?: CustomSticker[]
  onSaveCustomSticker?: (s: Omit<CustomSticker, "id">) => void
  onDeleteCustomSticker?: (id: string) => void
  /** Sayfa kenarına (sol/sağ %10) dokununca sayfa değiştir (Apple Books gibi). */
  onEdgeTap?: (dir: 1 | -1) => void
  edgeTapsOn?: boolean
  swipeAxis?: "x" | "y"
  /** Parmağı takip eden sayfa çevirme (defter modu): start → move(dx) → end(commit) */
  onTurnDrag?: (phase: "start" | "move" | "end", info: { dir?: 1 | -1; dx?: number; commit?: boolean }) => void
}

export default function Editor({
  initial,
  onChange,
  bar,
  tabs,
  activePageIndex,
  onJumpPage,
  onJumpMonth,
  onOpenPageStudio,
  customStickers = [],
  onSaveCustomSticker,
  onDeleteCustomSticker,
  onEdgeTap,
  edgeTapsOn = true,
  swipeAxis = "x",
  onTurnDrag,
}: EditorProps) {
  const turnRef = useRef(onTurnDrag)
  useLayoutEffect(() => { turnRef.current = onTurnDrag }, [onTurnDrag])
  const swipeRef = useRef({ axis: swipeAxis })
  useLayoutEffect(() => { swipeRef.current = { axis: swipeAxis } }, [swipeAxis])
  const edgeRef = useRef({ cb: onEdgeTap, on: edgeTapsOn })
  useLayoutEffect(() => { edgeRef.current = { cb: onEdgeTap, on: edgeTapsOn } }, [onEdgeTap, edgeTapsOn])
  const [page, setPageState] = useState(initial)
  const dirty = useRef(false)
  const pageRef = useRef(initial)
  const lastCommittedRef = useRef<Page>(initial)

  // Sync external page updates (e.g. from Page Studio modal)
  useEffect(() => {
    if (initial !== lastCommittedRef.current && initial !== pageRef.current && !dirty.current) {
      pageRef.current = initial
      setPageState(initial)
    }
  }, [initial])

  const { w: PW, h: PH } = dims(page.orient)

  const [tool, setTool] = useState<Tool>(() => (prefs().tool && prefs().tool !== "move" ? (prefs().tool as Tool) : "pen"))
  const [penStyle, setPenStyle] = useState<PenStyle>(() => prefs().penStyle ?? "fountain")
  const [colors, setColors] = useState(() => prefs().colors ?? { pen: INK[0], marker: NEON[0] })
  const [size, setSize] = useState(() => prefs().size ?? 4)
  const [streamline, setStreamline] = useState(() => prefs().streamline ?? 0.32)
  const [smartShapeOn, setSmartShapeOn] = useState(() => prefs().smartShapeOn ?? true)
  const [drawMode, setDrawMode] = useState<DrawMode>(() => prefs().drawMode ?? "smart")
  const [sensitivity, setSensitivity] = useState(() => prefs().sensitivity ?? 0.5)
  const [eraserMode, setEraserMode] = useState<"part" | "stroke">(() => prefs().eraserMode ?? "part")
  const [straight, setStraight] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)
  const customFonts = useCustomFonts()
  const packs = usePacks()
  const assetBackup = useAssetBackup()
  const [packId, setPackId] = useState<string | null>(null)
  const [loadedPack, setLoadedPack] = useState<{ id: string; items: SlicedSticker[] } | null>(null)
  const packItems = loadedPack && loadedPack.id === packId ? loadedPack.items : []
  const [slicing, setSlicing] = useState<number | null>(null)
  const packFileRef = useRef<HTMLInputElement>(null)
  const cursor = useRef({ x: 80, y: 120 })
  useEffect(() => {
    let alive = true
    if (!packId) return
    void loadPack(packId).then((l) => alive && setLoadedPack({ id: packId, items: l }))
    return () => {
      alive = false
    }
  }, [packId])
  const fontFileRef = useRef<HTMLInputElement>(null)
  const [selection, setLassoSel] = useState<Stroke[]>([])
  const lassoSel = useMemo(() => tool === "lasso" && selection.every(s => page.strokes.includes(s)) ? selection : [], [tool, selection, page.strokes])
  const swipeConsumed = useRef(false) // parmak kaydırması sayfa çevirdiyse o parmağın çizgisi atılır
  const straightRef = useRef(false)
  useLayoutEffect(() => { straightRef.current = straight }, [straight])
  const lassoPts = useRef<number[]>([])
  const lassoDrag = useRef<null | { mode: "move" | "scale"; sx: number; sy: number; base: Stroke[]; cur: Stroke[]; bb: { x0: number; y0: number; x1: number; y1: number }; last: number }>(null)
  useEffect(() => {
    PREFS = { tool, penStyle, colors, size, streamline, smartShapeOn, drawMode, sensitivity, eraserMode }
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(PREFS))
    } catch {}
  }, [tool, penStyle, colors, size, streamline, smartShapeOn, drawMode, sensitivity, eraserMode])

  const [sel, setSel] = useState<string | null>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [decorOpen, setDecorOpen] = useState(false)
  const [stickerTab, setStickerTab] = useState<StickerTab>("all")

  const [imgEdit, setImgEdit] = useState<null | { id: string; tab: "crop" | "bg" }>(null)
  const [dockPos, setDockPosState] = useState<DockPos>(() => {
    try {
      const v = localStorage.getItem("defterim_dock")
      if (v === "left" || v === "right" || v === "hidden") return v
    } catch {}
    return "bottom"
  })
  const setDockPos = (v: DockPos) => {
    setDockPosState(v)
    try {
      localStorage.setItem("defterim_dock", v)
    } catch {}
  }
  const sideInset = dockPos === "left" || dockPos === "right" ? 84 : 0
  const [scale, setScale] = useState(LAST_FIT.scale)
  const [histCount, setHistCount] = useState(() => {
    const h = HIST.get(initial.id)
    return { u: h?.u.length ?? 0, r: h?.r.length ?? 0 }
  })
  const [view, setView] = useState({ z: 1, x: 0, y: 0 })
  const [qz, setQz] = useState(1)
  const [insets, setInsets] = useState({ t: LAST_FIT.t, b: LAST_FIT.b })
  const insetsRef = useRef(insets)
  useLayoutEffect(() => { insetsRef.current = insets }, [insets])
  const topRef = useRef<HTMLDivElement>(null)
  const botRef = useRef<HTMLDivElement>(null)
  const crispKey = [qz, view.z, view.x, view.y, scale, insets.t, insets.b].join("/")
  const [paintedKey, setPaintedKey] = useState("")
  const crispRef = useRef(false)
  const inkZoomRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef(view)

  const boxRef = useRef<HTMLDivElement>(null)
  const tplRef = useRef<HTMLCanvasElement>(null)
  const inkRef = useRef<HTMLCanvasElement>(null)
  const wetRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const stickerFileRef = useRef<HTMLInputElement>(null)

  const live = useRef<Stroke | null>(null)
  const activePointerId = useRef<number | null>(null)
  const liveIsTouch = useRef(false)
  const liveStartedAt = useRef(0)
  const lastPenTime = useRef(0)
  const erasing = useRef(false)
  const shapeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastMovePos = useRef<{ x: number; y: number; t: number }>({ x: 0, y: 0, t: 0 })

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onChangeRef = useRef(onChange)

  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1
  const effScale = scale * qz
  const pinchRatio = view.z / (qz || 1)
  const isPinching = Math.abs(pinchRatio - 1) > 0.005
  // iOS Safari ~16 milyon pikselden büyük tuvale çizmeyi bırakır: sayfa tuvallerini sınırla,
  // yakınlaştırınca keskinliği ayrı bir "visible area" katmanı sağlar (aşağıda).
  const qMax = Math.sqrt(9_000_000 / (PW * PH))
  const q = Math.min(qMax, Math.max(1, scale * Math.min(qz, 1.35) * dpr * 1.25))
  const color = tool === "marker" ? colors.marker : colors.pen

  const streamlineRef = useRef(streamline)
  const drawModeRef = useRef(drawMode)
  const toolRef = useRef(tool)
  const scaleRef = useRef(scale)

  useEffect(() => {
    viewRef.current = view
    onChangeRef.current = onChange
    streamlineRef.current = streamline
    drawModeRef.current = drawMode
    toolRef.current = tool
    scaleRef.current = scale
  }, [view, onChange, streamline, drawMode, tool, scale])

  const getHist = (id: string) => {
    let h = HIST.get(id)
    if (!h) {
      h = { u: [], r: [] }
      HIST.set(id, h)
    }
    return h
  }

  // ---- persistence -------------------------------------------------------
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    if (dirty.current) {
      dirty.current = false
      lastCommittedRef.current = pageRef.current
      onChangeRef.current(pageRef.current)
    }
  }, [])

  useEffect(() => () => flush(), [flush])
  useEffect(() => {
    const h = () => document.visibilityState === "hidden" && flush()
    document.addEventListener("visibilitychange", h)
    window.addEventListener("pagehide", flush)
    window.addEventListener("beforeunload", flush)
    return () => {
      document.removeEventListener("visibilitychange", h)
      window.removeEventListener("pagehide", flush)
      window.removeEventListener("beforeunload", flush)
    }
  }, [flush])

  const commit = useCallback(
    (p: Page) => {
      pageRef.current = p
      setPageState(p)
      dirty.current = true
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, 120)
    },
    [flush],
  )

  const snapshot = useCallback(() => {
    const h = getHist(pageRef.current.id)
    h.u.push(pageRef.current)
    if (h.u.length > 60) h.u.shift()
    h.r.length = 0
    setHistCount({ u: h.u.length, r: 0 })
  }, [])

  const undo = useCallback(() => {
    const h = getHist(pageRef.current.id)
    const p = h.u.pop()
    if (!p) return
    h.r.push(pageRef.current)
    commit(p)
    setHistCount({ u: h.u.length, r: h.r.length })
  }, [commit])

  const redo = useCallback(() => {
    const h = getHist(pageRef.current.id)
    const p = h.r.pop()
    if (!p) return
    h.u.push(pageRef.current)
    commit(p)
    setHistCount({ u: h.u.length, r: h.r.length })
  }, [commit])

  const redoRef = useRef(redo)
  useLayoutEffect(() => { redoRef.current = redo }, [redo])
  const undoRef = useRef(undo)
  useEffect(() => {
    undoRef.current = undo
  }, [undo])

  // Keyboard shortcuts (Undo, Redo, Delete selected item, Escape)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
        if (e.key === "Escape") {
          setEditingTextId(null)
          target?.blur()
        }
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault()
        redo()
      } else if ((e.key === "Backspace" || e.key === "Delete") && sel && tool === "move") {
        const curItem = pageRef.current.items.find((it) => it.id === sel)
        if (curItem && !curItem.locked) {
          e.preventDefault()
          snapshot()
          commit({ ...pageRef.current, items: pageRef.current.items.filter((i) => i.id !== sel) })
          setSel(null)
        }
      } else if (e.key === "Escape") {
        setSel(null)
        setEditingTextId(null)
        setEmojiOpen(false)
        setDecorOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo, redo, sel, tool, snapshot, commit])

  // ---- wet-ink canvas drawing (0-lag live layer) -------------------------
  const wetBox = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const clearWet = useCallback(() => {
    const c = wetRef.current
    if (!c) return
    const ctx = c.getContext("2d")!
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    wetBox.current = null
  }, [])

  // Canlı mürekkep katmanı: her karede tüm tuvali değil, sadece çizginin kapladığı alanı siler (iPad'de GPU yükü çok düşer).
  const drawWet = useCallback(
    (s: Stroke | null, predictedPts?: number[]) => {
      const c = wetRef.current
      if (!c) return
      if (c.width !== Math.round(PW * q) || c.height !== Math.round(PH * q)) {
        c.width = Math.round(PW * q)
        c.height = Math.round(PH * q)
        wetBox.current = null
      }
      const ctx = c.getContext("2d")!
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      if (!s) {
        ctx.clearRect(0, 0, c.width, c.height)
        wetBox.current = null
        return
      }
      let b = wetBox.current
      const grow = (pts: number[]) => {
        for (let i = 0; i < pts.length; i += 3) {
          const x = pts[i], y = pts[i + 1]
          if (!b) b = { x0: x, y0: y, x1: x, y1: y }
          else {
            if (x < b.x0) b.x0 = x
            if (x > b.x1) b.x1 = x
            if (y < b.y0) b.y0 = y
            if (y > b.y1) b.y1 = y
          }
        }
      }
      grow(s.pts)
      if (predictedPts) grow(predictedPts)
      wetBox.current = b
      if (b) {
        const m = Math.max(s.size * 3, 26) + 6
        ctx.clearRect(Math.floor((b.x0 - m) * q), Math.floor((b.y0 - m) * q), Math.ceil((b.x1 - b.x0 + 2 * m) * q) + 2, Math.ceil((b.y1 - b.y0 + 2 * m) * q) + 2)
      }
      ctx.setTransform(q, 0, 0, q, 0, 0)
      const base = straightRef.current && s.pts.length > 3 ? collapseStraight(s) : s
      const renderStroke = !straightRef.current && predictedPts && predictedPts.length ? { ...base, pts: [...base.pts, ...predictedPts] } : base
      drawStroke(ctx, renderStroke, streamlineRef.current)
    },
    [PW, PH, q],
  )

  useEffect(() => {
    if (live.current) drawWet(live.current)
  }, [q, drawWet])

  // Yakınlaştırılmış görünümde sadece ekranda görünen kısmı yüksek çözünürlükte çizer.
  const drawCrisp = useCallback(() => {
    const el = boxRef.current
    const c = inkZoomRef.current
    if (!el || !c) return false
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return false
    const d = Math.min(dpr, Math.sqrt(9_000_000 / (r.width * r.height)))
    const w = Math.round(r.width * d), h = Math.round(r.height * d)
    if (c.width !== w || c.height !== h) {
      c.width = w
      c.height = h
    }
    const v = viewRef.current
    const sc = scaleRef.current * v.z
    const tx = Math.round(v.x), ty = Math.round(v.y)
    const ctx = c.getContext("2d")!
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, w, h)
    const k = sc * d
    const cyOff = (insetsRef.current.t - insetsRef.current.b) / 2
    ctx.setTransform(k, 0, 0, k, (r.width / 2 + tx) * d - (PW / 2) * k, (r.height / 2 + cyOff + ty) * d - (PH / 2) * k)
    const vx0 = -(r.width / 2 + tx) / sc + PW / 2, vx1 = (r.width - (r.width / 2 + tx)) / sc + PW / 2
    const vy0 = -(r.height / 2 + cyOff + ty) / sc + PH / 2, vy1 = (r.height - (r.height / 2 + cyOff + ty)) / sc + PH / 2
    const vis = pageRef.current.strokes.filter((s) => {
      const b = strokeBox(s)
      return b.x1 + 40 > vx0 && b.x0 - 40 < vx1 && b.y1 + 40 > vy0 && b.y0 - 40 < vy1
    })
    drawAll(ctx, vis, streamlineRef.current)
    return true
  }, [PW, PH, dpr])

  useEffect(() => {
    // Hareket ederken (kaydırma/yakınlaştırma) yumuşak sayfa tuvali görünür; durunca keskin katman açılır.
    crispRef.current = false
    if (qz <= 1.35 || isPinching || Math.abs(qz - view.z) > 0.005) return
    const t = setTimeout(() => {
      if (drawCrisp()) {
        crispRef.current = true
        setPaintedKey(crispKey)
      }
    }, 140)
    return () => clearTimeout(t)
  }, [qz, view.x, view.y, view.z, isPinching, drawCrisp, crispKey])

  useEffect(() => {
    if (crispRef.current) drawCrisp()
  }, [page.strokes, drawCrisp])

  // ---- touch gestures (pinch zoom, pan, two-finger tap undo) -------------
  const zoomTo = (z: number) => {
    z = Math.min(5, Math.max(1, z))
    setView((v) => ({ z, x: z === 1 ? 0 : v.x * (z / v.z), y: z === 1 ? 0 : v.y * (z / v.z) }))
    setQz(z)
  }

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    type P = { x: number; y: number; sx: number; sy: number; t: number }
    const pts = new Map<number, P>()
    let t0 = 0
    let moved = false
    let two = false
    let g: { d0: number; cx: number; cy: number; z0: number; tx: number; ty: number } | null = null
    let turn: { dir: 1 | -1; x0: number; cur: number; samples: { x: number; t: number }[] } | null = null
    const taps: { t: number; x: number; y: number }[] = []
    let lastEvt = 0

    const apply = (z: number, x: number, y: number) => {
      z = Math.min(5, Math.max(1, z))
      const bx = (PW * scaleRef.current * z) / 2,
        by = (PH * scaleRef.current * z) / 2
      setView({ z, x: z === 1 ? 0 : Math.max(-bx, Math.min(bx, x)), y: z === 1 ? 0 : Math.max(-by, Math.min(by, y)) })
    }

    const cancelPendingTouchStroke = () => {
      if (liveIsTouch.current && live.current) {
        live.current = null
        liveIsTouch.current = false
        activePointerId.current = null
        if (shapeTimer.current) clearTimeout(shapeTimer.current)
        clearWet()
      }
    }

    const penActiveRecently = () => (!liveIsTouch.current && activePointerId.current !== null) || performance.now() - lastPenTime.current < 450

    const endTurn = (commit: boolean) => {
      if (!turn) return
      turn = null
      turnRef.current?.("end", { commit })
    }
    // Eksik pointerup/cancel olayları hareketi takılı bırakmasın diye her şeyi sıfırlar
    const resetAll = () => {
      pts.clear()
      g = null
      moved = false
      two = false
      endTurn(false)
    }
    const turnAllowed = () => {
      const tl = toolRef.current
      if (drawModeRef.current === "pencilOnly") return tl !== "move" && tl !== "lasso"
      return tl === "pen" || tl === "marker" || tl === "text"
    }

    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return
      if ((e.target as HTMLElement | null)?.closest?.("[data-item]")) return // nesne tutulurken sayfa oynamasın
      if (penActiveRecently()) return
      const now = e.timeStamp
      lastEvt = performance.now()
      for (const [id, p] of pts) if (now - p.t > 1200) pts.delete(id) // takılı kalmış parmakları temizle
      if (pts.size === 0) {
        t0 = now
        moved = false
        two = false
        g = null
        endTurn(false)
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: now })
      if (pts.size >= 2) {
        two = true
        endTurn(false)
        cancelPendingTouchStroke()
        const [a, b] = [...pts.values()]
        const v = viewRef.current
        g = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, z0: v.z, tx: v.x, ty: v.y }
      }
    }

    const move = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return
      if (penActiveRecently()) return
      const p = pts.get(e.pointerId)
      if (!p) return
      lastEvt = performance.now()
      const dx = e.clientX - p.x,
        dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      p.t = e.timeStamp
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 16) moved = true

      // Tek parmakla sayfa çevirme (parmağı takip eder)
      if (pts.size === 1 && !two && viewRef.current.z <= 1.02 && turnRef.current) {
        const horiz = swipeRef.current.axis === "x"
        const along = horiz ? e.clientX - p.sx : e.clientY - p.sy
        const cross = horiz ? e.clientY - p.sy : e.clientX - p.sx
        if (!turn && turnAllowed() && Math.abs(along) > 12 && Math.abs(along) > Math.abs(cross) * 1.3) {
          turn = { dir: along < 0 ? 1 : -1, x0: horiz ? p.sx : p.sy, cur: 0, samples: [] }
          cancelPendingTouchStroke() // parmakla çizilmeye başlanan çizgi atılır
          turnRef.current("start", { dir: turn.dir })
        }
        if (turn) {
          const cur = horiz ? e.clientX : e.clientY
          turn.cur = cur
          turn.samples.push({ x: cur, t: e.timeStamp })
          if (turn.samples.length > 6) turn.samples.shift()
          turnRef.current("move", { dx: cur - turn.x0 })
          return
        }
      }

      if (pts.size >= 2 && g) {
        const [a, b] = [...pts.values()]
        const z1 = Math.min(5, Math.max(1, (g.z0 * Math.hypot(a.x - b.x, a.y - b.y)) / g.d0))
        const r = el.getBoundingClientRect()
        const Cx = r.left + r.width / 2,
          Cy = r.top + r.height / 2 + (insetsRef.current.t - insetsRef.current.b) / 2
        const p0x = (g.cx - Cx - g.tx) / g.z0,
          p0y = (g.cy - Cy - g.ty) / g.z0
        apply(z1, (a.x + b.x) / 2 - Cx - z1 * p0x, (a.y + b.y) / 2 - Cy - z1 * p0y)
      } else if (pts.size === 1 && moved && viewRef.current.z > 1 && drawModeRef.current === "pencilOnly") {
        const v = viewRef.current
        apply(v.z, v.x + dx, v.y + dy)
      }
    }

    const up = (e: PointerEvent) => {
      const pp = pts.get(e.pointerId)
      if (!pts.delete(e.pointerId)) return
      lastEvt = performance.now()
      if (turn) {
        if (pts.size > 0) return
        const t = turn
        const len = (swipeRef.current.axis === "x" ? el.clientWidth : el.clientHeight) || 800
        const prog = -(t.cur - t.x0) * t.dir
        const s0 = t.samples[0]
        const s1 = t.samples[t.samples.length - 1]
        const vel = s0 && s1 && s1.t > s0.t ? (s1.x - s0.x) / (s1.t - s0.t) : 0
        endTurn(prog > len * 0.2 || (-vel * t.dir > 0.4 && prog > 24))
        return
      }
      if (pts.size < 2) g = null
      if (pts.size === 0) setQz(viewRef.current.z)
      if (penActiveRecently()) return
      if (pts.size > 0 || moved) return
      const dur = e.timeStamp - t0
      if (two) {
        two = false
        if (dur < 650) undoRef.current() // iki parmakla dokun = geri al
        taps.length = 0
        return
      }
      if (dur < 300 && pp) {
        const r = el.getBoundingClientRect()
        const fx = (e.clientX - r.left) / r.width
        const tl = toolRef.current
        if (edgeRef.current.cb && edgeRef.current.on && tl !== "move" && tl !== "lasso" && (fx < 0.1 || fx > 0.9)) {
          taps.length = 0
          edgeRef.current.cb(fx < 0.5 ? -1 : 1) // kenara dokun = sayfa çevir
          return
        }
        // üç kez dokun = ileri al
        const now = e.timeStamp
        while (taps.length && now - taps[0].t > 900) taps.shift()
        if (taps.length && Math.hypot(e.clientX - taps[taps.length - 1].x, e.clientY - taps[taps.length - 1].y) > 70) taps.length = 0
        taps.push({ t: now, x: e.clientX, y: e.clientY })
        if (taps.length >= 3) {
          taps.length = 0
          redoRef.current()
        }
      }
    }

    const cancel = (e: PointerEvent) => {
      pts.delete(e.pointerId)
      if (turn && pts.size === 0) endTurn(false)
      if (pts.size < 2) g = null
      if (pts.size === 0) setQz(viewRef.current.z)
    }

    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const v = viewRef.current
      const z = Math.min(5, Math.max(1, v.z * (1 - e.deltaY * 0.01)))
      apply(z, v.x * (z / v.z), v.y * (z / v.z))
      setQz(z)
    }

    // Yedek: parmak ekrandan tamamen kalktığında her şeyi sıfırla (pointerup kaçsa bile takılı kalmaz)
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0 && (pts.size > 0 || turn)) resetAll()
    }
    const onHide = () => resetAll()
    const watchdog = window.setInterval(() => {
      if ((pts.size > 0 || turn) && performance.now() - lastEvt > 2500) resetAll()
    }, 1000)

    el.addEventListener("pointerdown", down)
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
    el.addEventListener("pointercancel", cancel)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", cancel)
    window.addEventListener("touchend", onTouchEnd, { passive: true })
    window.addEventListener("touchcancel", onTouchEnd, { passive: true })
    window.addEventListener("blur", onHide)
    document.addEventListener("visibilitychange", onHide)
    el.addEventListener("wheel", wheel, { passive: false })
    return () => {
      window.clearInterval(watchdog)
      el.removeEventListener("pointerdown", down)
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
      el.removeEventListener("pointercancel", cancel)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", cancel)
      window.removeEventListener("touchend", onTouchEnd)
      window.removeEventListener("touchcancel", onTouchEnd)
      window.removeEventListener("blur", onHide)
      document.removeEventListener("visibilitychange", onHide)
      el.removeEventListener("wheel", wheel)
    }
  }, [PW, PH, clearWet])

  // Prevent iOS Safari Scribble / selection / scroll delay when Apple Pencil touches the canvas
  useEffect(() => {
    const el = wetRef.current
    if (!el) return
    const stopTouch = (e: TouchEvent) => {
      const t = e.touches[0] as (Touch & { touchType?: string }) | undefined
      const isStylus = t?.touchType === "stylus"
      if (isStylus || (e.touches.length === 1 && drawModeRef.current === "smart" && toolRef.current !== "move" && toolRef.current !== "text")) {
        e.preventDefault()
      }
    }
    el.addEventListener("touchstart", stopTouch, { passive: false })
    el.addEventListener("touchmove", stopTouch, { passive: false })
    return () => {
      el.removeEventListener("touchstart", stopTouch)
      el.removeEventListener("touchmove", stopTouch)
    }
  }, [])

  // ---- layout & canvases -------------------------------------------------
  // Ölçüler boyamadan önce (senkron) hesaplanır: sayfa değişirken kısa süreli büyüme/küçülme olmaz
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const calc = () => {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return
      const sc = Math.max(0.2, Math.min((r.width - sideInset * 2 - 12) / PW, (r.height - insets.t - insets.b - 12) / PH))
      LAST_FIT.scale = sc
      setScale(sc)
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [PW, PH, insets, sideInset])

  // Üst çubuk ve alt dock sayfanın üstünde yüzer; sayfa bunların arasındaki alana sığdırılır
  useLayoutEffect(() => {
    const measure = () => {
      const t = topRef.current?.offsetHeight ?? 0
      const b = botRef.current?.offsetHeight ?? 0
      LAST_FIT.t = t
      LAST_FIT.b = b
      setInsets((o) => (o.t === t && o.b === b ? o : { t, b }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (topRef.current) ro.observe(topRef.current)
    if (botRef.current) ro.observe(botRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const c = tplRef.current
    if (!c) return
    let alive = true
    c.width = Math.round(PW * q)
    c.height = Math.round(PH * q)
    const run = async () => {
      let bgImg: HTMLImageElement | null = null
      if (page.config?.bgImage) {
        try {
          bgImg = await loadImg(page.config.bgImage)
        } catch {}
      }
      if (!alive) return
      const ctx = c.getContext("2d")!
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = "high"
      ctx.setTransform(q, 0, 0, q, 0, 0)
      ctx.clearRect(0, 0, PW, PH)
      drawTemplate(ctx, page.template, PW, PH, page.config, bgImg)
    }
    void run()
    return () => {
      alive = false
    }
  }, [page.template, page.config, q, PW, PH])

  const redrawInk = useCallback(() => {
    const c = inkRef.current
    if (!c) return
    if (c.width !== Math.round(PW * q) || c.height !== Math.round(PH * q)) {
      c.width = Math.round(PW * q)
      c.height = Math.round(PH * q)
    }
    const ctx = c.getContext("2d")!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.setTransform(q, 0, 0, q, 0, 0)
    drawAll(ctx, pageRef.current.strokes, streamline)
  }, [PW, PH, q, streamline])

  useEffect(() => redrawInk(), [page.strokes, redrawInk])

  // ---- drawing & smart palm rejection ------------------------------------
  const pt = (clientX: number, clientY: number) => {
    const r = wetRef.current!.getBoundingClientRect()
    const k = r.width / PW
    return [(clientX - r.left) / k, (clientY - r.top) / k] as const
  }

  const getPressure = (e: { pointerType: string; pressure: number; altitudeAngle?: number }, style?: PenStyle) => {
    if (e.pointerType !== "pen") return 0.5
    const raw = e.pressure > 0 ? e.pressure : 0.5
    // Hassasiyet 50% = doğrusal; yükseldikçe hafif dokunuş bile kalın çizer
    let p = Math.pow(raw, Math.pow(2, (0.5 - sensitivity) * 2))
    if (style === "pencil") {
      // Kurşun kalem: kalemi yatırdıkça (eğim) çizgi genişler
      const tilt = 1 - Math.min(1, Math.max(0, (e.altitudeAngle ?? Math.PI / 2) / (Math.PI / 2)))
      p = Math.min(1, (0.3 + 0.7 * p) * (0.45 + 0.9 * tilt))
    }
    return p
  }

  const eraseAt = (x: number, y: number) => {
    const part = eraserMode === "part"
    const R = part ? 5 + size * 1.1 : 14 + size
    const cur = pageRef.current
    const next: Stroke[] = []
    let changed = false
    for (const s of cur.strokes) {
      const bb = strokeBox(s)
      if (x < bb.x0 - R * 1.7 || x > bb.x1 + R * 1.7 || y < bb.y0 - R * 1.7 || y > bb.y1 + R * 1.7) {
        next.push(s)
        continue
      }
      if (part) {
        const frags = eraseFromStroke(s, x, y, R)
        if (frags === null) next.push(s)
        else {
          changed = true
          next.push(...frags)
        }
      } else if (strokeHit(s, x, y, R)) changed = true
      else next.push(s)
    }
    if (changed) commit({ ...cur, strokes: next })
  }

  const scheduleSmartShape = () => {
    if (shapeTimer.current) clearTimeout(shapeTimer.current)
    if (!smartShapeOn || straightRef.current || toolRef.current === "eraser" || toolRef.current === "lasso") return
    shapeTimer.current = setTimeout(() => {
      const s = live.current
      if (!s) return
      const snapped = snapShape(s)
      if (snapped) {
        live.current = snapped
        drawWet(snapped)
      }
    }, 440)
  }

  const paintLasso = () => {
    const c = wetRef.current
    if (!c) return
    if (c.width !== Math.round(PW * q) || c.height !== Math.round(PH * q)) {
      c.width = Math.round(PW * q)
      c.height = Math.round(PH * q)
    }
    const ctx = c.getContext("2d")!
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    wetBox.current = null
    const p = lassoPts.current
    if (p.length < 4) return
    ctx.setTransform(q, 0, 0, q, 0, 0)
    ctx.beginPath()
    ctx.moveTo(p[0], p[1])
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1])
    ctx.closePath()
    ctx.fillStyle = "rgba(214,70,160,0.12)"
    ctx.fill()
    ctx.setLineDash([9, 6])
    ctx.lineWidth = 2
    ctx.strokeStyle = "rgba(190,50,140,0.9)"
    ctx.stroke()
  }

  const lassoDown = (e: React.PointerEvent<HTMLCanvasElement>, x: number, y: number) => {
    activePointerId.current = e.pointerId
    liveIsTouch.current = e.pointerType === "touch"
    e.currentTarget.setPointerCapture(e.pointerId)
    const bb = lassoSel.length ? bboxOf(lassoSel) : null
    if (bb) {
      const pad = 10
      const nearHandle = Math.hypot(x - (bb.x1 + pad), y - (bb.y1 + pad)) < 30
      const inside = x > bb.x0 - pad && x < bb.x1 + pad && y > bb.y0 - pad && y < bb.y1 + pad
      if (nearHandle || inside) {
        snapshot()
        lassoDrag.current = { mode: nearHandle ? "scale" : "move", sx: x, sy: y, base: lassoSel, cur: lassoSel, bb, last: 0 }
        return
      }
    }
    setLassoSel([])
    lassoPts.current = [x, y]
    paintLasso()
  }

  const lassoMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = lassoDrag.current
    if (d) {
      const now = performance.now()
      if (now - d.last < 14) return
      d.last = now
      const [x, y] = pt(e.clientX, e.clientY)
      let moved: Stroke[]
      if (d.mode === "move") moved = d.base.map((s) => moveStroke(s, x - d.sx, y - d.sy))
      else {
        const w0 = Math.max(20, d.bb.x1 - d.bb.x0)
        const k = Math.max(0.2, Math.min(6, (w0 + (x - d.sx)) / w0))
        moved = d.base.map((s) => scaleStroke(s, d.bb.x0, d.bb.y0, k))
      }
      const map = new Map<Stroke, Stroke>()
      d.cur.forEach((s, i) => map.set(s, moved[i]))
      commit({ ...pageRef.current, strokes: pageRef.current.strokes.map((s) => map.get(s) ?? s) })
      d.cur = moved
      setLassoSel(moved)
      return
    }
    if (lassoPts.current.length) {
      const evs = e.nativeEvent.getCoalescedEvents?.()
      for (const ev of evs && evs.length ? evs : [e.nativeEvent]) lassoPts.current.push(...pt(ev.clientX, ev.clientY))
      paintLasso()
    }
  }

  const replaceSelected = (fn: (s: Stroke) => Stroke) => {
    snapshot()
    const map = new Map<Stroke, Stroke>(lassoSel.map((s) => [s, fn(s)]))
    commit({ ...pageRef.current, strokes: pageRef.current.strokes.map((s) => map.get(s) ?? s) })
    setLassoSel(lassoSel.map((s) => map.get(s)!))
  }

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setPanel(null)
    setEmojiOpen(false)
    setDecorOpen(false)
    if (Math.abs(qz - viewRef.current.z) > 0.005) setQz(viewRef.current.z)

    if (e.pointerType === "mouse" && e.button !== 0) return

    // Palm rejection & pointer arbitration:
    if (e.pointerType === "pen") {
      lastPenTime.current = performance.now()
      // If a palm/touch stroke accidentally started moments ago, override it immediately
      if (liveIsTouch.current && live.current) {
        live.current = null
        clearWet()
      }
    } else if (e.pointerType === "touch") {
      if (drawMode === "pencilOnly") return
      // Reject wide palm contacts or touches immediately following Apple Pencil
      if (e.width > 28 || e.height > 28) return
      if (performance.now() - lastPenTime.current < 450) return
      if (activePointerId.current !== null) return
    }

    const [x, y] = pt(e.clientX, e.clientY)

    if (tool === "lasso") {
      lassoDown(e, x, y)
      return
    }

    // Text tool: click anywhere to spawn an editable text box
    if (tool === "text") {
      const id = uid()
      const box: Item = {
        id,
        kind: "textbox",
        text: "Add a note…",
        x: Math.max(20, Math.min(PW - 260, x - 110)),
        y: Math.max(20, Math.min(PH - 80, y - 30)),
        w: 240,
        h: 72,
        rot: 0,
        fontFamily: "hand",
        fontSize: 26,
        color: colors.pen === "#ffffff" ? "#25252b" : colors.pen,
        bgColor: "transparent",
        align: "left",
      }
      snapshot()
      commit({ ...pageRef.current, items: [...pageRef.current.items, box] })
      setTool("move")
      setSel(id)
      setEditingTextId(id)
      return
    }

    activePointerId.current = e.pointerId
    liveIsTouch.current = e.pointerType === "touch"
    liveStartedAt.current = performance.now()
    e.currentTarget.setPointerCapture(e.pointerId)

    if (tool === "eraser") {
      snapshot()
      erasing.current = true
      eraseAt(x, y)
      return
    }

    const s: Stroke = {
      tool: tool as "pen" | "marker",
      penStyle: tool === "marker" ? "marker" : penStyle,
      color,
      size,
      pts: [x, y, getPressure(e, tool === "marker" ? "marker" : penStyle)],
    }
    live.current = s
    lastMovePos.current = { x, y, t: performance.now() }
    drawWet(s)
    scheduleSmartShape()
  }

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerId !== activePointerId.current) return
    if (e.pointerType === "pen") lastPenTime.current = performance.now()

    if (tool === "lasso") {
      lassoMove(e)
      return
    }

    const evs = e.nativeEvent.getCoalescedEvents?.()
    const list = evs && evs.length ? evs : [e.nativeEvent]

    if (erasing.current) {
      for (const ev of list) eraseAt(...pt(ev.clientX, ev.clientY))
      return
    }

    const s = live.current
    if (!s) return

    let movedFar = false
    for (const ev of list) {
      const [x, y] = pt(ev.clientX, ev.clientY)
      s.pts.push(x, y, getPressure(ev, s.penStyle))
      if (Math.hypot(x - lastMovePos.current.x, y - lastMovePos.current.y) > 5) {
        lastMovePos.current = { x, y, t: performance.now() }
        movedFar = true
      }
    }

    // Collect predicted events for zero-latency visual feedback on iPadOS
    const predEvs = (e.nativeEvent as PointerEvent & { getPredictedEvents?: () => PointerEvent[] }).getPredictedEvents?.()
    let predictedPts: number[] | undefined
    if (predEvs && predEvs.length) {
      predictedPts = []
      for (const pev of predEvs) {
        const [px, py] = pt(pev.clientX, pev.clientY)
        predictedPts.push(px, py, getPressure(pev, s.penStyle))
      }
    }

    drawWet(s, predictedPts)
    if (movedFar) scheduleSmartShape()
  }

  const finishStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerId !== activePointerId.current) return
    const wasTouch = liveIsTouch.current
    activePointerId.current = null
    liveIsTouch.current = false
    erasing.current = false
    if (shapeTimer.current) {
      clearTimeout(shapeTimer.current)
      shapeTimer.current = null
    }
    if (swipeConsumed.current) {
      swipeConsumed.current = false
      live.current = null
      clearWet()
      return
    }
    if (lassoDrag.current) {
      lassoDrag.current = null
      return
    }
    if (lassoPts.current.length) {
      const poly = lassoPts.current
      lassoPts.current = []
      clearWet()
      setLassoSel(strokesInLasso(pageRef.current.strokes, poly))
      return
    }
    const s0 = live.current
    if (s0 && wasTouch && toolRef.current !== "eraser") {
      // parmakla kısa dokunuş (tek nokta) çizgi bırakmaz: üç kez dokunma / kenar dokunuşu için
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
      for (let i = 0; i < s0.pts.length; i += 3) {
        x0 = Math.min(x0, s0.pts[i])
        x1 = Math.max(x1, s0.pts[i])
        y0 = Math.min(y0, s0.pts[i + 1])
        y1 = Math.max(y1, s0.pts[i + 1])
      }
      if (x1 - x0 < 12 && y1 - y0 < 12 && performance.now() - liveStartedAt.current < 320) {
        live.current = null
        clearWet()
        return
      }
    }
    const s = s0 && straightRef.current && s0.pts.length > 3 ? collapseStraight(s0) : s0
    live.current = null
    clearWet()
    if (!s) return
    snapshot()
    commit({ ...pageRef.current, strokes: [...pageRef.current.strokes, s] })
  }

  const cancelStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerId !== activePointerId.current) return
    activePointerId.current = null
    liveIsTouch.current = false
    erasing.current = false
    if (shapeTimer.current) clearTimeout(shapeTimer.current)
    live.current = null
    lassoPts.current = []
    lassoDrag.current = null
    clearWet()
  }

  // ---- items (photos / stickers / widgets / textboxes) ------------------
  const updItem = (id: string, patch: Partial<Item>) =>
    commit({ ...pageRef.current, items: pageRef.current.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })

  const addItems = (list: Item[]) => {
    snapshot()
    commit({ ...pageRef.current, items: [...pageRef.current.items, ...list] })
    setTool("move")
    setSel(list[list.length - 1].id)
  }

  const onFiles = async (files: FileList | null, asSticker = false) => {
    if (!files) return
    const out: Item[] = []
    let k = 0
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue
      const res = await fileToDataUrl(f, asSticker ? 700 : 1400)
      let src = res.src
      const { w, h } = res
      if (asSticker && !/png|webp|gif|svg/.test(f.type)) {
        try {
          src = await removeWhiteBackground(src, 232)
        } catch {}
      }
      await loadImg(src)
      const iw = Math.min(asSticker ? 260 : 380, w)
      const ih = (iw * h) / w
      if (asSticker && onSaveCustomSticker) {
        onSaveCustomSticker({ label: f.name.replace(/\.[^.]+$/, "") || "Sticker", src, w: iw, h: ih })
      }
      out.push({
        id: uid(),
        kind: asSticker ? "sticker" : "image",
        src,
        x: Math.max(40, (PW - iw) / 2 + k * 28),
        y: Math.max(40, (PH - ih) / 2 + k * 28),
        w: iw,
        h: ih,
        rot: 0,
        frame: asSticker ? "none" : "rounded",
      })
      k++
    }
    if (out.length) addItems(out)
    if (fileRef.current) fileRef.current.value = ""
    if (stickerFileRef.current) stickerFileRef.current.value = ""
  }

  const itemDrag = (
    e: React.PointerEvent,
    it: Item,
    mode: "move" | "resize" | "resizeW" | "resizeH" | "rotate",
    el: HTMLElement,
  ) => {
    e.stopPropagation()
    e.preventDefault()
    setSel(it.id)
    if (it.locked) return // kilitliyse sadece seçilir (kilidi açmak için), sürüklenmez
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    snapshot()
    const sx = e.clientX,
      sy = e.clientY
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2,
      cy = r.top + r.height / 2
    const ratio = it.h / it.w
    const factor = scale * view.z

    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / factor
      const dy = (ev.clientY - sy) / factor
      if (mode === "move") {
        updItem(it.id, { x: it.x + dx, y: it.y + dy })
      } else if (mode === "resize") {
        const w = Math.max(36, it.w + dx)
        const h = it.kind === "textbox" && !it.keepRatio ? Math.max(36, it.h + dy) : w * ratio
        updItem(it.id, { w, h })
      } else if (mode === "resizeW") {
        updItem(it.id, { w: Math.max(40, it.w + dx) })
      } else if (mode === "resizeH") {
        updItem(it.id, { h: Math.max(24, it.h + dy) })
      } else {
        updItem(it.id, { rot: Math.round((Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90) })
      }
    }
    const up = () => {
      target.removeEventListener("pointermove", move)
      target.removeEventListener("pointerup", up)
      target.removeEventListener("pointercancel", up)
      flush() // taşıma/ölçekleme bitince hemen kaydet
    }
    target.addEventListener("pointermove", move)
    target.addEventListener("pointerup", up)
    target.addEventListener("pointercancel", up)
  }

  /** Paketten bir sticker ekle: art arda eklenen harfler yan yana dizilir (kelime yazar gibi). */
  const addPackSticker = (st: SlicedSticker) => {
    const k = Math.min(120 / st.h, 170 / st.w)
    const w = st.w * k, h = st.h * k
    let { x, y } = cursor.current
    if (x + w > PW - 50) {
      x = 80
      y += 110
    }
    if (y + h > PH - 40) y = 80
    addItems([{ id: uid(), kind: "sticker", src: st.src, x, y, w, h, rot: 0 }])
    cursor.current = { x: x + w * 0.88, y }
  }

  const importSheet = async (file: File | undefined) => {
    if (!file) return
    const name = (prompt("What should we name this sticker pack?", file.name.replace(/\.[^.]+$/, "")) || "").trim()
    if (!name) return
    setSlicing(0)
    try {
      const list = await sliceSheet(file, (p) => setSlicing(p))
      if (!list.length) {
        alert("No separate pieces found in this image. Try a sticker sheet on a white background.")
        return
      }
      const pack = await addPack(name, list)
      setStickerTab("mine")
      setPackId(pack.id)
    } catch {
      alert("Could not read the sticker sheet.")
    } finally {
      setSlicing(null)
    }
  }

  const addDecor = (d: Decor) => {
    setDecorOpen(false)
    addItems([
      {
        id: uid(),
        kind: d.kind ?? "sticker",
        src: d.src,
        x: (PW - d.w) / 2,
        y: (PH - d.h) / 2,
        w: d.w,
        h: d.h,
        rot: 0,
      },
    ])
  }

  const addCustomStickerToPage = (s: CustomSticker) => {
    setDecorOpen(false)
    addItems([
      {
        id: uid(),
        kind: "sticker",
        src: s.src,
        x: (PW - s.w) / 2,
        y: (PH - s.h) / 2,
        w: s.w,
        h: s.h,
        rot: 0,
      },
    ])
  }

  const addNewTextBox = (pill = false) => {
    const id = uid()
    const box: Item = {
      id,
      kind: "textbox",
      text: pill ? "Label title" : "Write here…",
      x: PW / 2 - 120,
      y: PH / 2 - 36,
      w: 240,
      h: pill ? 54 : 84,
      rot: 0,
      fontFamily: pill ? "sans" : "hand",
      fontSize: pill ? 20 : 26,
      color: "#25252b",
      bgColor: pill ? "#fbcfe8" : "transparent",
      align: pill ? "center" : "left",
      bold: pill,
      pill,
    }
    addItems([box])
    setEditingTextId(id)
  }

  const it = imgEdit ? page.items.find(item => item.id === imgEdit.id) : undefined
  const selItem = page.items.find((i) => i.id === sel)
  const showMonthTabs = page.config?.showMonthTabs ?? (page.template === "ivory_freestyle" || page.template === "pastel_week" || page.template === "week_grid")
  const showTopTabs = page.config?.showTopTabs ?? page.template === "pastel_week"

  const selBox = useMemo(() => (lassoSel.length ? bboxOf(lassoSel) : null), [lassoSel])

  return (
    <div className="relative h-full min-h-0 overflow-hidden bg-cream-deep select-none [-webkit-touch-callout:none]">

      {/* ---- Canvas Stage ------------------------------------------------ */}
      <div ref={boxRef} className="absolute inset-0 touch-none overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center" style={{ paddingTop: insets.t, paddingBottom: insets.b, paddingLeft: sideInset, paddingRight: sideInset }}>
          <div
            data-page-stage=""
            className="relative shrink-0 overflow-hidden rounded-sm shadow-lift"
            style={{
              width: PW * effScale,
              height: PH * effScale,
              background: page.bg ?? PAPER,
              transform: isPinching
                ? `translate3d(${view.x}px, ${view.y}px, 0) scale(${pinchRatio})`
                : `translate(${Math.round(view.x)}px, ${Math.round(view.y)}px)`,
              willChange: isPinching ? "transform" : "auto",
            }}
          >
            {/* Layer 1: Template & Custom Background */}
            <canvas ref={tplRef} className="absolute inset-0 h-full w-full" />
            {page.texture !== false && (
              <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: `url(${grainDataUrl()})`, backgroundSize: `${128 * effScale}px` }} />
            )}

            {/* Optional Top Planner Tabs (PROJECT / TRACKER / EXPENSE / REFLECT / JOURNAL) */}
            {showTopTabs && tabs && tabs.length > 0 && (
              <div
                className="absolute left-0 top-0 z-10 flex items-center gap-1 px-3 pt-1 origin-top-left"
                style={{ width: PW, transform: `scale(${effScale})` }}
              >
                {tabs.map((tb) => {
                  const isActive = activePageIndex === tb.pageIndex
                  return (
                    <button
                      key={tb.id}
                      onClick={() => tb.pageIndex !== undefined && onJumpPage?.(tb.pageIndex)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-t-xl border border-b-0 border-line/70 px-3 py-1 text-[11px] font-bold tracking-wider transition",
                        isActive ? "bg-paper text-stone-900 shadow-soft" : "opacity-80 hover:opacity-100",
                      )}
                      style={{ backgroundColor: isActive ? "#ffffff" : tb.color }}
                    >
                      <span>{tb.emoji}</span>
                      <span>{tb.label}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Optional Right Edge Month Tabs (JAN..DEC) */}
            {showMonthTabs && (
              <div
                className="absolute right-0 top-0 z-10 flex flex-col justify-between py-4 origin-top-right"
                style={{ height: PH, width: 32, transform: `scale(${effScale})` }}
              >
                {MONTHS_SHORT.map((m, mIdx) => {
                  const active = (page.config?.monthIndex ?? 3) === mIdx
                  return (
                    <button
                      key={m}
                      onClick={() => onJumpMonth?.(mIdx)}
                      className={cn(
                        "flex flex-1 items-center justify-center border-l border-line/60 text-[10px] font-bold tracking-widest transition",
                        active ? "bg-rose text-ink" : "bg-cream/80 text-ink-soft hover:bg-cream-deep",
                      )}
                      style={{ writingMode: "vertical-rl" }}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Layer 2: Draggable / Editable Items (Photos, Stickers, Widgets, Textboxes) */}
            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{ width: PW, height: PH, transform: `scale(${effScale})` }}
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) {
                  setSel(null)
                  setEditingTextId(null)
                }
              }}
            >
              {page.items.map((it) => {
                const isSelected = sel === it.id && tool === "move"
                const isEditing = editingTextId === it.id
                const canHit = tool === "move"
                const frameCls =
                  it.frame === "polaroid"
                    ? "bg-[#fdfcf9] p-3.5 pb-11 shadow-lg"
                    : it.frame === "rounded"
                      ? "overflow-hidden rounded-2xl shadow-soft"
                      : it.frame === "shadow"
                        ? "drop-shadow-[0_6px_14px_rgba(0,0,0,0.24)]"
                        : ""

                return (
                  <div
                    key={it.id}
                    data-item=""
                    onPointerDown={(e) => canHit && itemDrag(e, it, "move", e.currentTarget)}
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      setTool("move")
                      setSel(it.id)
                      if (it.kind === "textbox") setEditingTextId(it.id)
                    }}
                    className={cn(
                      "absolute touch-none",
                      canHit ? "cursor-move" : "pointer-events-none",
                      isSelected && "outline outline-2 outline-offset-2 outline-sky-500",
                    )}
                    style={{
                      left: it.x,
                      top: it.y,
                      width: it.w,
                      height: it.h,
                      opacity: it.opacity ?? 1,
                      transform: `rotate(${it.rot}deg)`,
                    }}
                  >
                    {/* Content */}
                    {it.kind === "textbox" ? (
                      <div
                        className={cn("flex h-full w-full items-center overflow-hidden", it.pill ? "rounded-full px-4" : "rounded-xl px-3 py-2")}
                        style={{
                          backgroundColor: it.bgColor ?? "transparent",
                          border: it.borderColor && it.borderColor !== "transparent" ? `2px solid ${it.borderColor}` : undefined,
                          fontFamily: resolveFontFamily(it.fontFamily),
                          fontSize: it.fontSize ?? 26,
                          color: it.color ?? "#25252b",
                          fontWeight: it.bold ? 700 : 500,
                          fontStyle: it.italic ? "italic" : "normal",
                          textAlign: it.align ?? "left",
                        }}
                      >
                        {isEditing ? (
                          <textarea
                            autoFocus
                            value={it.text ?? ""}
                            onChange={(e) => updItem(it.id, { text: e.target.value })}
                            onPointerDown={(e) => e.stopPropagation()}
                            onBlur={() => {
                              setEditingTextId(null)
                              flush()
                            }}
                            className="h-full w-full resize-none bg-transparent outline-none"
                            style={{ textAlign: it.align ?? "left" }}
                          />
                        ) : (
                          <div className="w-full whitespace-pre-wrap break-words leading-snug">{it.text}</div>
                        )}
                      </div>
                    ) : it.src ? (
                      <div className={cn("relative h-full w-full", frameCls)} style={{ transform: it.flipX ? "scaleX(-1)" : undefined }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={it.src}
                          alt=""
                          draggable={false}
                          className={cn("h-full w-full", it.frame === "polaroid" ? "object-cover" : "object-fill")}
                        />
                        {it.frame === "polaroid" && it.caption && (
                          <div
                            className="absolute inset-x-2 bottom-2 truncate text-center text-lg text-ink"
                            style={{ fontFamily: "'Bradley Hand', cursive" }}
                          >
                            {it.caption}
                          </div>
                        )}
                        {it.frame === "tape" && (
                          <div className="pointer-events-none absolute -top-2.5 left-1/2 h-5 w-24 -translate-x-1/2 -rotate-3 bg-[#ece0bc]/85 shadow-soft" />
                        )}
                        {it.frame === "pin" && (
                          <div className="pointer-events-none absolute -top-3 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full bg-red-500 shadow-soft ring-2 ring-red-700/30">
                            <div className="ml-1.5 mt-1 h-2 w-2 rounded-full bg-paper/60" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center leading-none"
                        style={{ fontSize: it.h * 0.8, transform: it.flipX ? "scaleX(-1)" : undefined }}
                      >
                        {it.text}
                      </div>
                    )}

                    {/* Lock badge */}
                    {it.locked && tool === "move" && (
                      <button
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          updItem(it.id, { locked: false })
                          setSel(it.id)
                        }}
                        className="pointer-events-auto absolute right-1 top-1 z-10 grid h-11 w-11 place-items-center rounded-full bg-amber-200 text-amber-900 shadow-lg ring-2 ring-white"
                        style={{ transform: `scale(${1 / Math.max(effScale, 0.3)})`, transformOrigin: "top right" }}
                        title="Unlock"
                      >
                        <Lock size={18} />
                      </button>
                    )}

                    {/* Selection Handles */}
                    {isSelected && !it.locked && (
                      <>
                        <div
                          onPointerDown={(e) => itemDrag(e, it, "resize", e.currentTarget.parentElement!)}
                          className="absolute -bottom-5 -right-5 h-10 w-10 touch-none rounded-full border-4 border-sky-500 bg-paper shadow"
                          title="Resize"
                        />
                        <div
                          onPointerDown={(e) => itemDrag(e, it, "resizeW", e.currentTarget.parentElement!)}
                          className="absolute -right-3 top-1/2 h-8 w-4 -translate-y-1/2 touch-none rounded-full border-2 border-sky-500 bg-paper shadow"
                          title="Stretch width"
                        />
                        <div
                          onPointerDown={(e) => itemDrag(e, it, "resizeH", e.currentTarget.parentElement!)}
                          className="absolute -bottom-3 left-1/2 h-4 w-8 -translate-x-1/2 touch-none rounded-full border-2 border-sky-500 bg-paper shadow"
                          title="Stretch height"
                        />
                        <div
                          onPointerDown={(e) => itemDrag(e, it, "rotate", e.currentTarget.parentElement!)}
                          className="absolute -top-12 left-1/2 flex h-9 w-9 -translate-x-1/2 touch-none items-center justify-center rounded-full border-4 border-sky-500 bg-paper shadow"
                          title="Rotate"
                        >
                          <RotateCw size={15} />
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Kement seçim kutusu */}
            {tool === "lasso" && selBox && (
              <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: PW, height: PH, transform: `scale(${effScale})` }}>
                <div
                  className="absolute animate-pop rounded-lg border-2 border-dashed border-primary bg-primary/10"
                  style={{ left: selBox.x0 - 10, top: selBox.y0 - 10, width: selBox.x1 - selBox.x0 + 20, height: selBox.y1 - selBox.y0 + 20 }}
                >
                  <div className="absolute -bottom-6 -right-6 h-12 w-12 rounded-full border-4 border-primary bg-paper shadow-soft" />
                </div>
              </div>
            )}

            {/* Layer 3: Committed Ink Canvas */}
            <canvas ref={inkRef} className="pointer-events-none absolute inset-0 h-full w-full" style={{ visibility: paintedKey === crispKey && !isPinching ? "hidden" : "visible" }} />

            {/* Layer 4: Live Wet-Ink Canvas (handles pen/pointer input at 120Hz) */}
            <canvas
              ref={wetRef}
              className={cn(
                "absolute inset-0 h-full w-full touch-none",
                tool === "move" && "pointer-events-none",
                tool === "eraser" ? "cursor-cell" : tool === "text" ? "cursor-text" : "cursor-crosshair",
              )}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={finishStroke}
              onPointerCancel={cancelStroke}
            />
          </div>
        </div>
        <canvas ref={inkZoomRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" style={{ visibility: paintedKey === crispKey && !isPinching ? "visible" : "hidden" }} />
      </div>

      {view.z > 1.02 && (
        <button onClick={() => zoomTo(1)} className="press absolute bottom-24 right-4 z-20 rounded-xl border-2 border-primary bg-paper px-3 py-1.5 text-xs font-semibold shadow-soft" aria-label="Reset zoom">
          {Math.round(view.z * 100)}% · reset
        </button>
      )}

      {/* Üst çubuk: sayfa yakınlaşınca arkasından geçer, tüm ekranı kaplar */}
      <div ref={topRef} className={cn("pointer-events-none absolute inset-x-0 top-0 z-20 transition-colors duration-300 [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto [&_select]:pointer-events-auto [&_label]:pointer-events-auto [&_textarea]:pointer-events-auto", view.z > 1.02 && "bg-cream/80 backdrop-blur-sm")}>
        {bar}
      </div>

      {/* ---- Alt alan: açılır çekmeceler, bağlamsal çubuklar, dock ------------- */}
      <div ref={botRef} className="pointer-events-none absolute inset-x-0 bottom-0 z-20 [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto [&_select]:pointer-events-auto [&_label]:pointer-events-auto [&_textarea]:pointer-events-auto">
        {/* Emoji Drawer */}
        {emojiOpen && (
          <div className="pointer-events-auto absolute bottom-full animate-pop left-3 right-3 mb-2 grid grid-cols-7 gap-1 rounded-2xl bg-paper p-3 text-3xl shadow-lift sm:grid-cols-[repeat(14,minmax(0,1fr))]">
            {EMOJI.map((em) => (
              <button
                key={em}
                className="rounded-lg p-1 active:bg-cream"
                onClick={() => {
                  setEmojiOpen(false)
                  addItems([{ id: uid(), kind: "emoji", text: em, x: PW / 2 - 70, y: PH / 2 - 70, w: 140, h: 140, rot: 0 }])
                }}
              >
                {em}
              </button>
            ))}
          </div>
        )}

        {/* Tabbed Sticker, Widget & Decor Drawer */}
        {decorOpen && (
          <div className="pointer-events-auto absolute bottom-full animate-pop left-3 right-3 mb-2 flex max-h-[58dvh] flex-col rounded-2xl bg-paper p-3 shadow-2xl">
            <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1">
              {(
                [
                  ["all", "All"],
                  ["widgets", "Widgets"],
                  ["notes", "Notes"],
                  ["tapes", "Tape & Pins"],
                  ["food", "Coffee & Food"],
                  ["life", "Life"],
                  ["arrows", "Titles & Arrows"],
                  ["mine", "My stickers"],
                ] as const
              ).map(([id, lbl]) => (
                <button
                  key={id}
                  onClick={() => setStickerTab(id)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold",
                    stickerTab === id ? "bg-rose text-ink" : "bg-cream text-ink-soft",
                  )}
                >
                  {lbl}
                </button>
              ))}
              <div className="flex-1" />
              <button
                onClick={() => stickerFileRef.current?.click()}
                className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900"
              >
                <Sparkles size={13} /> Make sticker from photo
              </button>
            </div>
            <div className="overflow-y-auto pr-1">
              {stickerTab === "mine" ? (
                <>
                  {packs.length > 0 && assetBackup !== "ok" && (
                    <div className="mb-3 rounded-xl bg-amber-100 px-3 py-2 text-[11px] font-medium text-amber-900">
                      {assetBackup === "error" ? "Cloud backup could not finish. Your sticker packs are on this device." : assetBackup === "missing" ? "These sticker packs are only on this device. Cloud backup is not set up yet (run the user_assets SQL in Supabase)." : "These sticker packs are only on this device. Sign in (Cloud button) to back them up."}
                    </div>
                  )}
                  <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    <button onClick={() => setPackId(null)} className={cn("press rounded-full px-3 py-1.5 text-xs font-semibold", !packId ? "bg-rose text-ink" : "bg-cream text-ink-soft")}>
                      Tekler ({customStickers.length})
                    </button>
                    {packs.map((pk) => (
                      <button key={pk.id} onClick={() => setPackId(pk.id)} className={cn("press rounded-full px-3 py-1.5 text-xs font-semibold", packId === pk.id ? "bg-rose text-ink" : "bg-cream text-ink-soft")}>
                        {pk.name} ({pk.count})
                      </button>
                    ))}
                    <button onClick={() => packFileRef.current?.click()} disabled={slicing !== null} className="press flex items-center gap-1 rounded-full border-2 border-dashed border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50">
                      {slicing !== null ? `Splitting… ${Math.round(slicing * 100)}%` : "+ Upload sticker sheet"}
                    </button>
                  </div>
                  {packId ? (
                    <>
                      <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-soft">
                        <span className="mr-1">Tap to add one by one; consecutive letters line up side by side.</span>
                        <button className="press rounded-full bg-cream px-2.5 py-1 font-semibold" onClick={() => (cursor.current = { x: cursor.current.x + 60, y: cursor.current.y })}>
                          Space
                        </button>
                        <button className="press rounded-full bg-cream px-2.5 py-1 font-semibold" onClick={() => (cursor.current = { x: 80, y: cursor.current.y + 110 })}>
                          New line
                        </button>
                        <button className="press rounded-full bg-cream px-2.5 py-1 font-semibold" onClick={() => (cursor.current = { x: 80, y: 120 })}>
                          Back to start
                        </button>
                        <div className="flex-1" />
                        <button
                          className="press rounded-full bg-rose-soft px-2.5 py-1 font-semibold text-red-700"
                          onClick={() => {
                            if (confirm("Delete this sticker pack from the device? Stickers already on pages are not removed.")) {
                              void removePack(packId)
                              setPackId(null)
                            }
                          }}
                        >
                          Delete pack
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 py-1">
                        {packItems.map((st, k) => (
                          <button key={k} onClick={() => addPackSticker(st)} className="press rounded-lg bg-cream p-1 hover:bg-rose-soft" aria-label={`Sticker ${k + 1}`}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={st.src} alt="" loading="lazy" draggable={false} className="h-12 w-auto max-w-[64px] object-contain" />
                          </button>
                        ))}
                        {packItems.length === 0 && <div className="py-6 text-sm text-ink-soft">Loading…</div>}
                      </div>
                    </>
                  ) : packs.length === 0 && customStickers.length === 0 ? (
                    <div className="py-8 text-center text-sm text-ink-soft">
                      No stickers yet. Use “+ Upload sticker sheet” to add a letter or sticker sheet; the app splits it into individual pieces.
                    </div>
                  ) : customStickers.length === 0 ? (
                  <div className="py-8 text-center text-sm text-ink-soft">
                    No saved stickers yet. Use “Make sticker from photo” above to add one from your gallery.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3 py-2">
                    {customStickers.map((cs) => (
                      <div key={cs.id} className="group relative rounded-xl bg-cream p-2">
                        <button onClick={() => addCustomStickerToPage(cs)}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={cs.src} alt={cs.label} className="h-16 w-auto max-w-[120px] object-contain" />
                        </button>
                        {onDeleteCustomSticker && (
                          <button
                            onClick={() => onDeleteCustomSticker(cs.id)}
                            className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-1 text-white shadow"
                            aria-label="Delete sticker"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                </>
              ) : (
                DECOR.filter((g) => stickerTab === "all" || g.id === stickerTab).map((g) => (
                  <div key={g.id} className="mb-3 last:mb-0">
                    <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft">{g.group}</div>
                    <div className="flex flex-wrap gap-2.5">
                      {g.items.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => addDecor(d)}
                          className="flex flex-col items-center gap-1 rounded-xl bg-cream p-2 active:bg-cream-deep"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={d.src} alt={d.label} draggable={false} className="h-14 w-auto max-w-[120px] object-contain" />
                          <span className="max-w-[110px] truncate text-[10px] font-medium text-ink-soft">{d.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-full z-20 px-3 pb-2 [&>*]:pointer-events-auto">
        {/* Selected Item Inspector Bar */}
        {tool === "move" && selItem && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-xl bg-paper p-2 shadow-soft">
            {selItem.kind === "textbox" ? (
              <>
                <button
                  onClick={() => setEditingTextId(editingTextId === selItem.id ? null : selItem.id)}
                  className="rounded-lg bg-sky-100 px-2.5 py-1.5 text-xs font-semibold text-sky-900"
                >
                  {editingTextId === selItem.id ? "Done" : "Edit text"}
                </button>
                <select
                  value={selItem.fontFamily ?? "hand"}
                  onChange={(e) => updItem(selItem.id, { fontFamily: e.target.value as Item["fontFamily"] })}
                  className="h-8 rounded-lg bg-cream px-2 text-xs font-medium"
                >
                  <option value="hand">Handwriting</option>
                  <option value="sans">Rounded Sans</option>
                  <option value="serif">Serif</option>
                  <option value="mono">Typewriter</option>
                  {customFonts.length > 0 && (
                    <optgroup label="My fonts">
                      {customFonts.map((f) => (
                        <option key={f.id} value={`cf-${f.id}`}>
                          {f.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <button onClick={() => fontFileRef.current?.click()} className="rounded-lg bg-cream px-2 py-1.5 text-xs font-semibold" title="Upload your own font (TTF, OTF, WOFF or ZIP)">
                  + Font
                </button>
                {isCustomFont(selItem.fontFamily) && (
                  <button
                    onClick={() => {
                      const id = selItem.fontFamily!.slice(3)
                      if (confirm("Delete this font from the device? Text using it falls back to the default font.")) void removeFont(id)
                    }}
                    className="rounded-lg bg-rose-soft p-1.5 text-red-700"
                    title="Delete font"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <input
                  type="number"
                  min={12}
                  max={72}
                  value={selItem.fontSize ?? 26}
                  onChange={(e) => updItem(selItem.id, { fontSize: Number(e.target.value) || 22 })}
                  className="h-8 w-14 rounded-lg bg-cream px-2 text-xs font-semibold"
                />
                <input
                  type="color"
                  title="Text color"
                  value={selItem.color ?? "#25252b"}
                  onChange={(e) => updItem(selItem.id, { color: e.target.value })}
                  className="h-8 w-8 rounded border-0 bg-transparent p-0"
                />
                <div className="flex items-center gap-1">
                  {TAG_BGS.map((bg) => (
                    <button
                      key={bg}
                      onClick={() => updItem(selItem.id, { bgColor: bg })}
                      className={cn(
                        "h-6 w-6 rounded-full border",
                        selItem.bgColor === bg ? "border-stone-900 ring-1 ring-stone-900" : "border-line",
                      )}
                      style={{ background: bg === "transparent" ? "repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50%/8px 8px" : bg }}
                      title="Background label"
                    />
                  ))}
                </div>
                <button
                  onClick={() => updItem(selItem.id, { bold: !selItem.bold })}
                  className={cn("rounded-lg p-1.5", selItem.bold ? "bg-rose text-ink" : "bg-cream")}
                >
                  <Bold size={14} />
                </button>
                <button
                  onClick={() => updItem(selItem.id, { italic: !selItem.italic })}
                  className={cn("rounded-lg p-1.5", selItem.italic ? "bg-rose text-ink" : "bg-cream")}
                >
                  <Italic size={14} />
                </button>
                <button
                  onClick={() => updItem(selItem.id, { pill: !selItem.pill })}
                  className={cn("rounded-lg px-2 py-1 text-xs font-semibold", selItem.pill ? "bg-rose text-ink" : "bg-cream")}
                >
                  Pill
                </button>
                <button
                  onClick={() => updItem(selItem.id, { align: selItem.align === "center" ? "right" : selItem.align === "right" ? "left" : "center" })}
                  className="rounded-lg bg-cream p-1.5"
                >
                  {selItem.align === "center" ? <AlignCenter size={14} /> : selItem.align === "right" ? <AlignRight size={14} /> : <AlignLeft size={14} />}
                </button>
              </>
            ) : (
              <>
                {selItem.src && (
                  <select
                    value={selItem.frame ?? "none"}
                    onChange={(e) => updItem(selItem.id, { frame: e.target.value as ItemFrame })}
                    className="h-8 rounded-lg bg-cream px-2 text-xs font-semibold"
                    aria-label="Frame"
                  >
                    {FRAMES.map((fr) => (
                      <option key={fr.id} value={fr.id}>
                        Frame: {fr.label}
                      </option>
                    ))}
                  </select>
                )}
                {selItem.frame === "polaroid" && (
                  <input
                    type="text"
                    placeholder="Polaroid caption…"
                    value={selItem.caption ?? ""}
                    onChange={(e) => updItem(selItem.id, { caption: e.target.value })}
                    className="h-8 w-36 rounded-lg border border-line px-2 text-xs"
                  />
                )}
                {selItem.src && (
                  <>
                    <button onClick={() => setImgEdit({ id: selItem.id, tab: "crop" })} className="flex items-center gap-1 rounded-lg bg-cream px-2.5 py-1.5 text-xs font-semibold text-ink" title="Crop">
                      <Crop size={13} /> Crop
                    </button>
                    <button onClick={() => setImgEdit({ id: selItem.id, tab: "bg" })} className="flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-900" title="Remove background (adjustable)">
                      <Wand2 size={13} /> Remove background
                    </button>
                  </>
                )}
                {selItem.src && onSaveCustomSticker && (
                  <button
                    onClick={() => onSaveCustomSticker({ label: "Sticker", src: selItem.src!, w: selItem.w, h: selItem.h })}
                    className="flex items-center gap-1 rounded-lg bg-cream px-2.5 py-1.5 text-xs font-semibold text-ink"
                    title="Save to my stickers"
                  >
                    <BookmarkPlus size={13} /> Save
                  </button>
                )}
              </>
            )}

            <div className="mx-1 h-5 w-px bg-cream-deep" />
            <label className="flex items-center gap-1 text-[11px] font-medium text-ink-soft">
              Opacity
              <input
                type="range"
                min={0.15}
                max={1}
                step={0.05}
                value={selItem.opacity ?? 1}
                onChange={(e) => updItem(selItem.id, { opacity: Number(e.target.value) })}
                className="w-16 accent-primary"
              />
            </label>
            <button onClick={() => updItem(selItem.id, { flipX: !selItem.flipX })} className="rounded-lg bg-cream p-1.5" title="Mirror">
              <FlipHorizontal2 size={15} />
            </button>
            <button onClick={() => updItem(selItem.id, { rot: selItem.rot + 15 })} className="rounded-lg bg-cream p-1.5" title="Rotate 15°">
              <RotateCw size={15} />
            </button>
            <button
              onClick={() => {
                snapshot()
                commit({ ...pageRef.current, items: [...pageRef.current.items.filter((i) => i.id !== selItem.id), selItem] })
              }}
              className="rounded-lg bg-cream p-1.5"
              title="Bring forward"
            >
              <ArrowUpToLine size={15} />
            </button>
            <button
              onClick={() => {
                snapshot()
                commit({ ...pageRef.current, items: [selItem, ...pageRef.current.items.filter((i) => i.id !== selItem.id)] })
              }}
              className="rounded-lg bg-cream p-1.5"
              title="Send backward"
            >
              <ArrowDownToLine size={15} />
            </button>
            <button
              onClick={() => updItem(selItem.id, { locked: !selItem.locked })}
              className={cn("flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold", selItem.locked ? "bg-amber-200 text-amber-900" : "bg-cream")}
              title={selItem.locked ? "Unlock" : "Lock layer (write over it freely)"}
            >
              {selItem.locked ? <Lock size={15} /> : <Unlock size={15} />}
              {selItem.locked && "Unlock"}
            </button>
            <button
              onClick={() => addItems([{ ...selItem, id: uid(), x: selItem.x + 28, y: selItem.y + 28 }])}
              className="rounded-lg bg-cream p-1.5"
              title="Duplicate"
            >
              <Copy size={15} />
            </button>
            <button
              onClick={() => {
                snapshot()
                commit({ ...pageRef.current, items: pageRef.current.items.filter((i) => i.id !== selItem.id) })
                setSel(null)
              }}
              className="rounded-lg bg-red-100 p-1.5 text-red-700"
              title="Delete"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}

        {tool === "lasso" && lassoSel.length > 0 && (
          <div className="mx-auto mb-2 flex w-fit animate-pop items-center gap-1.5 rounded-2xl border-2 border-primary bg-paper p-1.5 shadow-soft">
            <span className="px-2 text-xs font-semibold text-ink-soft">{lassoSel.length} strokes selected</span>
            <button
              onClick={() => {
                snapshot()
                const copies = lassoSel.map((s) => moveStroke(s, 30, 30))
                commit({ ...pageRef.current, strokes: [...pageRef.current.strokes, ...copies] })
                setLassoSel(copies)
              }}
              className="press rounded-xl bg-cream p-2"
              title="Duplicate"
            >
              <Copy size={17} />
            </button>
            <label className="press relative grid h-9 w-9 cursor-pointer place-items-center rounded-xl bg-cream" title="Change color">
              <Palette size={17} />
              <input type="color" className="absolute inset-0 opacity-0" value={lassoSel[0].color} onChange={(e) => replaceSelected((s) => ({ ...s, color: e.target.value }))} />
            </label>
            <button
              onClick={() => {
                snapshot()
                const del = new Set(lassoSel)
                commit({ ...pageRef.current, strokes: pageRef.current.strokes.filter((s) => !del.has(s)) })
                setLassoSel([])
              }}
              className="press rounded-xl bg-rose-soft p-2 text-red-700"
              title="Delete"
            >
              <Trash2 size={17} />
            </button>
            <button onClick={() => setLassoSel([])} className="press rounded-xl bg-primary p-2 text-primary-foreground" title="Done">
              <Check size={17} />
            </button>
          </div>
        )}
        </div>
        {imgEdit && it?.src && (
            <ImageEditModal
              src={it.src}
              original={it.origSrc}
              startTab={imgEdit.tab}
              onClose={() => setImgEdit(null)}
              onApply={(r) => {
                snapshot()
                const keep = it.origSrc ?? (it.src!.length < 3_000_000 ? it.src : undefined)
                updItem(it.id, { src: r.src, origSrc: keep, h: Math.round(it.w / r.aspect), frame: r.bgRemoved || it.frame === "polaroid" ? "none" : it.frame })
                setImgEdit(null)
              }}
            />
        )}
        <Dock
          tool={tool}
          setTool={(t) => {
            setTool(t)
            setEditingTextId(null)
            if (t !== "move") setSel(null)
          }}
          panel={panel}
          setPanel={(pn) => {
            if (pn) {
              setEmojiOpen(false)
              setDecorOpen(false)
            }
            setPanel(pn)
          }}
          color={color}
          setColor={(c) => setColors((o) => ({ ...o, [tool === "marker" ? "marker" : "pen"]: c }))}
          size={size}
          setSize={setSize}
          penStyle={penStyle}
          setPenStyle={setPenStyle}
          streamline={streamline}
          setStreamline={setStreamline}
          sensitivity={sensitivity}
          setSensitivity={setSensitivity}
          smartShapeOn={smartShapeOn}
          setSmartShapeOn={setSmartShapeOn}
          straight={straight}
          setStraight={setStraight}
          eraserMode={eraserMode}
          setEraserMode={setEraserMode}
          onClearInk={() => {
            if (page.strokes.length && confirm("Clear all drawings on this page?")) {
              snapshot()
              commit({ ...pageRef.current, strokes: [] })
              setPanel(null)
            }
          }}
          canUndo={!!histCount.u}
          canRedo={!!histCount.r}
          onUndo={undo}
          onRedo={redo}
          onAddPhoto={() => fileRef.current?.click()}
          onAddSticker={() => {
            setEmojiOpen(false)
            setDecorOpen(true)
          }}
          onAddMine={() => {
            setEmojiOpen(false)
            setStickerTab("mine")
            setDecorOpen(true)
          }}
          onAddEmoji={() => {
            setDecorOpen(false)
            setEmojiOpen(true)
          }}
          onAddText={addNewTextBox}
          template={page.template}
          setTemplate={(t) => {
            snapshot()
            commit({ ...pageRef.current, template: t })
          }}
          bg={page.bg ?? PAPER}
          setBg={(c) => commit({ ...pageRef.current, bg: c })}
          texture={page.texture !== false}
          setTexture={(b) => commit({ ...pageRef.current, texture: b })}
          onOpenPageStudio={onOpenPageStudio}
          pencilOnly={drawMode === "pencilOnly"}
          setPencilOnly={(b) => setDrawMode(b ? "pencilOnly" : "smart")}
          zoom={view.z}
          onZoom={zoomTo}
          pos={dockPos}
          setPos={setDockPos}
        />
        <input
          ref={fontFileRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2,.zip,font/*,application/zip"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ""
            if (!f) return
            try {
              const fonts = await addFontFile(f)
              if (sel && fonts[0]) updItem(sel, { fontFamily: `cf-${fonts[0].id}` })
              if (fonts.length > 1) alert(`${fonts.length} fonts added. Pick them from the “My fonts” list.`)
            } catch (err) {
              alert(err instanceof Error ? err.message : "Could not load the font.")
            }
          }}
        />
        <input
          ref={packFileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ""
            void importSheet(f)
          }}
        />
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void onFiles(e.target.files, false)} />
        <input ref={stickerFileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void onFiles(e.target.files, true)} />
      </div>
    </div>
  )
}
