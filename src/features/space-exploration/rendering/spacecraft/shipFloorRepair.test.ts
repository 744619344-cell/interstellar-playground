import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { installShipFloorRepair } from './shipFloorRepair'
import { loadShipAssembly } from './shipAssemblyLoader'
import { disposeShipModel } from './shipModelRuntime'
import { ShipVisibility } from './shipVisibility'

async function actual(filename: string) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'geometry_only_floor_test' } })
  const bytes = await readFile(new URL('../../../../assets/models/' + filename, import.meta.url))
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '')
}
function fixture() {
  const scene = new Group(), adapted = new Group(); adapted.name = 'Ship_Adapted'; scene.add(adapted)
  const floors = ['rear-cabin-floor', 'airlock-floor'].map(module => {
    const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial()); mesh.userData.module = module
    adapted.add(mesh); return mesh
  })
  return { scene, floors, animations: [] }
}

test('actual floor set preserves every source triangle and transform, remains visible and releases once', async () => {
  const main = await actual('spacecraft-redesign-lod0.glb'), repair = await actual('spacecraft-floor-repair.glb')
  const replacements: Mesh[] = []; repair.scene.traverse(o => { if (o instanceof Mesh) replacements.push(o) })
  const counts = { geometry: 0, material: 0, texture: 0 }
  for (const mesh of replacements) {
    mesh.geometry.addEventListener('dispose', () => counts.geometry++)
    const material = mesh.material as MeshStandardMaterial
    material.addEventListener('dispose', () => counts.material++)
    material.map!.addEventListener('dispose', () => counts.texture++)
    material.metalnessMap!.addEventListener('dispose', () => counts.texture++)
  }
  assert(installShipFloorRepair(main.scene, repair.scene)); assert.equal(repair.scene.children.length, 0)
  for (const mesh of replacements) {
    let original: Mesh | undefined
    main.scene.traverse(o => { if (o instanceof Mesh && o.userData.module === mesh.userData.module && o.userData.supersededByAtlas) original = o })
    assert(original); assert.deepEqual(mesh.matrix.elements, original.matrix.elements)
    assert.equal(original.visible, false)
  }
  const visibility = new ShipVisibility(main.scene)
  for (const view of ['cockpit', 'cabin', 'airlock'] as const) {
    visibility.apply({ view, innerOpen: false, outerOpen: false })
    assert(replacements.every(o => o.visible))
  }
  visibility.dispose(); disposeShipModel(repair.scene); disposeShipModel(main.scene)
  assert.deepEqual(counts, { geometry: 2, material: 2, texture: 4 })
})

test('wrong second surface or duplicate module rejects the whole set before mutating the first', () => {
  const main = fixture(), repair = fixture()
  repair.floors[1].geometry.getAttribute('normal').setX(0, NaN)
  assert.equal(installShipFloorRepair(main.scene, repair.scene), false)
  assert(main.floors.every(o => o.visible && !o.userData.supersededByAtlas))
  assert(repair.floors.every(o => o.parent === repair.scene.children[0]))
  repair.floors[1].userData.module = 'rear-cabin-floor'
  assert.equal(installShipFloorRepair(main.scene, repair.scene), false)
  disposeShipModel(main.scene); disposeShipModel(repair.scene)
})

test('floor loading failure retains installed roof and visible source floors', async () => {
  const result = await loadShipAssembly(new AbortController().signal, disposeShipModel, async url => {
    if (url.endsWith('spacecraft-floor-repair.glb')) throw Error('404')
    return actual(url.slice(url.lastIndexOf('/') + 1))
  })
  assert.equal(result.scene.userData.ceilingRepaired, true)
  assert.equal(result.scene.userData.floorRepairFailed, true)
  result.scene.traverse(o => { if (o instanceof Mesh && /^(rear-cabin|airlock)-floor$/.test(o.userData.module)) assert(o.visible) })
  disposeShipModel(result.scene)
})

test('late floor cancellation releases pending floors and transferred roof without returning ready', async () => {
  const main = await actual('spacecraft-redesign-lod0.glb'), roof = await actual('spacecraft-ceiling-repair.glb')
  const floor = await actual('spacecraft-floor-repair.glb'), aborter = new AbortController(), released: Group[] = []
  let calls = 0, roofDisposals = 0
  roof.scene.traverse(o => { if (o instanceof Mesh) o.geometry.addEventListener('dispose', () => roofDisposals++) })
  await assert.rejects(loadShipAssembly(aborter.signal, scene => { released.push(scene); disposeShipModel(scene) }, async () => {
    if (!calls++) return main
    if (calls === 2) return roof
    aborter.abort(); return floor
  }), { name: 'AbortError' })
  assert.deepEqual(released, [roof.scene, floor.scene, main.scene]); assert.equal(roofDisposals, 1)
})

test('repeated floor installation leaves second set owned by its original root', () => {
  const main = fixture(), first = fixture(), second = fixture()
  assert(installShipFloorRepair(main.scene, first.scene))
  assert.equal(installShipFloorRepair(main.scene, second.scene), false)
  assert(second.floors.every(o => o.parent === second.scene.children[0]))
  disposeShipModel(main.scene); disposeShipModel(first.scene); disposeShipModel(second.scene)
})
