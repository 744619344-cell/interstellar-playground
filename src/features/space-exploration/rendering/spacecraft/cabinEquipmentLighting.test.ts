import test from 'node:test'
import assert from 'node:assert/strict'
import { Group, PointLight, DirectionalLight } from 'three'
import { ShipReviewLighting } from './shipVisibility'

test('equipment lighting changes actual existing cabin lamps and restores without changing the external sun or adding lamps', () => {
  const model = new Group(); model.userData.microgravityCandidate = true
  const lighting = new ShipReviewLighting([model]), lamps: PointLight[] = [], suns: DirectionalLight[] = []
  lighting.root.traverse(o => { if (o instanceof PointLight) lamps.push(o); if (o instanceof DirectionalLight && o.name !== 'CabinCeilingKey') suns.push(o) })
  try {
    lighting.apply('cockpit'); const normal = lamps.map(l => l.intensity), daylight = suns.map(l => l.intensity), count = lighting.root.children.length
    lighting.apply('cockpit', 'rest'); assert(lamps.every((l, i) => l.intensity > 0 && l.intensity < normal[i] / 2))
    assert.deepEqual(suns.map(l => l.intensity), daylight); assert.equal(lighting.root.children.length, count)
    lighting.apply('cockpit', 'normal'); assert.deepEqual(lamps.map(l => l.intensity), normal)
  } finally { lighting.dispose() }
})
