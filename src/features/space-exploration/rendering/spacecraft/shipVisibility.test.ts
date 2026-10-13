import test from 'node:test'
import assert from 'node:assert/strict'
import { BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial, Texture } from 'three'
import { interiorZone, partitionInterior } from './shipInteriorPartition'
import { ShipReviewLighting, ShipVisibility } from './shipVisibility'

function geometry() {
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute([0, 0, -4, 1, 0, -4, 0, 1, -4,
    0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 6, 1, 0, 6, 0, 1, 6,
    0, 0, -4, 1, 0, 0, 0, 1, 6], 3))
  g.setAttribute('uv', new Float32BufferAttribute(Array(24).fill(.5), 2))
  return g
}
test('partition preserves all faces and UV values; crossing faces remain shared', () => {
  const original = geometry(), parts = partitionInterior(original, new Matrix4())
  assert.deepEqual(parts.map(p => p.zone), ['cockpit', 'cabin', 'airlock', 'shared'])
  assert.equal(parts.reduce((n, p) => n + p.geometry.index!.count, 0), 12)
  for (const { geometry: g } of parts) {
    assert.equal(g.getAttribute('uv').getX(0), .5); assert.equal(g.index!.count, 3); g.dispose()
  }
  assert.equal(original.getAttribute('position').count, 12); original.dispose()
})
test('local transform controls partition rather than assuming identity mesh transforms', () => {
  assert.equal(interiorZone(4.66), 'shared')
  assert.equal(interiorZone(-2.8), 'shared')
  const original = geometry(), parts = partitionInterior(original, new Matrix4().makeTranslation(0, 0, 20))
  assert.equal(parts.length, 1); assert.equal(parts[0].zone, 'airlock')
  parts[0].geometry.dispose(); original.dispose()
})
test('closed exterior hides cabin; open door reveals it; disposal restores originals once', () => {
  const model = new Group(), material = new MeshStandardMaterial(), original = new Mesh(geometry(), material)
  original.name = 'Furniture_Atlas'; model.add(original)
  const controller = new ShipVisibility(model)
  controller.apply({ view: 'exterior', outerOpen: false, innerOpen: false })
  assert.equal(controller.snapshot().triangles, 0)
  controller.apply({ view: 'exterior', outerOpen: true, innerOpen: false })
  assert.equal(controller.snapshot().triangles, 4)
  controller.apply({ view: 'cockpit', outerOpen: false, innerOpen: false })
  assert.equal(controller.snapshot().triangles, 2)
  controller.apply({ view: 'cockpit', outerOpen: false, innerOpen: true })
  assert.equal(controller.snapshot().triangles, 4)
  controller.dispose(); controller.dispose()
  assert.deepEqual(model.children, [original]); assert.equal(original.visible, true)
  original.geometry.dispose(); material.dispose()
})
test('review lighting restores caller materials and never disposes shared textures', () => {
  const model = new Group(), material = new MeshStandardMaterial(), mesh = new Mesh(geometry(), material)
  const texture = new Texture(); let disposed = false
  texture.addEventListener('dispose', () => { disposed = true }); material.map = texture
  model.add(mesh); const lighting = new ShipReviewLighting([model])
  assert.notEqual(mesh.material, material)
  lighting.apply('cockpit'); assert.equal(mesh.material.envMapIntensity, .25)
  assert.equal(material.envMapIntensity, 1)
  assert.equal(mesh.material.map, texture)
  lighting.dispose(); lighting.dispose(); assert.equal(mesh.material, material)
  assert.equal(disposed, false); mesh.geometry.dispose(); material.dispose(); texture.dispose()
})

test('shared fixture material cannot overwrite the window reveal coating and all variants restore on exit', () => {
  const model=new Group(), adapted=new Group();adapted.name='Ship_Adapted';model.add(adapted)
  const material=new MeshStandardMaterial({color:0xbebbae,metalness:.7,roughness:.4})
  const reveal=new Mesh(geometry(),material),fixture=new Mesh(geometry(),material)
  reveal.userData.module='window-liner';fixture.userData.module='mounting-fixture';adapted.add(reveal,fixture)
  const lighting=new ShipReviewLighting([model]);lighting.apply('cockpit')
  assert.notEqual(reveal.material,fixture.material)
  assert.equal(reveal.material.color.r,.68);assert.equal(fixture.material.color.r,material.color.r)
  assert.equal(reveal.material.metalness,.08);assert.equal(fixture.material.metalness,.45)
  lighting.apply('exterior');assert(reveal.material.color.equals(material.color));assert.equal(reveal.material.metalness,.7)
  lighting.dispose();assert.equal(reveal.material,material);assert.equal(fixture.material,material)
  reveal.geometry.dispose();fixture.geometry.dispose();material.dispose()
})
