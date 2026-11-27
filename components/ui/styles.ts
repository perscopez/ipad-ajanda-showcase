/** Ortak sınıflar (Bubblegum): kalın macenta çerçeve + sert gölge. */
export const btn =
  "press inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 border-primary bg-paper px-4 text-sm font-semibold text-ink shadow-soft hover:bg-rose-soft disabled:opacity-40 disabled:hover:bg-paper"
export const btnPrimary =
  "press inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 border-primary bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-soft hover:bg-primary/90 disabled:opacity-40"
export const btnDanger =
  "press inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border-2 border-red-400 bg-rose-soft px-5 text-sm font-semibold text-red-700 shadow-soft hover:bg-rose/60"
export const field =
  "w-full rounded-xl border-2 border-line bg-paper px-4 py-3 text-base text-ink outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/20"
export const label = "mb-1.5 mt-4 block text-sm font-semibold text-ink-soft"
export const choice = (active: boolean) =>
  `press rounded-xl border-2 p-3 text-left transition-colors ${active ? "border-primary bg-paper shadow-soft" : "border-line bg-cream hover:bg-paper"}`
