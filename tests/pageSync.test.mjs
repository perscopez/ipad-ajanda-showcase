import test from "node:test"
import assert from "node:assert/strict"
import { stampPage, mergePage } from "../lib/pageSync.ts"

const stroke = x => ({tool:"pen", color:"black", size:1, pts:[x,0,1]})
const initial = {id:"p", template:"blank", strokes:[stroke(0)], items:[]}
test("two offline devices retain both drawings on a legacy page", () => {
  const a = stampPage(initial, {...initial, strokes:[...initial.strokes,stroke(1)]}, 1)
  const b = stampPage(initial, {...initial, strokes:[...initial.strokes,stroke(2)]}, 2)
  const merged = mergePage(a,b)
  assert.deepEqual(merged.strokes.map(s => s.pts[0]).sort(), [0,1,2])
  assert.deepEqual(mergePage(merged,b), merged)
})
test("erased ink stays erased while another device adds a textbox", () => {
  const a = stampPage(initial,{...initial,strokes:[]},1)
  const b = stampPage(initial,{...initial,items:[{id:"note",text:"hello"}]},2)
  const merged = mergePage(a,b)
  assert.deepEqual(merged.strokes,[])
  assert.equal(merged.items[0].text,"hello")
})
