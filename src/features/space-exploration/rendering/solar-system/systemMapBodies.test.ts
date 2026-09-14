import assert from 'node:assert/strict'
import test from 'node:test'
import { Mesh, MeshBasicMaterial, MeshStandardMaterial, RingGeometry, SphereGeometry, Texture } from 'three'
import { visualScale } from '../../domain/visualScale'
import { bodyPositionsAt } from '../../domain/orbitMotion'
import { SYSTEM_BODIES } from '../../domain/registry'
import type { VoyageTextureSet } from '../voyagePublicTypes'
import { createSystemContent, setBodyLod, type BodyVisual } from './systemMapBodies'

const textures = {
  surface: {
    sun: 'sun', mercury: 'mercury', venus: 'venus', earth: 'earth', moon: 'moon',
    mars: 'mars', jupiter: 'jupiter', saturn: 'saturn', uranus: 'uranus', neptune: 'neptune'
  },
  earthNight: 'night', earthClouds: 'clouds', saturnRing: 'ring', milkyWay: 'sky'
} as VoyageTextureSet

test('leaving earth lod1 disposes its night texture before clearing the material', () => {
  const lod2 = new SphereGeometry(2.4, 8, 6)
  const lod1 = new SphereGeometry(2.4, 12, 8)
  const material = new MeshStandardMaterial()
  const night = new Texture()
  let disposed = 0
  night.dispose = () => { disposed += 1 }
  material.emissiveMap = night
  material.emissiveIntensity = 0.8
  const versionBeforeCleanup = material.version
  const visual: BodyVisual = {
    id: 'earth',
    group: null as any,
    mesh: new Mesh(lod1, material),
    lod2Geometry: lod2,
    lod1Geometry: lod1,
    extras: []
  }

  setBodyLod(visual, 'lod2', {} as VoyageTextureSet, null as any, () => false)

  assert.equal(disposed, 1)
  assert.equal(material.emissiveMap, null)
  assert.equal(material.emissiveIntensity, 0)
  assert.ok(material.version > versionBeforeCleanup)
  assert.equal(visual.mesh.geometry, lod2)
})

test('overview saturn ring is attached to the moving body group and stays readable', () => {
  const content = createSystemContent(
    textures,
    { load() {} } as any,
    { isWorldCurrent: () => true } as any
  )
  const saturn = content.bodies.get('saturn')!
  const ring = saturn.extras.find((extra) => extra.name === 'saturn-ring')!
  const geometry = ring.geometry as RingGeometry
  const material = ring.material as MeshBasicMaterial

  assert.equal(ring.parent, saturn.group)
  assert.equal(ring.userData.persistentOverview, true)
  assert.ok(geometry.parameters.outerRadius > visualScale('saturn').radius)
  assert.equal(material.transparent, true)
  const uv = geometry.getAttribute('uv')
  assert.ok(Math.abs(uv.getX(0)) < 1e-6)
  assert.ok(Math.abs(uv.getX(uv.count - 1) - 1) < 1e-6)
  assert.equal(uv.getY(0), 0.5)
  assert.ok(saturn.mesh.material instanceof MeshStandardMaterial)
})

test('every moving body uses the radius and plane of its rendered orbit', () => {
  const content = createSystemContent(textures, { load() {} } as any, { isWorldCurrent: () => true } as any)
  for (const seconds of [0, 12, 100, 1000]) {
    const positions = bodyPositionsAt(seconds)
    for (const body of SYSTEM_BODIES.filter((body) => body.parentId)) {
      const position = positions.get(body.id)!
      const parent = positions.get(body.parentId!)!
      const orbit = content.orbits.get(body.id)!
      const points = orbit.geometry.getAttribute('position')
      const radius = Math.hypot(position.x - parent.x, position.z - parent.z)
      assert.equal(position.y, parent.y)
      assert.deepEqual(orbit.scale.toArray(), [1, 1, 1])
      for (let i = 0; i < points.count; i += 1) {
        assert.ok(Math.abs(Math.hypot(points.getX(i), points.getZ(i)) - radius) < 0.0001, body.id)
        assert.equal(points.getY(i), 0)
      }
    }
  }
})
