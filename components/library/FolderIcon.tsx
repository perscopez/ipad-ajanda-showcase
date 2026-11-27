"use client"

import { tint } from "@/lib/color"
import type { Folder } from "@/lib/types"

const LIFT = ["group-hover:-translate-y-[10%]", "group-hover:-translate-y-[17%]", "group-hover:-translate-y-[24%]"]

type IconFolder = Pick<Folder, "color" | "emoji" | "image" | "frame" | "frontColor">

/**
 * Pastel klasör: arka panel + dışarı sarkan kağıtlar + ön panel.
 * Üst öğede `group` varsa, üzerine gelince/basınca kağıtlar yukarı kayar, ön panel hafifçe açılır.
 */
export default function FolderIcon({ folder, size = 150, count = 0 }: { folder: IconFolder; size?: number; count?: number }) {
  const w = size
  const h = size * 0.82
  // Kendi görselini yüklediyse klasör şeklinin yerine kendisi görünür (kırpılmadan, şeffaflık korunarak).
  if (folder.image && !folder.frame)
    return (
      <div className="flex items-center justify-center" style={{ width: w, height: h }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={folder.image} alt="" draggable={false} className="max-h-full max-w-full object-contain drop-shadow-lg transition-transform duration-500 ease-soft group-hover:-translate-y-1 group-hover:scale-[1.04]" />
      </div>
    )
  const back = folder.color
  const front = folder.frontColor ?? tint(folder.color, 0.38)
  const sheets = Math.min(3, Math.max(1, count))
  return (
    <div className="relative" style={{ width: w, height: h }}>
      <div className="absolute left-0 top-0 h-[22%] w-[44%] rounded-t-[22%] shadow-soft" style={{ background: back }} />
      <div className="absolute inset-x-0 bottom-0 top-[10%] rounded-[12%] rounded-tl-none shadow-soft" style={{ background: back }} />
      {Array.from({ length: sheets }).map((_, i) => (
        <div
          key={i}
          className={`absolute inset-x-[9%] top-[16%] h-[62%] origin-bottom rounded-lg bg-paper shadow-soft transition-transform duration-500 ease-soft ${LIFT[i]}`}
          style={{
            transform: `rotate(${(i - (sheets - 1) / 2) * 3}deg)`,
            transitionDelay: `${i * 40}ms`,
          }}
        />
      ))}
      <div
        className="absolute inset-x-0 bottom-0 top-[30%] flex origin-bottom items-center justify-center overflow-hidden rounded-[12%] shadow-lift transition-transform duration-500 ease-soft group-hover:[transform:perspective(700px)_rotateX(-9deg)]"
        style={{ background: `linear-gradient(160deg, ${tint(front, 0.25)}, ${front})` }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-paper/70" />
        {folder.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={folder.image} alt="" draggable={false} className="max-h-[78%] max-w-[72%] rounded-lg object-contain shadow-soft" />
        ) : (
          <span style={{ fontSize: size * 0.34 }}>{folder.emoji}</span>
        )}
      </div>
    </div>
  )
}
