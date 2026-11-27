export type SlicedSticker = { src: string; w: number; h: number }

/**
 * Bir sticker sayfasını (beyaz zeminde birçok kesik harf/sticker) tek tek şeffaf PNG'lere ayırır.
 * Zemin beyaz kabul edilir; birbirine değmeyen her parça ayrı bir sticker olur.
 */
export async function sliceSheet(file: Blob, onProgress?: (p: number) => void): Promise<SlicedSticker[]> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const k = Math.min(1, 2200 / Math.max(img.naturalWidth, img.naturalHeight))
    const W = Math.round(img.naturalWidth * k), H = Math.round(img.naturalHeight * k)
    const c = document.createElement("canvas")
    c.width = W
    c.height = H
    const ctx = c.getContext("2d", { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0, W, H)
    const px = ctx.getImageData(0, 0, W, H).data
    const N = W * H

    // 1) ön plan maskesi: beyaz olmayan her şey
    const fg = new Uint8Array(N)
    for (let i = 0; i < N; i++) {
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], a = px[i * 4 + 3]
      fg[i] = a > 40 && !(r > 238 && g > 238 && b > 238) ? 1 : 0
    }

    // 2) küçük boşlukları kapatmak için genişlet (parça içindeki ince çatlaklar bölünmesin)
    const R = Math.max(2, Math.round(Math.min(W, H) / 450))
    const dil = morph(fg, W, H, R, true)
    onProgress?.(0.25)

    // 3) bağlı bileşenleri bul (8 komşuluk)
    const lab = new Int32Array(N)
    const stack = new Int32Array(N)
    type Box = { x0: number; y0: number; x1: number; y1: number; n: number }
    const boxes: Box[] = [{ x0: 0, y0: 0, x1: 0, y1: 0, n: 0 }]
    let L = 0
    for (let s = 0; s < N; s++) {
      if (!dil[s] || lab[s]) continue
      L++
      const bx: Box = { x0: W, y0: H, x1: 0, y1: 0, n: 0 }
      let sp = 0
      stack[sp++] = s
      lab[s] = L
      while (sp) {
        const p = stack[--sp]
        const x = p % W, y = (p / W) | 0
        bx.n++
        if (x < bx.x0) bx.x0 = x
        if (x > bx.x1) bx.x1 = x
        if (y < bx.y0) bx.y0 = y
        if (y > bx.y1) bx.y1 = y
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy
          if (ny < 0 || ny >= H) continue
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            if (nx < 0 || nx >= W) continue
            const q = ny * W + nx
            if (dil[q] && !lab[q]) {
              lab[q] = L
              stack[sp++] = q
            }
          }
        }
      }
      boxes.push(bx)
    }
    onProgress?.(0.55)

    // 4) gürültüyü ve dev parçaları ele
    const minArea = Math.max(80, N * 0.00008)
    const keep: number[] = []
    for (let l = 1; l <= L; l++) {
      const b = boxes[l]
      const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1
      if (b.n < minArea || bw < 10 || bh < 10) continue
      if (bw * bh > N * 0.3) continue
      keep.push(l)
    }

    // 5) okuma sırası: önce satırlar, sonra soldan sağa
    const hs = keep.map((l) => boxes[l].y1 - boxes[l].y0 + 1).sort((a, b) => a - b)
    const medH = hs[(hs.length / 2) | 0] || 20
    const byY = keep.slice().sort((a, b) => (boxes[a].y0 + boxes[a].y1) / 2 - (boxes[b].y0 + boxes[b].y1) / 2)
    const rows: number[][] = []
    let rowY = -1e9
    for (const l of byY) {
      const cy = (boxes[l].y0 + boxes[l].y1) / 2
      if (!rows.length || cy - rowY > medH * 0.6) {
        rows.push([l])
        rowY = cy
      } else {
        rows[rows.length - 1].push(l)
        rowY = rows[rows.length - 1].reduce((s, q) => s + (boxes[q].y0 + boxes[q].y1) / 2, 0) / rows[rows.length - 1].length
      }
    }
    const ordered = rows.flatMap((r) => r.sort((a, b) => boxes[a].x0 - boxes[b].x0))

    // 6) her parçayı kırp: genişletilmiş maskenin içinde kalan (kapatılmış) pikseller opak
    const closed = morph(dil, W, H, R, false)
    const out: SlicedSticker[] = []
    const pad = 2
    for (let oi = 0; oi < ordered.length; oi++) {
      const l = ordered[oi]
      const b = boxes[l]
      const bw = b.x1 - b.x0 + 1 + pad * 2, bh = b.y1 - b.y0 + 1 + pad * 2
      const cc = document.createElement("canvas")
      cc.width = bw
      cc.height = bh
      const cx = cc.getContext("2d", { willReadFrequently: true })!
      const id = cx.createImageData(bw, bh)
      const alpha = new Uint8Array(bw * bh)
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const sx = b.x0 - pad + x, sy = b.y0 - pad + y
          if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue
          const si = sy * W + sx
          if (lab[si] === l && closed[si]) {
            const di = (y * bw + x) * 4
            id.data[di] = px[si * 4]
            id.data[di + 1] = px[si * 4 + 1]
            id.data[di + 2] = px[si * 4 + 2]
            alpha[y * bw + x] = 255
          }
        }
      }
      // kenarları hafif yumuşat (3x3 alfa bulanıklığı)
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          let sum = 0, cnt = 0
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy
            if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue
            sum += alpha[ny * bw + nx]
            cnt++
          }
          id.data[(y * bw + x) * 4 + 3] = Math.round(sum / cnt)
        }
      }
      cx.putImageData(id, 0, 0)
      // saklama boyutunu sınırla
      const m = Math.max(bw, bh)
      const sc = Math.min(1, 220 / m)
      let final = cc
      if (sc < 1) {
        final = document.createElement("canvas")
        final.width = Math.max(1, Math.round(bw * sc))
        final.height = Math.max(1, Math.round(bh * sc))
        final.getContext("2d")!.drawImage(cc, 0, 0, final.width, final.height)
      }
      out.push({ src: final.toDataURL("image/png"), w: final.width, h: final.height })
      if (oi % 25 === 0) {
        onProgress?.(0.55 + 0.45 * (oi / ordered.length))
        await new Promise((r) => setTimeout(r, 0)) // arayüz donmasın
      }
    }
    onProgress?.(1)
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Kare pencereli ayrılabilir max (dilate=true) / min (dilate=false) filtresi. */
function morph(src: Uint8Array, W: number, H: number, r: number, dilate: boolean): Uint8Array {
  const tmp = new Uint8Array(W * H)
  const out = new Uint8Array(W * H)
  const hit = dilate ? 1 : 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = dilate ? 0 : 1
      for (let d = -r; d <= r; d++) {
        const nx = x + d
        const s = nx < 0 || nx >= W ? (dilate ? 0 : 1) : src[y * W + nx]
        if (s === hit) {
          v = hit
          break
        }
      }
      tmp[y * W + x] = v
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = dilate ? 0 : 1
      for (let d = -r; d <= r; d++) {
        const ny = y + d
        const s = ny < 0 || ny >= H ? (dilate ? 0 : 1) : tmp[ny * W + x]
        if (s === hit) {
          v = hit
          break
        }
      }
      out[y * W + x] = v
    }
  }
  return out
}
