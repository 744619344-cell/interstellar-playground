import test from 'node:test'
import assert from 'node:assert/strict'
import { Group } from 'three'
import { loadShipMaster } from './shipMasterLoader'

const master = () => {
  const scene = new Group(), root = new Group(); root.name = 'Ship_Adapted'
  root.userData.masterInterior = true; scene.add(root); return { scene, animations: [] }
}

test('unified master requests one self-contained asset without legacy repairs', async () => {
  const signal = new AbortController().signal, urls: string[] = [], asset = master()
  const loaded = await loadShipMaster(signal, () => assert.fail('loaded master released'), async (url, supplied) => {
    assert.equal(supplied, signal); urls.push(url); return asset
  })
  assert.equal(loaded, asset); assert.equal(urls.length, 1)
  assert.match(urls[0], /spacecraft-master-lod0\.glb/); assert.equal(loaded.scene.userData.masterInterior, true)
})

test('cancellation during parsing releases the late master exactly once', async () => {
  const aborter = new AbortController(), asset = master(); let releases = 0
  await assert.rejects(loadShipMaster(aborter.signal, scene => { assert.equal(scene, asset.scene); releases++ },
    async () => { aborter.abort(); return asset }), { name: 'AbortError' })
  assert.equal(releases, 1)
})

test('an unmarked legacy assembly is rejected and released rather than fitted', async () => {
  const asset = { scene: new Group(), animations: [] }; let releases = 0
  await assert.rejects(loadShipMaster(new AbortController().signal, () => releases++, async () => asset), /master metadata/)
  assert.equal(releases, 1)
})
