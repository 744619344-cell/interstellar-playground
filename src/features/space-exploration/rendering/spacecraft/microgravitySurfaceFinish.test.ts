import test from 'node:test'
import assert from 'node:assert/strict'
import { Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Texture, WebGLRenderTarget } from 'three'
import { ShipReviewLighting } from './shipVisibility'
import { MicrogravitySurfaceFinish, microgravitySurface, useRefinedCabin } from './microgravitySurfaceFinish'

test('source coating, mixed equipment and Rocketbox skin/fabric receive independent surface profiles', () => {
  const wall = new Group(); wall.userData.microgravityModule = 'liner-v2'
  const mesh = new Mesh(); wall.add(mesh); const m = new MeshPhysicalMaterial(); m.name = 'Material.001'
  assert.equal(microgravitySurface(mesh, m), 'paint')
  wall.userData.microgravityModule = 'locker-v1'; assert.equal(microgravitySurface(mesh, m), 'equipment')
  m.name = 'f154_body'; assert.equal(microgravitySurface(mesh, m), 'fabric')
  m.name = 'f154_head'; assert.equal(microgravitySurface(mesh, m), 'skin')
  m.transmission = 1; assert.equal(microgravitySurface(mesh, m), 'original')
  assert(useRefinedCabin('')); assert(!useRefinedCabin('?surface=source')); m.dispose(); mesh.geometry.dispose()
})

test('corrects out-of-range highlights, preserves physical glass and restores material/shadow ownership', () => {
  const model = new Group(), part = new Group(); model.userData.microgravityCandidate = true; part.userData.microgravityModule = 'liner-v2'; model.add(part)
  const original = new MeshPhysicalMaterial({ roughness: 1, metalness: 1 }); original.specularColor.setRGB(2, 2, 2)
  const texture = new Texture(); original.map = texture; original.roughnessMap = original.metalnessMap = texture
  const mesh = new Mesh(undefined, original); part.add(mesh)
  const lighting = new ShipReviewLighting([model]), copy = mesh.material
  lighting.apply('cockpit'); assert(copy !== original); assert(copy.specularColor.r <= 1)
  assert(copy.roughness >= .55); assert(copy.metalness <= .09); assert(!mesh.castShadow && mesh.receiveShadow)
  const crew = new Mesh(undefined, original); crew.userData.currentShipPart = 'crew'; model.add(crew)
  const crewLighting = new ShipReviewLighting([model]); assert(crew.castShadow && crew.receiveShadow)
  crewLighting.dispose(); model.remove(crew); crew.geometry.dispose()
  let disposed = 0; const key = lighting.root.getObjectByName('CabinCeilingKey') as import('three').DirectionalLight
  const normalKey = key.intensity; lighting.apply('cockpit', 'rest'); assert(key.intensity < normalKey / 2)
  lighting.apply('exterior'); assert(!key.visible); lighting.apply('cockpit'); assert(key.visible && key.intensity === normalKey)
  key.shadow.map = new WebGLRenderTarget(2, 2); key.shadow.map.addEventListener('dispose', () => disposed++)
  lighting.dispose(); lighting.dispose(); assert.equal(disposed, 1); assert.equal(mesh.material, original)
  assert(!mesh.castShadow && !mesh.receiveShadow); assert.equal(original.specularColor.r, 2); assert.equal(original.map, texture)
  const finish = new MicrogravitySurfaceFinish(), glass = new MeshPhysicalMaterial({ transmission: 1, opacity: .2, thickness: .03, roughness: .035 })
  finish.apply(glass, 'paint'); assert.equal(glass.transmission, 1); assert.equal(glass.thickness, .03); assert.equal(glass.roughness, .035)
  finish.dispose(); mesh.geometry.dispose(); original.dispose(); texture.dispose(); glass.dispose()
})
