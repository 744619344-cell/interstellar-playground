import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { Box3, Group, Mesh, SkinnedMesh, Texture, Quaternion,Raycaster,Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import manifest from '../../../../assets/models/current-ship-20261022/manifest.json'
import { loadCurrentShipAssembly } from './currentShipAssembly'
import { ShipModelRuntime, disposeShipModel } from './shipModelRuntime'
import { SHIP_MODEL_ASSETS } from './shipModelAssets'
import { createShipInteraction } from '../../domain/shipInteraction'

async function parseReal(url: string) {
  const bytes = await readFile(new URL(url)), loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'geometry_only_test' } })
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '')
}
const tick = () => new Promise<void>(done => setImmediate(done))

test('all ten production copies retain exact reviewed source bytes and seated prototype credit', async () => {
  for (const value of Object.values(manifest.assets)) {
    const bytes = await readFile(new URL(`../../../../assets/models/current-ship-20261022/${value.file}`, import.meta.url))
    const source = await readFile(new URL(`../../../../../${value.source}`, import.meta.url))
    assert.equal(bytes.byteLength, value.bytes)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), value.sha256)
    assert(bytes.equals(source))
  }
  assert.equal(manifest.assets.hull.sha256, 'b2a0f9e9c57ec0ba95f5272c2772bc99b4be77349267bb4ad43fb16aa407a2e0')
  const attribution = await readFile(new URL(SHIP_MODEL_ASSETS.attribution), 'utf8')
  assert.match(attribution, /Abrazafarolas/); assert.match(attribution, /CC BY 4\.0/)
})

test('production reuses both exact authorized infills and covers the cabin-facing side openings',async()=>{
  const current=await parseReal(SHIP_MODEL_ASSETS.assembly)
  const reviewed=await parseReal(new URL('../../../../../output/hunyuan-adaptation/interior-fit-hunyuan-20261018/thickness-material-20261021/ship-glass-depth-g12.glb',import.meta.url).href)
  const original=await parseReal(new URL('../../../../../output/hunyuan-adaptation/interior-fit-hunyuan-20261018/thickness-material-20261021/ship-wall-infill-w3.glb',import.meta.url).href)
  try{
    const panels:Mesh[]=[];current.scene.traverse(o=>{if(o instanceof Mesh&&o.userData.authorizedWallInfill)panels.push(o)})
    assert.equal(panels.length,2);current.scene.updateMatrixWorld(true)
    for(const mesh of panels){
      const source=reviewed.scene.getObjectByName(mesh.name) as Mesh;assert(source)
      for(const attr of ['position','normal'])assert.deepEqual(mesh.geometry.getAttribute(attr).array,source.geometry.getAttribute(attr).array)
      const first=original.scene.getObjectByName(mesh.name) as Mesh
      assert.deepEqual(mesh.geometry.getAttribute('position').array.slice(0,12),first.geometry.getAttribute('position').array.slice(0,12),'cabin-facing plane remains the original approved w3 surface; later source thickening extends its back')
      assert.deepEqual(mesh.geometry.index!.array,source.geometry.index!.array);assert.equal(mesh.geometry.index!.count,36)
      for(let y=0;y<20;y++)for(let z=0;z<20;z++){
        const side=mesh.userData.location==='storage'?1:-1,ray=new Raycaster(new Vector3(0,-1.5+y*1.05/19,.6+z*4.2/19),new Vector3(side,0,0))
        const hit=ray.intersectObject(mesh,false)[0];assert(hit);assert(hit.distance<3.7)
      }
    }
    const retained=await readFile(new URL('../../../../assets/models/current-ship-20261022/hull.glb',import.meta.url))
    assert.equal(createHash('sha256').update(retained).digest('hex'),'75dc3bb69f1c7d5ab22a8c7de2f7cb4eb0e8f0b6b94e15bc4d4df6cd2645413b')
  }finally{disposeShipModel(current.scene);disposeShipModel(reviewed.scene);disposeShipModel(original.scene)}
})

test('actual current ship installs its 119 instances and seated crew; glazing survives cockpit and skeleton releases once', async () => {
  const urls: string[] = []
  let active = 0, maximum = 0
  const asset = await loadCurrentShipAssembly(new AbortController().signal, disposeShipModel, async (url, signal) => {
    assert(!signal.aborted); urls.push(url); maximum = Math.max(maximum, ++active)
    try { return await parseReal(url) } finally { active-- }
  })
  assert.equal(maximum, 2); assert.equal(active, 0)
  assert.equal(urls.length, 10); assert.equal(new Set(urls).size, 10)
  const sourceLayout = JSON.parse(await readFile(new URL('../../../../../output/hunyuan-adaptation/interior-fit-hunyuan-20261018/inner-surface-diagnostic-20261021/space-layout.json', import.meta.url), 'utf8'))
  assert.equal(sourceLayout.parts.length, 119)
  for (const part of sourceLayout.parts) {
    const installed = asset.scene.children.find(o => o.name === part.name)
    assert(installed, part.name); assert.deepEqual(installed.position.toArray(), part.placement.offset)
    assert.equal(installed.scale.x, part.placement.uniformScale)
  }
  const actor = asset.scene.getObjectByName('ExistingAstronautInPilotSeat')!
  const bounds = new Box3().setFromObject(actor, true)
  assert(Math.abs(bounds.min.y + 1.5430236104) < 1e-5)
  assert(Math.abs(bounds.min.z + 5.1803659551) < 1e-5)
  const glazed: Mesh[] = [], skeletons = new Set<SkinnedMesh['skeleton']>()
  asset.scene.traverse(o => {
    if (o instanceof Mesh && o.userData.currentShipPart === 'skin') glazed.push(o)
    if (o instanceof SkinnedMesh) skeletons.add(o.skeleton)
  })
  assert(glazed.length >= 6); assert.equal(skeletons.size, 1)
  const skeleton = [...skeletons][0]; skeleton.computeBoneTexture()
  let skeletonTextureReleases = 0
  skeleton.boneTexture!.addEventListener('dispose', () => skeletonTextureReleases++)
  const runtime = new ShipModelRuntime(seat => assert.deepEqual(seat, { x: .9, y: -.25, z: -4.55 }), async () => asset)
  await tick(); assert.equal(runtime.snapshot().status, 'ready')
  assert.equal((runtime as any).exterior, undefined, 'current ship must not allocate its identical exterior GLB again')
  assert.deepEqual(runtime.snapshot().anchors, ['cockpit', 'stand-up', 'inner-door'])
  assert(runtime.snapshot().cabin, 'authorized door installs the shared physical crew controller')
  assert.equal(runtime.cabinVolume(), undefined)
  runtime.update({ position: { x: 0, y: 0, z: 0 }, orientation: new Quaternion() },
    { x: 0, y: 0, z: 0 }, true, true, 0, createShipInteraction())
  assert(glazed.every(mesh => mesh.visible)); assert(actor.children.length)
  const detail: Mesh[] = []
  asset.scene.traverse(o => { if (o instanceof Mesh && ['crew', 'equipment'].includes(o.userData.currentShipPart)) detail.push(o) })
  assert(detail.length > 0)
  ;(runtime as any).visibility.currentDetail(false)
  assert(detail.every(mesh => !mesh.visible)); assert(glazed.every(mesh => mesh.visible))
  ;(runtime as any).visibility.currentDetail(true)
  assert(detail.every(mesh => mesh.visible)); assert(glazed.every(mesh => mesh.visible))
  for (const mesh of glazed) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
    if ('transmission' in material) assert.equal(material.opacity, 1)
  runtime.suspend(true); runtime.suspend(true); runtime.dispose(); runtime.dispose()
  assert.equal(skeletonTextureReleases, 1); assert.equal(runtime.root.children.length, 0)
})

test('cancellation while parsing a later source releases all acquired source resources once', async () => {
  const aborter = new AbortController(), resources: { geometry: number; material: number }[] = []
  let loads = 0
  await assert.rejects(loadCurrentShipAssembly(aborter.signal, disposeShipModel, async (_url, signal) => {
    assert.equal(signal.aborted, false, 'must not schedule work after cancellation')
    const model = new Group(), counts = { geometry: 0, material: 0 }; resources.push(counts)
    const { BufferGeometry, MeshStandardMaterial } = await import('three')
    const geometry = new BufferGeometry(), material = new MeshStandardMaterial()
    geometry.addEventListener('dispose', () => counts.geometry++)
    material.addEventListener('dispose', () => counts.material++)
    const skins = new Group(); skins.userData.masterInterior = true
    skins.add(new Mesh(geometry, material)); model.add(skins)
    if (++loads === 3) aborter.abort()
    return { scene: model, animations: [] }
  }), { name: 'AbortError' })
  assert(loads >= 3 && loads <= 4, 'only the two already in-flight sources may finish')
  for (const counts of resources) assert.deepEqual(counts, { geometry: 1, material: 1 })
})

test('StrictMode cancellation before the first source arrives has no empty owner or late scene', async () => {
  const aborter = new AbortController(); let released = 0
  aborter.abort()
  await assert.rejects(loadCurrentShipAssembly(aborter.signal, () => released++, async () => {
    assert.fail('must not start a cancelled load')
  }), { name: 'AbortError' })
  assert.equal(released, 0)
})
