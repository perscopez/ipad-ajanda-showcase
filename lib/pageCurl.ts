/**
 * Gerçekçi sayfa çevirme: kağıt dik şeritlere bölünür, her şerit eğrilmiş bir yüzeyin
 * 3B konumuna taşınır, ancak sayfa büyümesin diye perspektif ölçeği uygulanmaz.
 * Arka yüzü, parlaklığı ve altındaki sayfaya düşen gölgesi vardır.
 * t: 0..1 ilerleme, dir: 1 ileri (sol sırttan sağa doğru kalkar), -1 geri.
 */
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function drawCurl(ctx: CanvasRenderingContext2D, img: HTMLImageElement, t: number, dir: 1 | -1, Wr: number, Hr: number, padY: number, linear = false) {
  const { naturalWidth, naturalHeight } = img
  if (!naturalWidth || !naturalHeight || t >= 1) return
  if (t === 0) {
    ctx.drawImage(img, 0, 0, naturalWidth, naturalHeight, dir > 0 ? Wr : 0, padY, Wr, Hr)
    return
  }

  const s = dir > 0 ? 1 : -1
  const hx = Wr // sırt her iki yönde de tuvalin ortasında
  const theta = (linear ? t : ease(t)) * Math.PI
  const bend = Math.sin(Math.PI * Math.min(1, t * 1.04)) * 0.7
  const N = 96
  const du = Wr / N
  const fade = t > 0.82 ? Math.max(0, 1 - (t - 0.82) / 0.18) : 1

  type P = { x: number; z: number }
  const pts: P[] = [{ x: 0, z: 0 }]
  for (let i = 0; i < N; i++) {
    const a = Math.min(Math.PI, theta + bend * ((i + 0.5) / N))
    pts.push({ x: pts[i].x + Math.cos(a) * du, z: pts[i].z + Math.sin(a) * du })
  }
  type It = { i: number; dx0: number; dx1: number; a: number; zm: number }
  const items: It[] = []
  for (let i = 0; i < N; i++) {
    const p0 = pts[i], p1 = pts[i + 1]
    items.push({
      i,
      dx0: hx + s * p0.x,
      dx1: hx + s * p1.x,
      a: Math.min(Math.PI, theta + bend * ((i + 0.5) / N)),
      zm: (p0.z + p1.z) / 2,
    })
  }

  ctx.save()
  ctx.globalAlpha = fade

  // 1) altındaki sayfaya düşen gölge
  const free = items[N - 1]
  const edge = (free.dx1 - hx) * s // sırttan serbest uca olan yatay uzaklık (sayfa yönünde)
  const strength = 0.34 * Math.sin(theta) * (1 - 0.45 * t)
  if (edge > -Wr * 0.05 && strength > 0.01) {
    const pe = Math.max(0, Math.min(1, edge / Wr))
    const g = ctx.createLinearGradient(hx, 0, hx + s * Wr, 0)
    g.addColorStop(0, `rgba(40,25,35,${strength * 0.55})`)
    g.addColorStop(pe, `rgba(40,25,35,${strength})`)
    g.addColorStop(Math.min(1, pe + 0.24), "rgba(40,25,35,0)")
    ctx.fillStyle = g
    ctx.fillRect(s > 0 ? hx : hx - Wr, padY, Wr, Hr)
  }

  // 2) şeritleri uzaktan yakına çiz
  items.sort((p, q) => p.zm - q.zm)
  for (const it of items) {
    const dl = Math.min(it.dx0, it.dx1)
    const dwx = Math.abs(it.dx1 - it.dx0)
    const dw = Math.min(2 * Wr - dl, dwx + 0.8) // komşu şeritlerin arasında boşluk bırakma
    if (dw <= 0) continue
    // Kaynak görselin pikselleri ile hedef tuvalin CSS pikselleri aynı ölçekte olmayabilir.
    const srcIndex = s > 0 ? it.i : N - 1 - it.i
    const srcX = (srcIndex * naturalWidth) / N
    const srcW = ((srcIndex + 1) * naturalWidth) / N - srcX
    const front = Math.cos(it.a) >= 0
    if (front) {
      ctx.drawImage(img, srcX, 0, srcW, naturalHeight, dl, padY, dw, Hr)
      const dark = 0.34 * (1 - Math.cos(it.a))
      if (dark > 0.005) {
        ctx.fillStyle = `rgba(30,18,28,${dark})`
        ctx.fillRect(dl, padY, dw, Hr)
      }
    } else {
      // arka yüz: krem kağıt + yarı saydam ters görüntü (kağıdın arkasından görünen yazı)
      ctx.fillStyle = "#f1eadc"
      ctx.fillRect(dl, padY, dw, Hr)
      ctx.save()
      ctx.globalAlpha = fade * 0.1
      ctx.translate(dl + dw / 2, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(img, srcX, 0, srcW, naturalHeight, -dw / 2, padY, dw, Hr)
      ctx.restore()
      const dark = 0.22 * (1 + Math.cos(it.a))
      ctx.fillStyle = `rgba(30,18,28,${dark})`
      ctx.fillRect(dl, padY, dw, Hr)
    }
  }

  // 3) kıvrımın en parlak yeri (ışığın vurduğu bölge) ve serbest kenarın ince çizgisi
  const crest = items.reduce((best, it) => (Math.abs(it.a - Math.PI / 2) < Math.abs(best.a - Math.PI / 2) ? it : best), items[0])
  if (theta > 0.1 && theta < Math.PI - 0.1) {
    const cx = (crest.dx0 + crest.dx1) / 2
    const g2 = ctx.createLinearGradient(cx - 18, 0, cx + 18, 0)
    g2.addColorStop(0, "rgba(255,255,255,0)")
    g2.addColorStop(0.5, `rgba(255,255,255,${0.22 * Math.sin(theta)})`)
    g2.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = g2
    ctx.fillRect(cx - 18, padY, 36, Hr)
  }
  ctx.restore()
}
