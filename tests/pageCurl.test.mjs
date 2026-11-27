import assert from "node:assert/strict"
import { test } from "node:test"
import { drawCurl } from "../lib/pageCurl.ts"

const width = 887.125
const height = 616.5
const top = 74

function render(img, progress, dir, linear) {
  const strips = []
  const stack = []
  let x = 0
  let sx = 1
  const ctx = {
    drawImage(_, ...rects) {
      const left = rects[4]
      rects[4] = x + sx * (sx < 0 ? left + rects[6] : left)
      strips.push(rects)
    },
    save() { stack.push([x, sx]) },
    restore() { [x, sx] = stack.pop() },
    fillRect() {},
    translate(dx) { x += dx * sx },
    scale(dx) { sx *= dx },
    createLinearGradient() { return { addColorStop() {} } },
  }
  drawCurl(ctx, img, progress, dir, width, height, top, linear)
  return strips
}

test("the curl samples the full intrinsic bitmap at both resolutions and in either direction", () => {
  for (const img of [{ naturalWidth: 887, naturalHeight: 617 }, { naturalWidth: 1652, naturalHeight: 1148 }]) {
    for (const dir of [1, -1]) {
      for (const progress of [0, 0.2, 0.6]) {
        const source = render(img, progress, dir, false).sort(([x], [y]) => x - y)
        assert.ok(source.length > 0)
        let edge = 0
        for (const [sx, sy, sw, sh] of source) {
          assert.equal(sy, 0)
          assert.equal(sh, img.naturalHeight)
          assert.ok(Math.abs(sx - edge) < 1e-8, "slices cover the bitmap without gaps or overlap")
          assert.ok(sw > 0)
          edge = sx + sw
        }
        assert.ok(Math.abs(edge - img.naturalWidth) < 1e-8)
      }
    }
  }
})

test("button and dragged curls keep their height and don't extend outside the turning area", () => {
  const img = { naturalWidth: 1652, naturalHeight: 1148 }
  for (const linear of [false, true]) {
    for (const dir of [1, -1]) {
      for (const progress of [0, 0.15, 0.25, 0.35, 0.5, 0.65, 0.8, 0.95]) {
        const strips = render(img, progress, dir, linear)
        assert.ok(strips.length > 0)
        for (const [, , , , dx, dy, dw, dh] of strips) {
          assert.equal(dh, height)
          assert.equal(dy, top)
          assert.ok(dw > 0 && dw <= width)
          assert.ok(dx >= -1e-8 && dx + dw <= 2 * width + 1e-8)
          if (progress === 0) assert.ok(dx >= (dir > 0 ? width : 0) && dx + dw <= (dir > 0 ? 2 * width : width) + 1e-8)
        }
      }
    }
  }
})

test("the settled curl no longer paints over the next page", () => {
  assert.deepEqual(render({ naturalWidth: 1652, naturalHeight: 1148 }, 1, 1, false), [])
})
