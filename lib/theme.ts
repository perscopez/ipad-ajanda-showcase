/** Tema renkleri: 4 ana renk seçilir, gerisi (gölge, çizgi, vurgu tonları) bunlardan türetilir. */
export type ThemeColors = { bg: string; card: string; accent: string; text: string; fg?: string }

export const THEME_KEY = "defterim_theme_v1"

export const DEFAULT_THEME: ThemeColors = { bg: "#f6e6ef", card: "#fcf1cc", accent: "#c8478f", text: "#3f3f3f", fg: "#ffffff" }

export const THEME_PRESETS: { id: string; name: string; colors: ThemeColors }[] = [
  { id: "bubblegum", name: "Bubblegum", colors: DEFAULT_THEME },
  { id: "lavanta", name: "Lavender", colors: { bg: "#ece6f7", card: "#faf6ff", accent: "#7c5cd6", text: "#322a45" } },
  { id: "nane", name: "Mint", colors: { bg: "#e3f1e8", card: "#f8fff3", accent: "#2f9a6e", text: "#26382f" } },
  { id: "gunbatimi", name: "Sunset", colors: { bg: "#fde9dc", card: "#fff6e9", accent: "#e0603a", text: "#43302a" } },
  { id: "okyanus", name: "Ocean", colors: { bg: "#e2edf8", card: "#f6fbff", accent: "#2f77d0", text: "#23364a" } },
  { id: "kahve", name: "Coffee", colors: { bg: "#ece2d4", card: "#fbf5ec", accent: "#8a5a3f", text: "#3b2e26" } },
  { id: "gece", name: "Night", colors: { bg: "#1e1a26", card: "#2c2637", accent: "#e879b9", text: "#f2ecf6" } },
]

function luminance(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 0.5
  const n = parseInt(m[1], 16)
  const f = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255)
}

/** Vurgu renginin üstündeki yazı beyaz mı koyu mu olmalı. */
export const foregroundFor = (accent: string) => (luminance(accent) > 0.5 ? "#2b2230" : "#ffffff")

export function applyTheme(c: ThemeColors) {
  const s = document.documentElement.style
  s.setProperty("--color-cream", c.bg)
  s.setProperty("--color-paper", c.card)
  s.setProperty("--color-primary", c.accent)
  s.setProperty("--color-ink", c.text)
  s.setProperty("--color-primary-foreground", c.fg ?? foregroundFor(c.accent))
}

export function saveTheme(c: ThemeColors) {
  const full = { ...c, fg: foregroundFor(c.accent) }
  applyTheme(full)
  try {
    localStorage.setItem(THEME_KEY, JSON.stringify(full))
  } catch {}
}

export function resetTheme() {
  const s = document.documentElement.style
  for (const v of ["--color-cream", "--color-paper", "--color-primary", "--color-ink", "--color-primary-foreground"]) s.removeProperty(v)
  try {
    localStorage.removeItem(THEME_KEY)
  } catch {}
}

export function loadTheme(): ThemeColors | null {
  try {
    return JSON.parse(localStorage.getItem(THEME_KEY) || "null") as ThemeColors | null
  } catch {
    return null
  }
}

/** Sayfa çizilmeden önce çalışır (yanıp sönme olmasın). */
export const THEME_BOOT = `(function(){try{var t=JSON.parse(localStorage.getItem("${THEME_KEY}")||"null");if(!t)return;var s=document.documentElement.style;s.setProperty("--color-cream",t.bg);s.setProperty("--color-paper",t.card);s.setProperty("--color-primary",t.accent);s.setProperty("--color-ink",t.text);s.setProperty("--color-primary-foreground",t.fg||"#fff")}catch(e){}})()`
