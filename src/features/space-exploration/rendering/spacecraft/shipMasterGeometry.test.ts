import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { Box3, Vector3 } from 'three'
import { insideMasterCabin, insideMasterInnerSweep, masterRoofHeight, type ShipCabinVolume } from './shipCabinVolume'
import { ShipCabinCamera } from './shipCabinCamera'
import { ShipViewCamera } from './shipViewCamera'
const output = new URL('../../../../../output/hunyuan-adaptation/master-design-20261009/', import.meta.url)
const json = async (file: string) => JSON.parse(await fs.readFile(new URL(file, output), 'utf8'))
const volume: ShipCabinVolume = { floor: -1.58, halfWidth: 1.74, front: -5.9, tail: 7.12, habitatEnd: 4.94,
  aperture: { halfWidth: .8, bottom: -1.51, top: .79, bevel: .22 } }

test('frozen master passes independent exported-geometry and fit gates', async () => {
  const structure = await json('v6-structure-检查.json'), hull = await json('v6-hull-检查.json'), sweep = await json('v6-sweep-检查.json')
  const manifest = await json('装配清单-v6.json'), split = await json('模块装配坐标-v6.json'), berths = await json('v6-berths-检查.json')
  assert.equal(structure.sha256, manifest.sha256); assert.equal(hull.sha256, manifest.sha256); assert.equal(sweep.sha256, manifest.sha256)
  assert.equal(structure.integrity.degenerateFaces, 0); assert.equal(structure.integrity.opposedNormals, 0)
  assert.equal(structure.enclosure.leaks.length, 0); assert.equal(structure.interfaces.maxPositionErrorMeters, 0)
  assert.equal(hull.hull.contacts, 0); assert(sweep.mechanisms.sampledSweepPass); assert.equal(sweep.mechanisms.rows.length, 16)
  assert.equal(berths.sha256, manifest.sha256); assert(berths.mechanisms.sampledSweepPass); assert.equal(berths.mechanisms.rows.length, 16)
  assert.equal(split.modules.length, 25); assert(split.maxReassemblyErrorMeters < 1e-6)
  assert(manifest.interiorTriangles < 160000); assert(manifest.bytes < 18000000)
  const product = await fs.readFile(new URL('../../../../assets/models/spacecraft-master-lod0.glb', import.meta.url))
  const doc = JSON.parse(product.subarray(20, 20 + product.readUInt32LE(12)).toString())
  assert(doc.nodes.some((n: { name: string; extras?: { masterInterior?: boolean } }) => n.name === 'Ship_Adapted' && n.extras?.masterInterior))
  assert.equal(doc.animations.length, 9)
})

test('master observer is bounded by sloped roof, octagonal gate and outer leaf', () => {
  for (const z of [-5.9, -2.8, -2.6, -2.35, 4.94, 7.12]) assert(Number.isFinite(masterRoofHeight(z)))
  assert(insideMasterCabin(new Vector3(0, -.18, 4.94), volume, .12, true))
  assert(!insideMasterCabin(new Vector3(0, -.18, 4.94), volume, .12, false))
  assert(!insideMasterCabin(new Vector3(.67, .64, 4.94), volume, .12, true))
  assert(!insideMasterCabin(new Vector3(0, -.18, 7), volume, .12, true))
  assert(insideMasterInnerSweep({ x: 0, y: -.18, z: 5.7 }, volume))
  assert(!insideMasterInnerSweep({ x: 0, y: -.18, z: 6.85 }, volume))
  const camera = new ShipCabinCamera(); camera.setSeat({ x: 0, y: -.05, z: -2.6 }); camera.setVolume(volume)
  for (let i = 0; i < 12; i++) camera.move(-1, 0, 0, 0, false)
  assert(camera.snapshot().z < 4.94); assert(camera.blocked)
  camera.move(-1, 0, 0, 0, true); assert(camera.snapshot().z > 5.25)
})

test('inspection starts in the aisle instead of trapping its eye in the seat collider', () => {
  const ship = { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } }
  const rig = new ShipViewCamera(ship), eye = { x: -.65, y: -.18, z: -3.84 }, standing = { x: 0, y: -.05, z: -2.6 }
  rig.setSeat(eye, -.13, standing); rig.setCabinVolume(volume)
  rig.setCabinObstacles([new Box3(new Vector3(-1, -.9, -4.3), new Vector3(-.3, .3, -3.3))]); rig.setMode('cabin')
  rig.moveCabin(-.8, 0, 0, false); assert(rig.snapshot().cabinPosition.z > standing.z + .7)
  const before = rig.snapshot().cabinPosition; rig.setSeat(eye, -.13, standing)
  assert.deepEqual(rig.snapshot().cabinPosition, before)
  rig.zoom(-10); assert.equal(rig.snapshot().interiorFov, 45)
})
