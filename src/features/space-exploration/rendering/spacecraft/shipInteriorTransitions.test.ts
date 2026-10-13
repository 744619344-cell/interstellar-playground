import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Group, Mesh, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { continuousRoofHeight } from './shipInteriorTransitions'
import { fitShipInteriorModules } from './shipInteriorFit'
import { addShipInteriorJoinery } from './shipInteriorJoinery'
import { addShipPressureBoundaries } from './shipPressureBoundary'
import { disposeShipModel } from './shipModelRuntime'
import { ShipCabinCamera, shipCabinObstacles } from './shipCabinCamera'
import { shipWindowRevealPoint } from './shipWindowReveal'

async function assembly() {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'geometry_only_test' } })
  const bytes = await readFile(new URL('../../../../assets/models/spacecraft-redesign-lod0.glb', import.meta.url))
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength) as ArrayBuffer, '')
  fitShipInteriorModules(gltf.scene); addShipPressureBoundaries(gltf.scene)
  return gltf
}

test('formed ceiling matches incoming/outgoing slopes and never folds back or exceeds the rear roof', () => {
  const epsilon = .00001
  for (const z of [-2.6,-2.35]) {
    const before = (continuousRoofHeight(z)-continuousRoofHeight(z-epsilon))/epsilon
    const after = (continuousRoofHeight(z+epsilon)-continuousRoofHeight(z))/epsilon
    assert(Math.abs(before-after)<.0001, `Tangent break at ${z}`)
  }
  let previous = continuousRoofHeight(-2.6)
  for(let z=-2.6;z<=-2.35;z+=.005) {
    const height = continuousRoofHeight(z)
    assert(height>=previous-1e-8); assert(height<=continuousRoofHeight(-2)+1e-8); previous=height
  }
})

test('window reveal bend retains frame/room boundaries and matches the ceiling incoming tangent', () => {
  const back=new Vector3(-1.8,.27,-5.9),front=new Vector3(-.89,.69,-6.32)
  assert(shipWindowRevealPoint(back,front,0).distanceTo(back)<1e-10)
  assert(shipWindowRevealPoint(back,front,18).distanceTo(front)<1e-10)
  const incoming=shipWindowRevealPoint(back,front,.00001).sub(back).normalize()
  assert(Math.abs(incoming.x)<1e-5);assert(Math.abs(incoming.y/incoming.z-.85/3.3)<1e-5)
  const bend=shipWindowRevealPoint(back,front,8),before=shipWindowRevealPoint(back,front,7.99999)
  assert(bend.clone().sub(before).normalize().distanceTo(front.clone().sub(back).normalize())<.00001)
})

test('actual installed fixtures retain a clear seated-to-airlock inspection route and closed-door collision', async () => {
  const {scene}=await assembly(),camera=new ShipCabinCamera()
  camera.setSeat({x:-.65,y:-.18,z:-3.84});camera.setObstacles(shipCabinObstacles(scene))
  for(let i=0;i<38;i++)camera.move(-.3,0,0,0,false)
  assert(camera.snapshot().z>4.7&&camera.snapshot().z<=4.75);assert(camera.blocked)
  camera.move(0,.65,0,0,false)
  for(let i=0;i<8;i++)camera.move(-.3,0,0,0,true)
  assert(camera.snapshot().z>6.8&&camera.snapshot().z<=6.95)
  disposeShipModel(scene)
})

test('actual cockpit/cabin cove edge positions and normals agree across the zone boundary', async () => {
  const {scene}=await assembly(); addShipInteriorJoinery(scene)
  const root=scene.getObjectByName('Interior_Joinery') as Group
  const y=continuousRoofHeight(-2.6)-.045+.045*Math.SQRT1_2, x=1.782-.045+.045*Math.SQRT1_2
  for(const side of [-1,1]) {
    const normals:Vector3[]=[]
    for(const zone of ['驾驶区','后舱']) {
      let found=false
      for(const m of root.children as Mesh[]) if(m.userData.zone===zone) {
        const p=m.geometry.getAttribute('position'), n=m.geometry.getAttribute('normal')
        for(let i=0;i<p.count;i++) if(Math.abs(p.getX(i)-side*x)<1e-5 && Math.abs(p.getY(i)-y)<1e-5 && Math.abs(p.getZ(i)+2.6)<1e-5) {
          normals.push(new Vector3().fromBufferAttribute(n,i)); found=true; break
        }
      }
      assert(found, `Missing joined cove at ${zone}/${side}`)
    }
    assert(normals[0].distanceTo(normals[1])<.0001, `Shading discontinuity at ${side}`)
  }
  disposeShipModel(scene)
})

test('formed interfaces retain every original source transform/geometry, include equipment mounts, and release shared materials once', async () => {
  const {scene,animations}=await assembly(), originals:Mesh[]=[]
  scene.traverse(o=>{if(o instanceof Mesh)originals.push(o)})
  const matrices=originals.map(m=>m.matrix.clone()), geometries=originals.map(m=>m.geometry)
  addShipInteriorJoinery(scene);addShipInteriorJoinery(scene)
  originals.forEach((m,i)=>{assert(m.matrix.equals(matrices[i]));assert.equal(m.geometry,geometries[i])})
  assert.equal(animations.length,5)
  const batches=scene.getObjectByName('Interior_Joinery')!.children as Mesh[], materials=new Set(batches.map(m=>m.material))
  const sections=batches.flatMap(m=>m.userData.sections as string[])
  assert(sections.some(name=>name.startsWith('窗台后缘贴合密封')))
  assert(!sections.some(name=>name==='一体成形舱段收口-5.9'||name.includes('窗台检修盖')))
  const connections=new Set(batches.flatMap(m=>m.userData.connects as string[]))
  for(const module of ['cockpit-sidewall','rear-cabin-wall','airlock-wall','window-liner','cockpit-ceiling','rear-cabin-ceiling',
    'rear-workbench','storage-cabinet','dual-suit-locker','folding-berth','airlock-pressure-panel']) assert(connections.has(module),module)
  for(const mesh of batches) {
    const p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal')
    for(let i=0;i<p.count;i++) { assert(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i))); assert(new Vector3().fromBufferAttribute(n,i).length()>.99) }
  }
  let released=0;materials.forEach(m=>{if(!Array.isArray(m))m.addEventListener('dispose',()=>released++)})
  disposeShipModel(scene);assert.equal(released,materials.size)
})
