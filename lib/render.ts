import { ensureFonts } from "./fonts"
import { dims, PH, PW, type Item, type Page, type PageConfig, type Stroke, type Template } from "./types"

export const PAPER = "#fbf8f1"
const LINE = "#d3cbbb"
const DOT = "#b4ab98"

const imgCache = new Map<string, Promise<HTMLImageElement>>()
export function loadImg(src: string): Promise<HTMLImageElement> {
  let p = imgCache.get(src)
  if (!p) {
    p = new Promise((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = (err) => {
        imgCache.delete(src)
        rej(err)
      }
      i.src = src
    })
    imgCache.set(src, p)
  }
  return p
}

/** Resize a picked file so storage stays small. PNG/WebP keep their transparency (stickers). */
export async function fileToDataUrl(file: File, max = 1400): Promise<{ src: string; w: number; h: number }> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImg(url)
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * k))
    const h = Math.max(1, Math.round(img.naturalHeight * k))
    const c = document.createElement("canvas")
    c.width = w
    c.height = h
    c.getContext("2d")!.drawImage(img, 0, 0, w, h)
    const alpha = /png|webp|gif|svg/.test(file.type)
    return { src: c.toDataURL(alpha ? "image/png" : "image/jpeg", 0.88), w, h }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Remove near-white background from an image so photos/scans become transparent stickers. */
export async function removeWhiteBackground(src: string, threshold = 235): Promise<string> {
  const img = await loadImg(src)
  const c = document.createElement("canvas")
  c.width = img.naturalWidth || img.width
  c.height = img.naturalHeight || img.height
  const ctx = c.getContext("2d")!
  ctx.drawImage(img, 0, 0)
  const im = ctx.getImageData(0, 0, c.width, c.height)
  const d = im.data
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2]
    const lum = (r + g + b) / 3
    if (r > threshold && g > threshold && b > threshold) {
      d[i + 3] = 0
    } else if (lum > threshold - 25) {
      const fade = Math.max(0, Math.min(1, (threshold - lum) / 25))
      d[i + 3] = Math.round(d[i + 3] * fade)
    }
  }
  ctx.putImageData(im, 0, 0)
  return c.toDataURL("image/png")
}

// ============================================================================
// TEMPLATE RENDERING
// ============================================================================

const FAM = '-apple-system, "SF Pro Rounded", system-ui, sans-serif'
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const DAYS_TR_CAP = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const MON_FULL_TR = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

function txt(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  weight = 600,
  color = "#2a2722",
  align: CanvasTextAlign = "left",
  family = FAM,
  italic = false,
) {
  ctx.save()
  ctx.font = `${italic ? "italic " : ""}${weight} ${size}px ${family}`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.fillText(s, x, y)
  ctx.restore()
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function drawBookmarkIcon(ctx: CanvasRenderingContext2D, x: number, y: number, color = "#cfc9be") {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.3
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + 9, y)
  ctx.lineTo(x + 9, y + 13)
  ctx.lineTo(x + 4.5, y + 9.5)
  ctx.lineTo(x, y + 13)
  ctx.closePath()
  ctx.stroke()
  ctx.restore()
}

function drawBasicPattern(
  ctx: CanvasRenderingContext2D,
  pat: "dots" | "lines" | "grid" | "isometric",
  W: number,
  H: number,
  spacing: number,
  lineColor: string,
  lineWidth: number,
  margin: number,
) {
  ctx.save()
  ctx.strokeStyle = lineColor
  ctx.fillStyle = lineColor
  ctx.lineWidth = lineWidth
  const sp = Math.max(14, Math.min(80, spacing))
  const m = Math.max(0, margin)

  if (pat === "dots") {
    const r = Math.max(1.1, lineWidth * 1.15)
    for (let y = m + sp; y < H - m; y += sp) {
      for (let x = m + sp; x < W - m; x += sp) {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  } else if (pat === "lines") {
    for (let y = Math.max(72, m + sp * 2); y < H - m; y += sp) {
      ctx.beginPath()
      ctx.moveTo(m, y)
      ctx.lineTo(W - m, y)
      ctx.stroke()
    }
  } else if (pat === "grid") {
    for (let x = m; x <= W - m; x += sp) {
      ctx.beginPath()
      ctx.moveTo(x + 0.5, m)
      ctx.lineTo(x + 0.5, H - m)
      ctx.stroke()
    }
    for (let y = m; y <= H - m; y += sp) {
      ctx.beginPath()
      ctx.moveTo(m, y + 0.5)
      ctx.lineTo(W - m, y + 0.5)
      ctx.stroke()
    }
  } else if (pat === "isometric") {
    const r = Math.max(1.1, lineWidth * 1.1)
    const rowH = sp * 0.866
    let row = 0
    for (let y = m + sp; y < H - m; y += rowH) {
      const offset = row % 2 === 1 ? sp / 2 : 0
      for (let x = m + sp + offset; x < W - m; x += sp) {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      row++
    }
  }
  ctx.restore()
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function firstDayMondayOffset(year: number, monthIndex: number) {
  const d = new Date(year, monthIndex, 1).getDay() // 0=Sun..6=Sat
  return (d + 6) % 7 // 0=Mon..6=Sun
}

export function drawTemplate(
  ctx: CanvasRenderingContext2D,
  t: Template,
  W = PW,
  H = PH,
  cfg?: PageConfig,
  bgImgEl?: HTMLImageElement | null,
) {
  ctx.save()
  const spacing = cfg?.spacing ?? (t === "lines" ? 38 : 30)
  const lw = cfg?.lineWidth ?? 1.2
  const lc = cfg?.lineColor ?? (t === "dots" || t === "isometric" ? DOT : t === "grid" ? "#dcd7c9" : LINE)
  const margin = cfg?.margin ?? (t === "grid" ? 0 : 40)

  if (bgImgEl) {
    ctx.save()
    ctx.globalAlpha = cfg?.bgOpacity ?? 1
    const scale = Math.min(W / bgImgEl.width, H / bgImgEl.height)
    const dw = bgImgEl.width * scale
    const dh = bgImgEl.height * scale
    ctx.drawImage(bgImgEl, (W - dw) / 2, (H - dh) / 2, dw, dh)
    ctx.restore()
  }

  ctx.strokeStyle = LINE
  ctx.fillStyle = DOT
  ctx.lineWidth = 1.4
  const hline = (y: number, x1 = 50, x2 = W - 50) => {
    ctx.beginPath()
    ctx.moveTo(x1, y)
    ctx.lineTo(x2, y)
    ctx.stroke()
  }

  if (t === "custom") {
    if (cfg?.overlayTemplate && cfg.overlayTemplate !== "none") {
      drawBasicPattern(ctx, cfg.overlayTemplate, W, H, spacing, lc, lw, margin)
    }
    ctx.restore()
    return
  }

  if (t === "dots" || t === "lines" || t === "grid" || t === "isometric") {
    if (cfg?.headerTitle) {
      txt(ctx, cfg.headerTitle, 44, 58, 26, 700, "#2a2722")
      ctx.strokeStyle = lc
      ctx.lineWidth = lw
      hline(74, 44, W - 44)
    }
    drawBasicPattern(ctx, t, W, H, spacing, lc, lw, margin)
  } else if (t === "cornell") {
    const topY = 92
    const botY = H - 180
    const cueX = Math.round(W * 0.28)
    txt(ctx, cfg?.headerTitle || "Topic / Title", 44, 58, 24, 700, "#2a2722")
    txt(ctx, cfg?.headerSubtitle || "Date: ____ / ____", W - 44, 58, 14, 500, "#7a7267", "right")
    ctx.strokeStyle = cfg?.lineColor ?? "#9c9487"
    ctx.lineWidth = lw * 1.25
    hline(topY, 36, W - 36)
    hline(botY, 36, W - 36)
    ctx.beginPath()
    ctx.moveTo(cueX, topY)
    ctx.lineTo(cueX, botY)
    ctx.stroke()
    ctx.strokeStyle = cfg?.lineColor ? lc : "#e2dcd0"
    ctx.lineWidth = lw * 0.85
    for (let y = topY + spacing; y < botY - 8; y += spacing) hline(y, cueX + 12, W - 36)
    for (let y = botY + spacing; y < H - 36; y += spacing) hline(y, 44, W - 44)
    txt(ctx, "KEYWORDS", 44, topY + 22, 11, 700, "#8f877b")
    txt(ctx, "SUMMARY", 44, botY + 22, 11, 700, "#8f877b")
  } else if (t === "ivory_week") {
    // Ref Image 1 Left: "••• WEEK OF ..." + 2x4 grid (Mini calendar top-left + 7 days)
    const year = cfg?.year ?? 2026
    const mIdx = cfg?.monthIndex ?? 3 // April default
    const startDay = cfg?.startDayNum ?? 15
    const wk = cfg?.weekNumber ?? 16
    const mName = MON_FULL_TR[mIdx].toLocaleUpperCase("en")
    const endDay = Math.min(daysInMonth(year, mIdx), startDay + 6)
    const header = cfg?.headerTitle || `WEEK OF ${mName} ${startDay} – ${endDay}`

    // Three dots + header
    ;[0, 1, 2].forEach((d) => {
      ctx.beginPath()
      ctx.arc(42 + d * 12, 42, 3.6, 0, Math.PI * 2)
      ctx.fillStyle = d === 0 ? "#2a2722" : d === 1 ? "#78716c" : "#b8b2a8"
      ctx.fill()
    })
    txt(ctx, header, 84, 49, 20, 800, "#23211e")
    ctx.strokeStyle = "#cbc4b8"
    ctx.lineWidth = 1.2
    hline(68, 36, W - 36)

    const left = 36, right = W - 36, top = 74, bottom = H - 34
    const cw = (right - left) / 2
    const rh = (bottom - top) / 4

    // Grid lines
    ctx.strokeStyle = "#dad4c8"
    ctx.lineWidth = 1.1
    for (let r = 1; r < 4; r++) hline(top + r * rh, left, right)
    ctx.beginPath()
    ctx.moveTo(left + cw, top)
    ctx.lineTo(left + cw, bottom)
    ctx.stroke()

    // Top-left cell: Mini monthly calendar with week numbers
    const calX = left + 12, calY = top + 14, calW = cw - 24
    const colW = calW / 8
    txt(ctx, "H", calX + colW * 0.4, calY + 14, 11, 700, "#7c756c", "center")
    ;["M", "T", "W", "T", "F", "S", "S"].forEach((d, idx) =>
      txt(ctx, d, calX + colW * (1.5 + idx), calY + 14, 11, 700, "#3a3630", "center"),
    )
    hline(calY + 24, calX, calX + calW)

    const dim = daysInMonth(year, mIdx)
    const offset = firstDayMondayOffset(year, mIdx)
    const rowStep = (rh - 52) / 6
    let highlightedRow = -1
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 7; c++) {
        const dayNum = r * 7 + c - offset + 1
        if (dayNum === startDay) highlightedRow = r
      }
    }
    for (let r = 0; r < 6; r++) {
      const cy = calY + 42 + r * rowStep
      if (r === highlightedRow) {
        ctx.fillStyle = "#e6e2da"
        rrect(ctx, calX + colW * 0.9, cy - 12, calW - colW * 0.9, 18, 9)
        ctx.fill()
      }
      txt(ctx, `W${wk - (highlightedRow - r)}`, calX + colW * 0.4, cy, 10, 600, "#999186", "center")
      for (let c = 0; c < 7; c++) {
        const dayNum = r * 7 + c - offset + 1
        const inMonth = dayNum >= 1 && dayNum <= dim
        const displayNum = inMonth ? dayNum : dayNum < 1 ? daysInMonth(year, (mIdx + 11) % 12) + dayNum : dayNum - dim
        txt(
          ctx,
          String(displayNum),
          calX + colW * (1.5 + c),
          cy,
          11,
          inMonth ? 600 : 400,
          inMonth ? "#2e2b27" : "#b8b2a8",
          "center",
        )
      }
    }

    // 7 Day boxes
    const cells: [number, number][] = [
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
      [1, 2],
      [0, 3],
      [1, 3],
    ]
    cells.forEach(([col, row], i) => {
      const bx = left + col * cw
      const by = top + row * rh
      const dayNum = ((startDay - 1 + i) % dim) + 1
      txt(ctx, String(dayNum), bx + 14, by + 26, 13, 600, "#7c756c")
      txt(ctx, DAYS_TR_CAP[i].toLocaleUpperCase("en"), bx + 38, by + 26, 13, 700, "#2d2a26")
      drawBookmarkIcon(ctx, bx + cw - 24, by + 13, "#cfc9be")
    })
  } else if (t === "ivory_freestyle") {
    // Ref Image 1 Right: Top bar ("BOXED / FREESTYLE / SCHEDULE") + light grid
    const rightLimit = cfg?.showMonthTabs ? W - 42 : W - 36
    if (cfg?.headerTitle) txt(ctx, cfg.headerTitle, rightLimit * 0.50, 48, 12, 800, "#2c2925", "center")
    drawBasicPattern(ctx, "grid", rightLimit, H, spacing, cfg?.lineColor ?? "#e2ddd2", lw * 0.85, 36)
  } else if (t === "week_grid") {
    // Yatay sayfanın sol yarısı haftalık günler + mini takvim, sağ yarısı kareli kağıt
    const half = Math.round(W / 2)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, half, H)
    ctx.clip()
    drawTemplate(ctx, "ivory_week", half, H, cfg, null)
    ctx.restore()
    ctx.save()
    ctx.translate(half, 0)
    ctx.beginPath()
    ctx.rect(0, 0, W - half, H)
    ctx.clip()
    drawTemplate(ctx, "ivory_freestyle", W - half, H, { ...cfg, headerTitle: undefined, showMonthTabs: cfg?.showMonthTabs ?? true }, null)
    ctx.restore()
    // cilt sırtı gölgesi
    const g = ctx.createLinearGradient(half - 18, 0, half + 18, 0)
    g.addColorStop(0, "rgba(60,40,50,0)")
    g.addColorStop(0.5, "rgba(60,40,50,0.16)")
    g.addColorStop(1, "rgba(60,40,50,0)")
    ctx.fillStyle = g
    ctx.fillRect(half - 18, 0, 36, H)
  } else if (t === "pastel_week") {
    // Ref Image 2: Elegant two-column pastel weekly spread
    const year = cfg?.year ?? 2026
    const mIdx = cfg?.monthIndex ?? 8 // September default
    const startDay = cfg?.startDayNum ?? 8
    const dim = daysInMonth(year, mIdx)
    const accent = cfg?.lineColor ?? "#d9bdd0"
    const left = 44, right = cfg?.showMonthTabs ? W - 46 : W - 44
    const colGap = 36
    const colW = (right - left - colGap) / 2
    const top = 46, bottom = H - 36
    const rh = (bottom - top) / 4

    for (let i = 0; i < 7; i++) {
      const col = i < 4 ? 0 : 1
      const row = i < 4 ? i : i - 4
      const x = left + col * (colW + colGap)
      const y = top + row * rh
      const dayNum = ((startDay - 1 + i) % dim) + 1
      const numStr = dayNum < 10 ? `0${dayNum}` : String(dayNum)

      ctx.strokeStyle = accent
      ctx.lineWidth = 1.6
      hline(y, x, x + colW)
      txt(ctx, numStr, x + 4, y + 36, 30, 400, "#8c828a", "left", "Georgia, serif")
      txt(ctx, DAYS_TR_CAP[i], x + 52, y + 33, 19, 400, "#6d646b", "left", "Georgia, serif")
      drawBookmarkIcon(ctx, x + colW - 22, y + 16, "#d2c8cf")
    }

    // Bottom right cell: mini monthly calendar + "Notes for next week"
    const bx = left + colW + colGap
    const by = top + 3 * rh
    ctx.strokeStyle = accent
    ctx.lineWidth = 1.6
    hline(by, bx, bx + colW)

    const calW = colW * 0.44
    txt(ctx, cfg?.headerTitle || `${MON_FULL_TR[mIdx]} ${year}`, bx + 4, by + 30, 17, 500, "#4e474c", "left", "Georgia, serif")
    const cStep = calW / 7
    ;["M", "T", "W", "T", "F", "S", "S"].forEach((d, idx) =>
      txt(ctx, d, bx + (idx + 0.5) * cStep, by + 56, 11, 700, "#5c545a", "center"),
    )
    const offset = firstDayMondayOffset(year, mIdx)
    const rowH = Math.min(22, (rh - 76) / 6)
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 7; c++) {
        const dNum = r * 7 + c - offset + 1
        if (dNum >= 1 && dNum <= dim) {
          const inActiveWeek = dNum >= startDay && dNum < startDay + 7
          if (inActiveWeek) {
            ctx.fillStyle = "#efe5ec"
            ctx.fillRect(bx + c * cStep, by + 64 + r * rowH, cStep, rowH - 2)
          }
          txt(ctx, String(dNum), bx + (c + 0.5) * cStep, by + 64 + r * rowH + 14, 11, 500, "#4a4348", "center")
        }
      }
    }

    // Notes to next week box
    const nx = bx + calW + 14
    const nw = colW - calW - 14
    ctx.fillStyle = "#ebe8e1"
    rrect(ctx, nx, by + 16, nw, rh - 24, 14)
    ctx.fill()
    txt(ctx, "Notes for next week", nx + nw / 2, by + 40, 13, 600, "#6d666b", "center", "Georgia, serif")
    ctx.strokeStyle = "#d5d0c5"
    ctx.lineWidth = 1
    for (let ly = by + 68; ly < by + rh - 22; ly += 28) {
      ctx.beginPath()
      ctx.arc(nx + 20, ly - 4, 5, 0, Math.PI * 2)
      ctx.stroke()
      hline(ly, nx + 34, nx + nw - 14)
    }
  } else if (t === "daily") {
    // Daily schedule + Top 3 priorities + To-Do + Notes
    const rightLimit = W - 40
    txt(ctx, cfg?.headerTitle || "DAILY PLANNER", 40, 56, 28, 800, "#23211e")
    txt(ctx, cfg?.headerSubtitle || "Date: ____ / ____ / 2026", rightLimit, 56, 15, 600, "#7c756c", "right")
    ctx.strokeStyle = "#c8c1b4"
    ctx.lineWidth = 1.4
    hline(76, 40, rightLimit)

    const splitX = Math.round(W * 0.44)
    const top = 96, bottom = H - 40
    // Sol: saatlik program. Başlangıç/bitiş saati ve aralık seçilebilir; satırlar her zaman eşit aralıklıdır.
    txt(ctx, "HOURLY SCHEDULE", 44, top + 18, 12, 800, "#6e675e")
    const startH = Math.max(0, Math.min(23, Math.round(cfg?.startHour ?? 6)))
    const endH = Math.max(startH + 1, Math.min(24, Math.round(cfg?.endHour ?? 22)))
    const step = cfg?.stepMin ?? 60
    const rows = Math.max(1, Math.round(((endH - startH) * 60) / step))
    const hh = (bottom - top - 30) / rows
    for (let i = 0; i <= rows; i++) {
      const y = top + 30 + i * hh
      const mins = startH * 60 + i * step
      const onHour = mins % 60 === 0
      ctx.strokeStyle = onHour ? "#d6cfc2" : "#e9e4da"
      ctx.lineWidth = onHour ? 1.1 : 0.8
      hline(y, 92, splitX - 18)
      if (i < rows) {
        const label = `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`
        txt(ctx, label, 44, y + Math.min(hh * 0.62, 16), 11, onHour ? 700 : 500, onHour ? "#8c847a" : "#b3aca1")
      }
    }

    // Right column: Top 3, To-Do, Mood/Water, Notes
    const rx = splitX + 10, rw = rightLimit - rx
    const box1H = (bottom - top) * 0.24
    const box2H = (bottom - top) * 0.36
    const box3H = (bottom - top) * 0.36

    // Top 3
    ctx.fillStyle = "#f2ece1"
    rrect(ctx, rx, top, rw, box1H, 12)
    ctx.fill()
    txt(ctx, "TODAY'S PRIORITIES (TOP 3)", rx + 16, top + 24, 12, 800, "#5c544b")
    ctx.strokeStyle = "#d5cec0"
    for (let k = 0; k < 3; k++) {
      const ly = top + 46 + k * ((box1H - 54) / 3)
      txt(ctx, `${k + 1}.`, rx + 18, ly + 12, 14, 700, "#8c847a")
      hline(ly + 16, rx + 40, rx + rw - 16)
    }

    // To-Do
    const b2Y = top + box1H + 14
    ctx.strokeStyle = "#cfc8ba"
    ctx.lineWidth = 1.3
    rrect(ctx, rx, b2Y, rw, box2H, 12)
    ctx.stroke()
    txt(ctx, "TO-DO", rx + 16, b2Y + 24, 12, 800, "#5c544b")
    const todoCount = 6
    const tStep = (box2H - 42) / todoCount
    for (let k = 0; k < todoCount; k++) {
      const ly = b2Y + 46 + k * tStep
      ctx.strokeRect(rx + 16, ly - 10, 13, 13)
      hline(ly + 4, rx + 38, rx + rw - 16)
    }

    // Notes & Water
    const b3Y = b2Y + box2H + 14
    rrect(ctx, rx, b3Y, rw, box3H, 12)
    ctx.stroke()
    txt(ctx, "NOTES & WATER TRACKER", rx + 16, b3Y + 24, 12, 800, "#5c544b")
    for (let d = 0; d < 8; d++) {
      ctx.beginPath()
      ctx.arc(rx + rw - 24 - d * 22, b3Y + 20, 6.5, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.strokeStyle = "#e2ddd2"
    for (let ly = b3Y + 56; ly < b3Y + box3H - 14; ly += 28) hline(ly, rx + 16, rx + rw - 16)
  } else if (t === "tracker") {
    // Habit + Mood Tracker
    const rightLimit = W - 40
    txt(ctx, cfg?.headerTitle || "HABIT & MOOD TRACKER", 40, 56, 26, 800, "#23211e")
    hline(76, 40, rightLimit)
    const top = 94, tableH = (H - 130) * 0.56
    const labelW = Math.min(220, W * 0.24)
    const cw = (rightLimit - 40 - labelW) / 31
    const habits = 9
    const rh = (tableH - 32) / habits
    ctx.fillStyle = "#efe9dc"
    ctx.fillRect(40, top, rightLimit - 40, 32)
    ctx.strokeStyle = "#cbc4b6"
    ctx.lineWidth = 1.1
    ctx.strokeRect(40, top, rightLimit - 40, tableH)
    txt(ctx, "HABITS", 52, top + 21, 12, 700, "#5c544b")
    for (let d = 0; d < 31; d++) {
      const cx = 40 + labelW + d * cw
      txt(ctx, String(d + 1), cx + cw / 2, top + 20, 10, 600, "#666", "center")
      ctx.beginPath()
      ctx.moveTo(cx, top)
      ctx.lineTo(cx, top + tableH)
      ctx.stroke()
    }
    for (let r = 0; r < habits; r++) {
      hline(top + 32 + r * rh, 40, rightLimit)
    }

    // Bottom: Mood / Sleep / Gratitude
    const bTop = top + tableH + 22
    const bH = H - 36 - bTop
    const bw = (rightLimit - 40 - 20) / 2
    ctx.strokeStyle = "#cbc4b6"
    rrect(ctx, 40, bTop, bw, bH, 12)
    ctx.stroke()
    txt(ctx, "MONTHLY MOOD & ENERGY", 56, bTop + 26, 13, 800, "#5c544b")
    for (let ly = bTop + 56; ly < bTop + bH - 16; ly += 28) hline(ly, 56, 40 + bw - 16)

    rrect(ctx, 40 + bw + 20, bTop, bw, bH, 12)
    ctx.stroke()
    txt(ctx, "READING / WATCHING", 56 + bw + 20, bTop + 26, 13, 800, "#5c544b")
    for (let ly = bTop + 56; ly < bTop + bH - 16; ly += 28) hline(ly, 56 + bw + 20, rightLimit - 16)
  } else if (t === "month") {
    hline(95)
    if (cfg?.headerTitle) txt(ctx, cfg.headerTitle, 52, 76, 28, 800)
    const top = 150, left = 50, cw = (W - 100) / 7, hh = 46, rows = 6, ch = (H - 60 - top - hh) / rows
    ctx.fillStyle = "#f0eadc"
    ctx.fillRect(left, top, cw * 7, hh)
    for (let c = 0; c < 7; c++) {
      ctx.strokeRect(left + c * cw, top, cw, hh)
      txt(ctx, DAYS[c].slice(0, 3).toLocaleUpperCase("en"), left + c * cw + cw / 2, top + 29, 14, 700, "#5c544b", "center")
    }
    for (let r = 0; r < rows; r++) for (let c = 0; c < 7; c++) ctx.strokeRect(left + c * cw, top + hh + r * ch, cw, ch)
  } else if (t === "week") {
    hline(95)
    if (cfg?.headerTitle) txt(ctx, cfg.headerTitle, 52, 76, 26, 800)
    const top = 140, rows = 7, rh = (H - 60 - top) / rows, lw2 = 96
    for (let r = 0; r < rows; r++) {
      ctx.fillStyle = "#f0eadc"
      ctx.fillRect(50, top + r * rh, lw2, rh)
      ctx.strokeRect(50, top + r * rh, W - 100, rh)
      ctx.beginPath()
      ctx.moveTo(50 + lw2, top + r * rh)
      ctx.lineTo(50 + lw2, top + (r + 1) * rh)
      ctx.stroke()
      txt(ctx, DAYS[r].slice(0, 3), 50 + lw2 / 2, top + r * rh + rh / 2 + 5, 14, 700, "#5c544b", "center")
    }
  } else if (t === "year") {
    hline(80)
    txt(ctx, cfg?.headerTitle || String(cfg?.year ?? 2026), 52, 64, 30, 800)
    const cols = 3, rows = 4, gx = 24, gy = 20, top = 120, left = 50
    const bw = (W - 100 - gx * (cols - 1)) / cols, bh = (H - 50 - top - gy * (rows - 1)) / rows
    for (let i = 0; i < 12; i++) {
      const x = left + (i % cols) * (bw + gx), y = top + Math.floor(i / cols) * (bh + gy)
      ctx.fillStyle = "#f0eadc"
      ctx.fillRect(x, y, bw, 30)
      ctx.strokeRect(x, y, bw, 30)
      txt(ctx, MON_FULL_TR[i], x + 10, y + 20, 13, 700, "#4a433b")
      const cw = bw / 7, ch = (bh - 30) / 6
      for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) ctx.strokeRect(x + c * cw, y + 30 + r * ch, cw, ch)
    }
  } else if (t === "weekbox") {
    ctx.strokeStyle = "#2c2c2c"
    ctx.lineWidth = 1.5
    txt(ctx, cfg?.headerTitle || "This Week", 40, 80, 54, 800)
    txt(ctx, "Week", 40, 130, 20, 800)
    ;["01", "02", "03", "04"].forEach((n, i) => txt(ctx, n, 118 + i * 52, 130, 20, 500))
    txt(ctx, "Month", W * 0.34, 130, 20, 800)
    MON.forEach((m, i) => txt(ctx, m, W * 0.41 + i * ((W * 0.59 - 36) / 12), 130, 20, 500))
    const top = 165, midY = (top + H) / 2, c1 = W / 3, c2 = (2 * W) / 3
    hline(top, 0, W)
    hline(midY, 0, W)
    hline((midY + H) / 2, c2, W)
    ;[c1, c2].forEach((x) => {
      ctx.beginPath()
      ctx.moveTo(x, top)
      ctx.lineTo(x, H)
      ctx.stroke()
    })
    const cells: [number, number][] = [
      [0, top],
      [c1, top],
      [c2, top],
      [0, midY],
      [c1, midY],
      [c2, midY],
      [c2, (midY + H) / 2],
    ]
    cells.forEach(([x, y], i) => txt(ctx, DAYS[i], x + 22, y + 40, 22, 700))
  } else if (t === "monthplan") {
    for (let i = 0; i < 12; i++) {
      ctx.save()
      ctx.setLineDash([2, 2])
      ctx.strokeStyle = "#8a8a8a"
      ctx.strokeRect(40 + i * 30, 22, 26, 28)
      ctx.restore()
      txt(ctx, String(i + 1), 53 + i * 30, 42, 15, 500, "#333", "center")
    }
    txt(ctx, cfg?.headerTitle || "MONTHLY PLAN", 38, 122, Math.min(72, W * 0.09), 900, "#000")
    const left = 36, top = 178, bottom = H - 36, noteW = W * 0.19, gx = left + noteW + 14, cw = (W - 36 - gx) / 7, ch = (bottom - top) / 6
    ctx.save()
    ctx.strokeStyle = "#d8d8d8"
    ctx.lineWidth = 0.7
    for (let x = left; x <= left + noteW; x += 10) {
      ctx.beginPath()
      ctx.moveTo(x, top)
      ctx.lineTo(x, bottom)
      ctx.stroke()
    }
    for (let y = top; y <= bottom; y += 10) {
      ctx.beginPath()
      ctx.moveTo(left, y)
      ctx.lineTo(left + noteW, y)
      ctx.stroke()
    }
    ctx.strokeStyle = "#333"
    ctx.lineWidth = 1.4
    ctx.strokeRect(left, top, noteW, bottom - top)
    ctx.restore()
    ;["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((d, i) =>
      txt(ctx, d, gx + i * cw + cw / 2, top - 12, 16, 700, i === 6 ? "#9b1c1c" : i === 5 ? "#1d4f91" : "#666", "center"),
    )
    ctx.strokeStyle = "#c2c2c2"
    ctx.lineWidth = 1.2
    for (let r = 0; r < 6; r++)
      for (let c = 0; c < 7; c++) {
        ctx.strokeRect(gx + c * cw, top + r * ch, cw, ch)
        hline(top + r * ch + 22, gx + c * cw + 8, gx + c * cw + 22)
      }
  } else if (t === "weeklist") {
    const tw = (W * 0.62) / 12
    MON.forEach((m, i) => {
      const x = W * 0.36 + i * tw
      ctx.fillStyle = "#ece6e9"
      rrect(ctx, x + 2, -10, tw - 4, 44, 12)
      ctx.fill()
      txt(ctx, m.toLocaleUpperCase("en"), x + tw / 2, 24, 12, 700, "#8d8590", "center")
    })
    const top = 70, bottom = H - 30, rh = (bottom - top) / 4, colW = (W - 100) / 2
    for (let col = 0; col < 2; col++)
      for (let r = 0; r < 4; r++) {
        const x = 40 + col * (colW + 20), y = top + r * rh, idx = col * 4 + r
        ctx.strokeStyle = "#e2b8d1"
        ctx.lineWidth = 1.6
        hline(y, x, x + colW)
        if (idx < 7) txt(ctx, DAYS[idx], x + 92, y + 48, 26, 400, "#7a7077", "left", "Georgia, serif", true)
        else {
          ctx.fillStyle = "#ebe7ea"
          rrect(ctx, x, y + 14, colW, rh - 28, 16)
          ctx.fill()
          txt(ctx, "Notes for next week", x + colW / 2, y + 44, 18, 500, "#8d8590", "center")
        }
      }
  } else if (t === "weeklyleft") {
    ctx.strokeStyle = "#2c2c2c"
    ctx.lineWidth = 1.4
    txt(ctx, cfg?.headerTitle || "●●●  WEEK", 40, 58, 24, 800)
    hline(80, 40, W - 40)
    const top = 98, bottom = H - 40, rh = (bottom - top) / 4, cw = (W - 80) / 2
    ctx.strokeStyle = "#cfcabd"
    for (let r = 0; r <= 4; r++) hline(top + r * rh, 40, W - 40)
    ctx.beginPath()
    ctx.moveTo(W / 2, top)
    ctx.lineTo(W / 2, bottom)
    ctx.stroke()
    ;["M", "T", "W", "T", "F", "S", "S"].forEach((d, i) => txt(ctx, d, 52 + (i + 0.5) * ((cw - 24) / 7), top + 38, 16, 700, "#666", "center"))
    for (let r = 1; r <= 6; r++) hline(top + 52 + r * ((rh - 66) / 6), 52, 40 + cw - 12)
    const pos: [number, number][] = [
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
      [1, 2],
      [0, 3],
      [1, 3],
    ]
    pos.forEach(([c, r], i) => txt(ctx, DAYS[i].toLocaleUpperCase("en"), 40 + c * cw + 16, top + r * rh + 30, 15, 700, "#666"))
  }

  ctx.restore()
}

// ============================================================================
// SMOOTH VARIABLE-WIDTH INK ENGINE & SMART SHAPE
// ============================================================================

const mid = (a: number, b: number) => (a + b) / 2

// ---- Kağıt dokusu ---------------------------------------------------------
let GRAIN: HTMLCanvasElement | null = null
export function grainTile(): HTMLCanvasElement {
  if (GRAIN) return GRAIN
  const c = document.createElement("canvas")
  c.width = c.height = 128
  const g = c.getContext("2d")!
  const img = g.createImageData(128, 128)
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = 120
    img.data[i + 1] = 100
    img.data[i + 2] = 82
    img.data[i + 3] = Math.random() < 0.55 ? Math.floor(Math.random() * 22) : 0
  }
  g.putImageData(img, 0, 0)
  GRAIN = c
  return c
}
let GRAIN_URL = ""
export function grainDataUrl(): string {
  return GRAIN_URL || (GRAIN_URL = grainTile().toDataURL("image/png"))
}
export function drawGrain(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const pat = ctx.createPattern(grainTile(), "repeat")
  if (!pat) return
  ctx.save()
  ctx.fillStyle = pat
  ctx.fillRect(0, 0, W, H)
  ctx.restore()
}

/** Streamline / EMA smoothing + synthetic velocity pressure when pressure is flat (0.5). */
export function smoothPts(raw: number[], streamline = 0.55): number[] {
  const n = raw.length / 3
  if (n <= 2) return raw.slice()

  // Check if real stylus pressure variance exists
  let hasRealPressure = false
  for (let i = 0; i < n; i++) {
    if (Math.abs(raw[i * 3 + 2] - 0.5) > 0.03) {
      hasRealPressure = true
      break
    }
  }

  const out: number[] = [raw[0], raw[1], hasRealPressure ? raw[2] : 0.45]
  const alpha = 1 - Math.max(0, Math.min(0.85, streamline * 0.78))
  let lx = raw[0], ly = raw[1], lp = out[2]

  for (let i = 1; i < n; i++) {
    const rx = raw[i * 3]
    const ry = raw[i * 3 + 1]
    const rp = raw[i * 3 + 2]
    const dist = Math.hypot(rx - lx, ry - ly)
    if (i < n - 1 && dist < 0.75) continue // drop near-duplicate jitter

    const isLast = i === n - 1
    const k = isLast ? 0.85 : alpha
    const x = lx + (rx - lx) * k
    const y = ly + (ry - ly) * k

    let targetP = rp
    if (!hasRealPressure) {
      // Slower strokes -> slightly thicker, faster strokes -> slightly thinner
      const speedNorm = Math.min(1, dist / 28)
      targetP = 0.62 - speedNorm * 0.34
    }
    const p = lp + (targetP - lp) * 0.45
    out.push(x, y, p)
    lx = x
    ly = y
    lp = p
  }
  return out
}

type SamplePt = { x: number; y: number; r: number }

/** Interpolate quadratic spline segments into dense ribbon samples for smooth variable-width ink. */
function buildRibbonSamples(pts: number[], baseSize: number, minScale: number, maxScale: number): SamplePt[] {
  const n = pts.length / 3
  const samples: SamplePt[] = []
  const radiusAt = (i: number, total: number) => {
    const p = pts[i * 3 + 2]
    // Taper gently at the very start & end
    const tStart = Math.min(1, (i + 1) / Math.min(4, total))
    const tEnd = Math.min(1, (total - i) / Math.min(4, total))
    const taper = Math.min(tStart, tEnd)
    const mult = minScale + Math.max(0, Math.min(1, p)) * (maxScale - minScale)
    return Math.max(0.45, (baseSize * mult * (0.65 + 0.35 * taper)) / 2)
  }

  if (n === 1) return [{ x: pts[0], y: pts[1], r: radiusAt(0, 1) }]
  if (n === 2) {
    const r0 = radiusAt(0, 2), r1 = radiusAt(1, 2)
    return [
      { x: pts[0], y: pts[1], r: r0 },
      { x: mid(pts[0], pts[3]), y: mid(pts[1], pts[4]), r: mid(r0, r1) },
      { x: pts[3], y: pts[4], r: r1 },
    ]
  }

  for (let k = 1; k < n - 1; k++) {
    const x0 = k === 1 ? pts[0] : mid(pts[(k - 1) * 3], pts[k * 3])
    const y0 = k === 1 ? pts[1] : mid(pts[(k - 1) * 3 + 1], pts[k * 3 + 1])
    const r0 = k === 1 ? radiusAt(0, n) : mid(radiusAt(k - 1, n), radiusAt(k, n))
    const cx = pts[k * 3]
    const cy = pts[k * 3 + 1]
    const rc = radiusAt(k, n)
    const x2 = k === n - 2 ? pts[(k + 1) * 3] : mid(cx, pts[(k + 1) * 3])
    const y2 = k === n - 2 ? pts[(k + 1) * 3 + 1] : mid(cy, pts[(k + 1) * 3 + 1])
    const r2 = k === n - 2 ? radiusAt(k + 1, n) : mid(rc, radiusAt(k + 1, n))

    const segLen = Math.hypot(cx - x0, cy - y0) + Math.hypot(x2 - cx, y2 - cy)
    const steps = Math.max(2, Math.min(12, Math.ceil(segLen / 3.5)))
    for (let s = 0; s < steps; s++) {
      const t = s / steps
      const mt = 1 - t
      const x = mt * mt * x0 + 2 * mt * t * cx + t * t * x2
      const y = mt * mt * y0 + 2 * mt * t * cy + t * t * y2
      const r = mt * mt * r0 + 2 * mt * t * rc + t * t * r2
      samples.push({ x, y, r })
    }
    if (k === n - 2) samples.push({ x: x2, y: y2, r: r2 })
  }
  return samples
}

function fillRibbon(ctx: CanvasRenderingContext2D, samples: SamplePt[]) {
  if (!samples.length) return
  if (samples.length === 1) {
    ctx.beginPath()
    ctx.arc(samples[0].x, samples[0].y, samples[0].r, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  const leftPts: [number, number][] = []
  const rightPts: [number, number][] = []
  for (let i = 0; i < samples.length; i++) {
    const prev = samples[Math.max(0, i - 1)]
    const next = samples[Math.min(samples.length - 1, i + 1)]
    let dx = next.x - prev.x
    let dy = next.y - prev.y
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    const nx = -dy
    const ny = dx
    const r = samples[i].r
    leftPts.push([samples[i].x + nx * r, samples[i].y + ny * r])
    rightPts.push([samples[i].x - nx * r, samples[i].y - ny * r])
  }

  ctx.beginPath()
  ctx.moveTo(leftPts[0][0], leftPts[0][1])
  for (let i = 1; i < leftPts.length; i++) ctx.lineTo(leftPts[i][0], leftPts[i][1])
  const last = samples[samples.length - 1]
  const lastPrev = samples[samples.length - 2]
  const endAng = Math.atan2(last.y - lastPrev.y, last.x - lastPrev.x)
  ctx.arc(last.x, last.y, last.r, endAng + Math.PI / 2, endAng - Math.PI / 2, true)
  for (let i = rightPts.length - 1; i >= 0; i--) ctx.lineTo(rightPts[i][0], rightPts[i][1])
  const first = samples[0]
  const firstNext = samples[1]
  const startAng = Math.atan2(firstNext.y - first.y, firstNext.x - first.x)
  ctx.arc(first.x, first.y, first.r, startAng - Math.PI / 2, startAng + Math.PI / 2, true)
  ctx.closePath()
  ctx.fill()
}

function strokeUnifiedQuadPath(ctx: CanvasRenderingContext2D, pts: number[]) {
  const n = pts.length / 3
  if (!n) return
  ctx.beginPath()
  ctx.moveTo(pts[0], pts[1])
  if (n === 1) ctx.lineTo(pts[0] + 0.1, pts[1])
  for (let i = 1; i < n - 1; i++) {
    ctx.quadraticCurveTo(pts[i * 3], pts[i * 3 + 1], mid(pts[i * 3], pts[i * 3 + 3]), mid(pts[i * 3 + 1], pts[i * 3 + 4]))
  }
  if (n > 1) ctx.lineTo(pts[(n - 1) * 3], pts[(n - 1) * 3 + 1])
  ctx.stroke()
}

/** Biten çizgilerin yumuşatılmış noktaları önbellekte tutulur: sayfa yeniden çizilirken tekrar hesaplanmaz. */
const SMOOTH_CACHE = new WeakMap<Stroke, { sl: number; n: number; p: number[] }>()
function smoothed(s: Stroke, sl: number): number[] {
  const c = SMOOTH_CACHE.get(s)
  if (c && c.sl === sl && c.n === s.pts.length) return c.p
  const p = smoothPts(s.pts, sl)
  SMOOTH_CACHE.set(s, { sl, n: s.pts.length, p })
  return p
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, streamline = 0.55) {
  const rawN = s.pts.length / 3
  if (!rawN) return
  const p = smoothed(s, streamline)
  const style = s.penStyle ?? (s.tool === "marker" ? "marker" : "fountain")

  ctx.save()
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.strokeStyle = ctx.fillStyle = s.color
  if (s.opacity !== undefined) ctx.globalAlpha = s.opacity

  if (s.tool === "marker" || style === "marker") {
    ctx.globalAlpha = s.opacity ?? 0.38
    ctx.lineCap = "square"
    ctx.lineWidth = Math.max(12, s.size * 2.5)
    strokeUnifiedQuadPath(ctx, p)
  } else if (style === "ballpoint") {
    ctx.lineWidth = Math.max(1, s.size * 0.85)
    strokeUnifiedQuadPath(ctx, p)
  } else if (style === "dashed") {
    ctx.lineWidth = Math.max(1.2, s.size * 0.9)
    ctx.setLineDash([s.size * 2.8, s.size * 1.9])
    strokeUnifiedQuadPath(ctx, p)
  } else if (style === "brush") {
    const samples = buildRibbonSamples(p, s.size, 0.22, 1.95)
    fillRibbon(ctx, samples)
  } else if (style === "pencil") {
    // Kurşun kalem: kalemi yatırdıkça kalınlaşır, hafif saydamdır (eğim bilgisi basınç kanalında taşınır)
    ctx.globalAlpha = (s.opacity ?? 1) * 0.7
    fillRibbon(ctx, buildRibbonSamples(p, s.size, 0.3, 3.1))
  } else {
    // fountain (default smooth variable-width ribbon)
    const samples = buildRibbonSamples(p, s.size, 0.45, 1.38)
    fillRibbon(ctx, samples)
  }
  ctx.restore()
}

/** Keep legacy penSeg export for compatibility if needed anywhere. */
export function penSeg(ctx: CanvasRenderingContext2D, s: Stroke, k: number) {
  const p = s.pts
  const n = p.length / 3
  if (k < 1 || k >= n) return
  const sx = k === 1 ? p[0] : mid(p[(k - 1) * 3], p[k * 3])
  const sy = k === 1 ? p[1] : mid(p[(k - 1) * 3 + 1], p[k * 3 + 1])
  const ex = k === n - 1 ? p[k * 3] : mid(p[k * 3], p[k * 3 + 3])
  const ey = k === n - 1 ? p[k * 3 + 1] : mid(p[k * 3 + 1], p[k * 3 + 4])
  ctx.save()
  ctx.lineCap = "round"
  ctx.strokeStyle = s.color
  ctx.lineWidth = s.size * (0.4 + p[k * 3 + 2] * 1.2)
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.quadraticCurveTo(p[k * 3], p[k * 3 + 1], ex, ey)
  ctx.stroke()
  ctx.restore()
}

/** Highlighters always sit underneath the pen ink, whatever order they were drawn in. */
export function drawAll(ctx: CanvasRenderingContext2D, strokes: Stroke[], streamline = 0.55) {
  const safeStrokes = strokes ?? []
  safeStrokes.forEach((s) => (s.tool === "marker" || s.penStyle === "marker") && drawStroke(ctx, s, streamline))
  safeStrokes.forEach((s) => s.tool !== "marker" && s.penStyle !== "marker" && drawStroke(ctx, s, streamline))
}

/** Smart shape recognition when the user pauses at the end of a stroke. */
export function snapShape(s: Stroke): Stroke | null {
  const p = s.pts
  const n = p.length / 3
  if (n < 6) return null

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, totalLen = 0
  for (let i = 0; i < n; i++) {
    const x = p[i * 3], y = p[i * 3 + 1]
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    if (i > 0) totalLen += Math.hypot(x - p[(i - 1) * 3], y - p[(i - 1) * 3 + 1])
  }
  const w = maxX - minX
  const h = maxY - minY
  const diag = Math.hypot(w, h)
  if (diag < 28 || totalLen < 28) return null

  const sx = p[0], sy = p[1]
  const ex = p[(n - 1) * 3], ey = p[(n - 1) * 3 + 1]
  const endDist = Math.hypot(ex - sx, ey - sy)

  // 1. Straight line check
  if (endDist > totalLen * 0.87) {
    return {
      ...s,
      penStyle: s.penStyle === "fountain" || !s.penStyle ? "ballpoint" : s.penStyle,
      pts: [sx, sy, 0.5, mid(sx, ex), mid(sy, ey), 0.5, ex, ey, 0.5],
    }
  }

  // 2. Closed shape (circle/ellipse or rectangle)
  if (endDist < Math.max(38, diag * 0.35)) {
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const rx = w / 2
    const ry = h / 2
    if (rx < 10 || ry < 10) return null

    // Measure fit to ellipse vs rectangle
    let ellipseErr = 0
    let rectErr = 0
    for (let i = 0; i < n; i++) {
      const x = p[i * 3], y = p[i * 3 + 1]
      const ne = Math.hypot((x - cx) / rx, (y - cy) / ry)
      ellipseErr += Math.abs(ne - 1)
      const dxEdge = Math.min(Math.abs(x - minX), Math.abs(x - maxX))
      const dyEdge = Math.min(Math.abs(y - minY), Math.abs(y - maxY))
      rectErr += Math.min(dxEdge, dyEdge) / Math.max(rx, ry)
    }
    ellipseErr /= n
    rectErr /= n

    if (ellipseErr < rectErr && ellipseErr < 0.24) {
      const pts: number[] = []
      const steps = 48
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2
        pts.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 0.5)
      }
      return {
        ...s,
        penStyle: s.penStyle === "fountain" || !s.penStyle ? "ballpoint" : s.penStyle,
        pts,
      }
    }
    if (rectErr < 0.22) {
      const corners = [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
        [minX, minY],
      ]
      const pts: number[] = []
      for (let c = 0; c < 4; c++) {
        const [ax, ay] = corners[c]
        const [bx, by] = corners[c + 1]
        for (let k = 0; k < 4; k++) {
          const t = k / 4
          pts.push(ax + (bx - ax) * t, ay + (by - ay) * t, 0.5)
        }
      }
      pts.push(minX, minY, 0.5)
      return {
        ...s,
        penStyle: s.penStyle === "fountain" || !s.penStyle ? "ballpoint" : s.penStyle,
        pts,
      }
    }
  }
  return null
}

// ============================================================================
// ITEM & FULL PAGE RENDERING (Thumbnails, 3D Spreads & PNG Export)
// ============================================================================

export function resolveFontFamily(f?: Item["fontFamily"]) {
  if (typeof f === "string" && f.startsWith("cf-")) return `"${f}", ${FAM}`
  if (f === "serif") return "Georgia, 'Times New Roman', serif"
  if (f === "hand") return "'Bradley Hand', 'Marker Felt', 'Segoe Print', cursive"
  if (f === "mono") return "ui-monospace, 'SF Mono', Menlo, monospace"
  return FAM
}

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split("\n")) {
    const words = para.split(" ")
    let line = ""
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line)
        line = w
      } else {
        line = test
      }
    }
    out.push(line)
  }
  return out
}

async function drawItemOnCanvas(ctx: CanvasRenderingContext2D, it: Item) {
  ctx.save()
  ctx.globalAlpha = it.opacity ?? 1
  ctx.translate(it.x + it.w / 2, it.y + it.h / 2)
  ctx.rotate((it.rot * Math.PI) / 180)
  if (it.flipX) ctx.scale(-1, 1)

  const hw = it.w / 2
  const hh = it.h / 2

  if (it.kind === "textbox") {
    const pad = it.pill ? 16 : 12
    const rad = it.pill ? Math.min(it.w, it.h) / 2 : 12
    if (it.bgColor && it.bgColor !== "transparent") {
      ctx.fillStyle = it.bgColor
      rrect(ctx, -hw, -hh, it.w, it.h, rad)
      ctx.fill()
    }
    if (it.borderColor && it.borderColor !== "transparent") {
      ctx.strokeStyle = it.borderColor
      ctx.lineWidth = 2
      rrect(ctx, -hw, -hh, it.w, it.h, rad)
      ctx.stroke()
    }
    const fSize = it.fontSize ?? 26
    ctx.font = `${it.italic ? "italic " : ""}${it.bold ? "700" : "500"} ${fSize}px ${resolveFontFamily(it.fontFamily)}`
    ctx.fillStyle = it.color ?? "#25252b"
    ctx.textBaseline = "top"
    const align = it.align ?? "left"
    ctx.textAlign = align
    const lines = wrapTextLines(ctx, it.text || "", Math.max(40, it.w - pad * 2))
    const lh = fSize * 1.28
    const totalH = lines.length * lh
    const startY = Math.max(-hh + pad, -totalH / 2)
    const tx = align === "center" ? 0 : align === "right" ? hw - pad : -hw + pad
    lines.forEach((ln, idx) => ctx.fillText(ln, tx, startY + idx * lh))
  } else if (it.src) {
    try {
      const img = await loadImg(it.src)
      if (it.frame === "polaroid") {
        const pPad = 14, pBot = 46
        ctx.save()
        ctx.shadowColor = "rgba(0,0,0,0.22)"
        ctx.shadowBlur = 12
        ctx.shadowOffsetY = 4
        ctx.fillStyle = "#fdfcf9"
        ctx.fillRect(-hw, -hh, it.w, it.h)
        ctx.restore()
        ctx.drawImage(img, -hw + pPad, -hh + pPad, Math.max(10, it.w - pPad * 2), Math.max(10, it.h - pPad - pBot))
        if (it.caption) {
          txt(ctx, it.caption, 0, hh - 16, 18, 600, "#3a3632", "center", "'Bradley Hand', cursive")
        }
      } else {
        if (it.frame === "shadow") {
          ctx.shadowColor = "rgba(0,0,0,0.24)"
          ctx.shadowBlur = 12
          ctx.shadowOffsetY = 5
        }
        if (it.frame === "rounded") {
          ctx.save()
          rrect(ctx, -hw, -hh, it.w, it.h, 18)
          ctx.clip()
          ctx.drawImage(img, -hw, -hh, it.w, it.h)
          ctx.restore()
        } else {
          ctx.drawImage(img, -hw, -hh, it.w, it.h)
        }
        if (it.frame === "tape") {
          ctx.fillStyle = "rgba(236, 224, 188, 0.82)"
          ctx.save()
          ctx.rotate(-0.05)
          ctx.fillRect(-46, -hh - 10, 92, 22)
          ctx.restore()
        } else if (it.frame === "pin") {
          ctx.fillStyle = "rgba(0,0,0,0.22)"
          ctx.beginPath()
          ctx.ellipse(3, -hh + 12, 8, 3.5, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = "#ef4444"
          ctx.beginPath()
          ctx.arc(0, -hh - 4, 11, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = "rgba(255,255,255,0.55)"
          ctx.beginPath()
          ctx.arc(-3, -hh - 7, 3.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    } catch {}
  } else if (it.text) {
    ctx.font = `${it.h * 0.8}px serif`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(it.text, 0, 0)
  }
  ctx.restore()
}

export async function renderPage(page: Page, scale: number): Promise<HTMLCanvasElement> {
  if (page.items.some((i) => typeof i.fontFamily === "string" && i.fontFamily.startsWith("cf-"))) await ensureFonts()
  const c = document.createElement("canvas")
  const { w: W, h: H } = dims(page.orient)
  c.width = Math.max(1, Math.round(W * scale))
  c.height = Math.max(1, Math.round(H * scale))
  const ctx = c.getContext("2d")!
  ctx.fillStyle = page.bg ?? PAPER
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.scale(scale, scale)

  let bgImgEl: HTMLImageElement | null = null
  if (page.config?.bgImage) {
    try {
      bgImgEl = await loadImg(page.config.bgImage)
    } catch {}
  }

  drawTemplate(ctx, page.template, W, H, page.config, bgImgEl)
  if (page.texture !== false) drawGrain(ctx, W, H)
  for (const it of page.items) {
    await drawItemOnCanvas(ctx, it)
  }
  drawAll(ctx, page.strokes)
  return c
}
