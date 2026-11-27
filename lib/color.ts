/** Hex rengi beyaza (amount>0) ya da koyuya (amount<0) doğru karıştırır. */
export function tint(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const to = amount >= 0 ? 255 : 0
  const k = Math.abs(amount)
  const ch = (v: number) => Math.round(v + (to - v) * k)
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255)
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")
}
