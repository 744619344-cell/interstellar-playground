import test from 'node:test'
import assert from 'node:assert/strict'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three'
import { ShipReviewLighting } from './shipVisibility'

test('shared paint, fabric and metal textures retain detail and emission with independent finishes and restoration', () => {
  const model = new Group(), adapted = new Group(); adapted.name = 'Ship_Adapted'; model.add(adapted)
  const material = new MeshStandardMaterial({ color: 0xddd8c8, metalness: .9, roughness: .2, emissive: 0x005577, emissiveIntensity: .4 })
  material.name = 'seat_top'
  const texture = new Texture(); material.map = texture; material.roughnessMap = texture; material.emissiveMap = texture
  let textureDisposals = 0; texture.addEventListener('dispose', () => textureDisposals++)
  const meshes = ['seat', 'dual-suit-locker', 'airlock-door-frame', 'main-console'].map(module => {
    const mesh = new Mesh(new BoxGeometry(), material); mesh.userData.module = module; adapted.add(mesh); return mesh
  })
  const lighting = new ShipReviewLighting([model])
  lighting.apply('cabin')
  assert.deepEqual(meshes.map(o => (o.material as MeshStandardMaterial).metalness), [.02, .18, .45, .9])
  assert.deepEqual(meshes.map(o => (o.material as MeshStandardMaterial).roughness), [.9, .7, .6, .2])
  assert.equal(new Set(meshes.map(o => o.material)).size, 4)
  for (const mesh of meshes) {
    const finish = mesh.material as MeshStandardMaterial
    assert(finish.color.equals(material.color)); assert(finish.emissive.equals(material.emissive))
    assert.equal(finish.emissiveIntensity, .4); assert.equal(finish.map, texture); assert.equal(finish.emissiveMap, texture)
  }
  lighting.apply('exterior'); lighting.apply('cutaway')
  for (const mesh of meshes) { assert.equal((mesh.material as MeshStandardMaterial).metalness, .9); assert.equal((mesh.material as MeshStandardMaterial).roughness, .2) }
  let disposed = 0; for (const mesh of meshes) (mesh.material as MeshStandardMaterial).addEventListener('dispose', () => disposed++)
  lighting.dispose(); lighting.dispose(); assert.equal(disposed, 4); assert.equal(textureDisposals, 0)
  assert(meshes.every(o => o.material === material)); assert.equal(material.metalness, .9)
  meshes.forEach(o => o.geometry.dispose()); material.dispose(); texture.dispose()
})
