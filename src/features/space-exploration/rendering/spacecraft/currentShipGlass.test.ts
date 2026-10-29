import test from 'node:test'
import assert from 'node:assert/strict'
import { Group, Mesh, BufferGeometry, MeshPhysicalMaterial, MeshStandardMaterial } from 'three'
import { ShipReviewLighting } from './shipVisibility'

test('current glass stays physically transmitting in both views without alpha or a solid studio reflection', () => {
  const scene = new Group(); scene.userData.currentFittedAssembly = true
  const glass = new MeshPhysicalMaterial({ transmission: 1, ior: 1.48, thickness: .02, roughness: .065 })
  const hull = new MeshStandardMaterial({ roughness: .64 })
  const pane = new Mesh(new BufferGeometry(), glass), skin = new Mesh(new BufferGeometry(), hull)
  scene.add(pane, skin)
  const lighting = new ShipReviewLighting([scene])
  for (const view of ['cockpit', 'exterior'] as const) {
    lighting.apply(view)
    const tuned = pane.material as MeshPhysicalMaterial
    assert.equal(tuned.transmission, 1); assert.equal(tuned.opacity, 1)
    assert.equal(tuned.ior, 1.48); assert.equal(tuned.thickness, .02)
    assert.equal(tuned.envMapIntensity, .12); assert.equal(tuned.specularIntensity, .35)
    assert(tuned.roughness <= .035); assert.equal(skin.material.roughness, .64)
  }
  lighting.dispose(); assert.equal(pane.material, glass)
  assert.equal(glass.envMapIntensity, 1); assert.equal(glass.roughness, .065)
  pane.geometry.dispose(); skin.geometry.dispose(); glass.dispose(); hull.dispose()
})
