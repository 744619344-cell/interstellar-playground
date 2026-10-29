import assert from 'node:assert/strict'
import test from 'node:test'
import { overviewPose, cameraEye } from '../../domain/cameraModel'
import { projectPoint } from '../../domain/projection'
import { bodyPositionsAt } from '../../domain/orbitMotion'
import { shipBerthPosition } from '../../domain/shipBerth'
import { add3, normalize3, scale3, sub3 } from '../../domain/vec3'
import { SHIP_PROTECTION } from '../../domain/shipNavigation'
import { hitSystemShip, projectSystemShip } from './systemMapShip'
import { SHIP_MODEL_ASSETS } from '../spacecraft/shipModelAssets'

const viewport = { width: 1280, height: 720 }, pose = overviewPose(viewport)
const source = (position: { x: number; y: number; z: number }, status = 'ready') => ({
  worldPosition: position, model: { status }, suspended: false, parked: true
}) as any

test('the map projection comes from the model world position, including user pan and zoom', () => {
  const point = shipBerthPosition(bodyPositionsAt(0).get('earth')!)
  const snapshot = projectSystemShip(source(point), pose, viewport, 0)!
  assert.deepEqual(snapshot.projected, projectPoint(point, pose, viewport, SHIP_PROTECTION.radius))
  const moved = { ...pose, distance: pose.distance * .8, target: { x: 4, y: 3, z: 2 } }
  assert.deepEqual(projectSystemShip(source(point), moved, viewport, 0)!.projected,
    projectPoint(point, moved, viewport, SHIP_PROTECTION.radius))
  assert.equal(projectSystemShip(undefined, pose, viewport, 0), undefined)
})

test('a model behind a planet cannot expose a floating label or pick target', () => {
  const earth = bodyPositionsAt(0).get('earth')!, eye = cameraEye(pose)
  const behind = add3(earth, scale3(normalize3(sub3(earth, eye)), 25))
  const snapshot = projectSystemShip(source(behind), pose, viewport, 0)!
  assert.equal(snapshot.projected.visible, false)
  assert.equal(hitSystemShip(snapshot, snapshot.projected.x, snapshot.projected.y), false)
})

test('ready models and explicit hull previews can be picked; empty loading, failure and suspension cannot', () => {
  const point = shipBerthPosition(bodyPositionsAt(0).get('earth')!)
  const ready = projectSystemShip(source(point), pose, viewport, 0)!, { x, y, radius } = ready.projected
  assert.equal(hitSystemShip(ready, x, y), true)
  assert.equal(hitSystemShip(ready, x + radius + 30, y), false)
  for (const status of ['loading', 'failed']) assert.equal(hitSystemShip({ ...ready, status } as any, x, y), false)
  assert.equal(hitSystemShip({ ...ready, status: 'loading', previewReady: true }, x, y), true)
  assert.equal(hitSystemShip({ ...ready, status: 'failed', previewReady: true }, x, y), false)
  assert.equal(hitSystemShip({ ...ready, status: 'loading', previewReady: true, suspended: true }, x, y), false)
  assert.equal(hitSystemShip({ ...ready, suspended: true }, x, y), false)
})

test('near and distant current skins share the exact latest local hull, with the old master preserved', () => {
  assert.match(SHIP_MODEL_ASSETS.assembly, /\/assets\/models\/current-ship-20261022\/hull-g12\.glb$/)
  assert.equal(SHIP_MODEL_ASSETS.exterior, SHIP_MODEL_ASSETS.assembly)
  assert.match(SHIP_MODEL_ASSETS.legacyAssembly, /\/assets\/models\/spacecraft-master-lod0\.glb$/)
  assert.ok(Object.isFrozen(SHIP_MODEL_ASSETS))
})
