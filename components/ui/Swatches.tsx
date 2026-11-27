"use client"

export default function Swatches({ colors, value, onPick }: { colors: string[]; value: string; onPick: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {colors.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          aria-label={c}
          className={`press h-10 w-10 rounded-full border-2 transition-transform duration-300 ${value === c ? "scale-110 border-primary" : "border-white shadow-soft"}`}
          style={{ background: c }}
        />
      ))}
      <label className="press relative h-10 w-10 overflow-hidden rounded-full border-2 border-white shadow-soft" style={{ background: "conic-gradient(#f4b6c2,#f9cfa5,#f6e58d,#b8e0c0,#a9d6e5,#cbb7ea,#f4b6c2)" }}>
        <input type="color" value={value} onChange={(e) => onPick(e.target.value)} className="absolute inset-0 opacity-0" aria-label="Custom color" />
      </label>
    </div>
  )
}
