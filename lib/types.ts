export type Orient = "portrait" | "landscape"

export type PenStyle = "fountain" | "ballpoint" | "brush" | "pencil" | "marker" | "dashed"

export type Template =
  | "dots"
  | "blank"
  | "lines"
  | "grid"
  | "isometric"
  | "cornell"
  | "ivory_week"
  | "ivory_freestyle"
  | "week_grid"
  | "pastel_week"
  | "daily"
  | "tracker"
  | "month"
  | "week"
  | "year"
  | "weekbox"
  | "monthplan"
  | "weeklist"
  | "weeklyleft"
  | "custom"

export type Stroke = {
  tool: "pen" | "marker"
  penStyle?: PenStyle
  color: string
  size: number
  opacity?: number
  pts: number[] // x,y,pressure ...
}

export type ItemFrame = "none" | "polaroid" | "pin" | "tape" | "rounded" | "shadow"

export type Item = {
  id: string
  kind?: "image" | "emoji" | "textbox" | "sticker" | "widget"
  src?: string
  origSrc?: string // düzenlemeden önceki orijinal görsel (kırpma/arka plan ayarı tekrar yapılabilsin)
  text?: string
  caption?: string
  x: number
  y: number
  w: number
  h: number
  rot: number
  opacity?: number
  flipX?: boolean
  locked?: boolean
  keepRatio?: boolean
  frame?: ItemFrame
  // Metin kutusu & etiket özellikleri:
  fontFamily?: "sans" | "serif" | "hand" | "mono" | (string & {}) // "cf-…" = yüklenen font
  fontSize?: number
  color?: string
  bgColor?: string
  borderColor?: string
  align?: "left" | "center" | "right"
  bold?: boolean
  italic?: boolean
  pill?: boolean
}

export type PageConfig = {
  spacing?: number
  lineWidth?: number
  lineColor?: string
  margin?: number
  headerTitle?: string
  headerSubtitle?: string
  startDayNum?: number
  monthIndex?: number
  year?: number
  weekNumber?: number
  bgImage?: string
  bgOpacity?: number
  overlayTemplate?: "none" | "dots" | "grid" | "lines"
  showMonthTabs?: boolean
  showTopTabs?: boolean
  startHour?: number // günlük plan: ilk saat (varsayılan 6)
  endHour?: number // günlük plan: son saat (varsayılan 22)
  stepMin?: 15 | 30 | 60 | 120 // günlük plan: satır aralığı (dakika)
}

export type Page = {
  contentClock?: Record<string, number>
  id: string
  updatedAt?: number // eşitleme: sayfa bazında son değişiklik
  orient?: Orient
  template: Template
  bg?: string
  title?: string
  config?: PageConfig
  texture?: boolean // kağıt dokusu (varsayılan: açık)
  strokes: Stroke[]
  items: Item[]
}

export type CustomTemplate = {
  updatedAt?: number // eşitleme: son değişiklik zamanı
  id: string
  name: string
  orient?: Orient
  template: Template
  bg?: string
  config?: PageConfig
}

export type CustomSticker = {
  updatedAt?: number // eşitleme: son değişiklik zamanı
  id: string
  label: string
  src: string
  w: number
  h: number
}

export type Folder = {
  updatedAt?: number // eşitleme: son değişiklik zamanı
  id: string
  name: string
  color: string // arka panel
  frontColor?: string // ön panel (boşsa arka renkten türetilir)
  emoji?: string
  image?: string
  frame?: boolean // görselin arkasında klasör şekli görünsün mü
  meta?: string
}

export type NotebookTab = {
  id: string
  label: string
  emoji?: string
  color: string
  pageId?: string // hedef sayfa (sayfalar yeniden sıralansa da doğru yere gider)
  pageIndex?: number // eski kayıtlar için
  subs?: NotebookSubTab[] // alt kategoriler: her biri başka bir sayfaya gider
}

export type NotebookSubTab = { id: string; label: string; emoji?: string; pageId?: string; pageIndex?: number }

export type Notebook = {
  tabsHidden?: boolean // sekme çubuğunu gizle
  updatedAt?: number // eşitleme: son değişiklik zamanı
  id: string
  folderId: string | null
  title: string
  cover: Page
  pages: Page[]
  tabs?: NotebookTab[]
  monthPages?: Record<number, number>
}

export const PW = 820
export const PH = 1180
export const dims = (o?: Orient) => (o === "landscape" ? { w: 1180, h: 820 } : { w: 820, h: 1180 })

export const TEMPLATES: { id: Template; label: string; group?: "planner" | "basic" | "special" }[] = [
  { id: "ivory_week", label: "Ivory Weekly (with Calendar)", group: "planner" },
  { id: "ivory_freestyle", label: "Ivory Grid (with Tabs)", group: "planner" },
  { id: "week_grid", label: "Half Days, Half Grid (Landscape)", group: "planner" },
  { id: "pastel_week", label: "Pastel 2-Column Weekly", group: "planner" },
  { id: "daily", label: "Daily Plan (Hourly + To-Do)", group: "planner" },
  { id: "tracker", label: "Habit & Mood Tracker", group: "planner" },
  { id: "monthplan", label: "Monthly Plan", group: "planner" },
  { id: "weekbox", label: "Week (Boxed)", group: "planner" },
  { id: "weeklist", label: "Week (List)", group: "planner" },
  { id: "weeklyleft", label: "Week + Mini Calendar", group: "planner" },
  { id: "month", label: "Month", group: "planner" },
  { id: "week", label: "Week", group: "planner" },
  { id: "year", label: "Year", group: "planner" },
  { id: "dots", label: "Dotted", group: "basic" },
  { id: "lines", label: "Lined", group: "basic" },
  { id: "grid", label: "Grid", group: "basic" },
  { id: "isometric", label: "Isometric Dots", group: "basic" },
  { id: "cornell", label: "Cornell Notes", group: "basic" },
  { id: "blank", label: "Blank", group: "basic" },
  { id: "custom", label: "Custom Image Template", group: "special" },
]

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

export const newPage = (template: Template = "dots", bg?: string, orient?: Orient, config?: PageConfig): Page => ({
  id: uid(),
  orient,
  template,
  bg,
  config,
  strokes: [],
  items: [],
})
