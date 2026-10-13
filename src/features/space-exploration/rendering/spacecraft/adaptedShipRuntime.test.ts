import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Quaternion, Raycaster, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { disposeShipModel, shipModelRadius, ShipModelRuntime } from './shipModelRuntime'
import { ShipReviewLighting, ShipVisibility } from './shipVisibility'
import { SHIP_PROTECTION } from '../../domain/shipNavigation'
import { activateShipInteraction, createShipInteraction, selectShipInteraction, stepShipInteraction } from '../../domain/shipInteraction'
import { addShipPressureBoundaries } from './shipPressureBoundary'
import { fitShipInteriorModules } from './shipInteriorFit'
import { addShipInteriorJoinery } from './shipInteriorJoinery'

async function load(filename = 'spacecraft-redesign-lod0.glb') {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'geometry_only_test' } })
  const bytes = await readFile(new URL('../../../../assets/models/' + filename, import.meta.url))
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, '')
}

test('actual adapted asset fits protection, preserves both chairs, loads seven anchors and rotates its real door', async () => {
  const gltf = await load(), radius = shipModelRadius(gltf.scene)
  assert(radius <= SHIP_PROTECTION.radius)
  let seated: { x: number; y: number; z: number } | undefined, pitch: number | undefined
  const runtime = new ShipModelRuntime((seat, value) => { seated = seat; pitch = value }, async () => gltf)
  await new Promise(done => setImmediate(done))
  assert.equal(runtime.snapshot().status, 'ready'); assert.equal(runtime.snapshot().anchors.length, 7)
  assert(seated); assert(Math.abs(seated.x + .65) < 1e-5); assert(Math.abs(seated.y + .18) < 1e-5)
  assert(Math.abs(seated.z + 3.84) < 1e-5); assert.equal(pitch, .025)
  const labels = new Set<string>()
  gltf.scene.traverse(o => { if (o.userData.module === 'seat') labels.add(o.userData.label) })
  assert.equal(labels.size, 2)
  gltf.scene.traverse(o => {
    if (o instanceof Mesh && o.userData.module === 'folding-berth')
      assert(new Box3().setFromObject(o, true).max.x < -.95, 'Beds must leave the center walkway clear')
  })
  const door = gltf.scene.getObjectByName('Door_Inner')!, closed = door.quaternion.clone()
  let state = activateShipInteraction(selectShipInteraction(createShipInteraction(), 'inner-door')).state
  for (let i = 0; i < 26; i++) state = stepShipInteraction(state, .05, true)
  runtime.update({ position: { x: 0, y: 0, z: 0 }, orientation: new Quaternion() }, { x: 0, y: 0, z: 0 }, true, true, 0, state)
  assert(door.quaternion.angleTo(closed) > 1)
  assert.equal(activateShipInteraction(selectShipInteraction(state, 'airlock')).state.doors.outer.target, 0)
  runtime.dispose(); runtime.dispose()
})

test('protection includes transformed vertices without counting unoccupied bounding-box corners', () => {
  const model = new Group(), geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([9, 0, 0, 0, 0, 9, 0, 1, 0], 3))
  const mesh = new Mesh(geometry, new MeshStandardMaterial()); model.add(mesh)
  assert.equal(shipModelRadius(model), 9)
  mesh.position.x = 2
  assert.equal(shipModelRadius(model), 11)
  assert(shipModelRadius(model) > SHIP_PROTECTION.radius)
  disposeShipModel(model)
})

test('hiding a ready assembly releases its textures and geometry; resume loads a fresh assembly', async () => {
  const first = await load(), second = await load()
  const mesh = first.scene.getObjectByProperty('type', 'Mesh') as Mesh
  const material = mesh.material as MeshStandardMaterial
  const counts = { geometry: 0, material: 0, texture: 0, seats: 0, loads: 0 }
  mesh.geometry.addEventListener('dispose', () => counts.geometry++)
  material.addEventListener('dispose', () => counts.material++)
  material.map!.addEventListener('dispose', () => counts.texture++)
  const signals: AbortSignal[] = []
  const runtime = new ShipModelRuntime(() => counts.seats++, async signal => {
    signals.push(signal); return counts.loads++ ? second : first
  })
  await new Promise(done => setImmediate(done))
  assert.equal(runtime.snapshot().status, 'ready')
  runtime.suspend(true); runtime.suspend(true)
  assert.deepEqual(counts, { geometry: 1, material: 1, texture: 1, seats: 1, loads: 1 })
  assert(signals[0].aborted); assert(runtime.snapshot().suspended)
  assert.equal(runtime.root.children.length, 0); assert.equal(runtime.snapshot().triangles, 0)
  runtime.suspend(false); runtime.suspend(false)
  await new Promise(done => setImmediate(done))
  assert.equal(runtime.snapshot().status, 'ready'); assert.equal(runtime.snapshot().anchors.length, 7)
  assert.equal(counts.loads, 2); assert.equal(counts.seats, 2); assert(!signals[1].aborted)
  runtime.dispose(); assert(signals[1].aborted)
})

test('late success after hide and obsolete failure after resume cannot replace or fail the current assembly', async () => {
  const current = await load()
  let resolve!: (model: Group) => void, reject!: (error: Error) => void, loads = 0, released = 0, seated = 0
  const late = new Group(), geometry = new BufferGeometry()
  geometry.addEventListener('dispose', () => released++)
  late.add(new Mesh(geometry, new MeshStandardMaterial()))
  const runtime = new ShipModelRuntime(() => seated++, () => {
    loads++
    if (loads === 1) return new Promise<Group>(done => { resolve = done })
    if (loads === 2) return new Promise<Group>((_, fail) => { reject = fail })
    return Promise.resolve(current)
  })
  runtime.suspend(true); runtime.suspend(false)
  resolve(late); await new Promise(done => setImmediate(done))
  assert.equal(released, 1); assert.equal(seated, 0)
  runtime.suspend(true); runtime.suspend(false)
  await new Promise(done => setImmediate(done))
  reject(new Error('obsolete request')); await new Promise(done => setImmediate(done))
  assert.equal(runtime.snapshot().status, 'ready'); assert.equal(seated, 1)
  assert.equal(runtime.snapshot().anchors.length, 7)
  runtime.dispose(); runtime.suspend(false); assert.equal(loads, 3)
})

test('actual exterior detail retains hull, glass and closed exit within the LOD1 budget', async () => {
  const gltf = await load('spacecraft-redesign-exterior-lod1.glb')
  let count = 0, hull = 0, glass = 0, exit = 0
  gltf.scene.traverse(o => {
    if (!(o instanceof Mesh)) return
    count += o.geometry.index!.count / 3
    hull += Number(o.userData.part === 'hull'); glass += Number(o.userData.part === 'glass')
    exit += Number(o.userData.module === 'airlock-outer-door')
  })
  assert(count >= 35000 && count <= 60000); assert(hull && glass && exit)
  assert(shipModelRadius(gltf.scene) <= SHIP_PROTECTION.radius)
  assert.equal(gltf.animations.length, 0); disposeShipModel(gltf.scene)
})

test('Chinese module metadata separates exterior and cockpit while cloned glass restores caller material', async () => {
  const gltf = await load(), visibility = new ShipVisibility(gltf.scene), lighting = new ShipReviewLighting([gltf.scene])
  const meshes: Mesh[] = []; gltf.scene.traverse(o => { if (o instanceof Mesh) meshes.push(o) })
  const hull = meshes.find(o => o.userData.part === 'hull')!, glass = meshes.find(o => o.userData.part === 'glass')!
  const cabinBed = meshes.find(o => o.userData.module === 'folding-berth')!
  const joystick = meshes.find(o => o.userData.module === 'joystick')!
  const innerFrame = meshes.find(o => o.userData.label === '气闸内门框')!
  const outerFrame = meshes.find(o => o.userData.label === '气闸外门框')!
  const sourceGlass = (glass.material as MeshStandardMaterial)
  visibility.apply({ view: 'exterior', innerOpen: false, outerOpen: false }); lighting.apply('exterior')
  assert(hull.visible); assert(glass.visible); assert(!cabinBed.visible); assert(!joystick.visible)
  assert(outerFrame.visible); assert(!innerFrame.visible); assert(visibility.snapshot().triangles <= 120000)
  assert.equal((glass.material as MeshStandardMaterial).opacity, .92)
  visibility.apply({ view: 'cockpit', innerOpen: false, outerOpen: false }); lighting.apply('cockpit')
  assert(!hull.visible); assert(glass.visible); assert(joystick.visible); assert(cabinBed.visible)
  assert(innerFrame.visible); assert(!outerFrame.visible)
  const interiorAndGlass = meshes.filter(m => !m.userData.part || m.userData.part === 'glass')
    .reduce((sum,m) => sum + m.geometry.index!.count / 3, 0)
  assert(visibility.snapshot().triangles <= interiorAndGlass, 'Complete interior must exclude unrelated exterior geometry')
  assert.equal((glass.material as MeshStandardMaterial).opacity, .12)
  lighting.dispose(); visibility.dispose()
  assert.notEqual(glass.material, sourceGlass); assert.equal((glass.material as MeshStandardMaterial).opacity, .12)
  assert(hull.visible); disposeShipModel(gltf.scene)
})

test('closed cabin retains real airlock bulkhead infill without revealing it from closed exterior', async () => {
  const gltf = await load(), visibility = new ShipVisibility(gltf.scene)
  const panels: Mesh[] = [], visible: Mesh[] = []
  gltf.scene.traverse(o => {
    if (o instanceof Mesh && o.userData.label === '气闸门框侧接板') panels.push(o)
  })
  assert.equal(panels.length, 4)
  for (const view of ['cockpit', 'cabin', 'airlock'] as const) {
    visibility.apply({ view, innerOpen: false, outerOpen: false })
    assert(panels.every(p => p.visible), `${view} must retain structural side panels`)
  }
  visibility.apply({ view: 'cockpit', innerOpen: false, outerOpen: false })
  gltf.scene.updateMatrixWorld(true)
  gltf.scene.traverse(o => { if (o instanceof Mesh && o.visible) visible.push(o) })
  for (const x of [-1.4, 1.4]) {
    const hits = new Raycaster(new Vector3(x, -.2, 4.4), new Vector3(0, 0, 1)).intersectObjects(visible, false)
    assert.equal(hits[0]?.object.userData.label, '气闸门框侧接板')
    assert(hits[0].distance < .7)
  }
  visibility.apply({ view: 'exterior', innerOpen: false, outerOpen: false })
  assert(panels.every(p => !p.visible))
  visibility.dispose(); disposeShipModel(gltf.scene)
})

test('real leaf profile closes corner gaps, keeps the opened passage and clears both moving leaves', async () => {
  const gltf = await load()
  addShipPressureBoundaries(gltf.scene); addShipPressureBoundaries(gltf.scene)
  let triangles = 0, released = 0
  for (const suffix of ['Inner', 'Outer']) {
    const panel = gltf.scene.getObjectByName(`Pressure_Bulkhead_${suffix}`) as Mesh
    triangles += panel.geometry.index!.count / 3
    panel.geometry.addEventListener('dispose', () => released++)
  }
  assert(triangles < 600)
  const exteriorVisibility = new ShipVisibility(gltf.scene)
  exteriorVisibility.apply({ view: 'exterior', innerOpen: false, outerOpen: false })
  assert(gltf.scene.getObjectByName('Pressure_Bulkhead_Outer')!.visible)
  assert(!gltf.scene.getObjectByName('Pressure_Bulkhead_Inner')!.visible)
  assert(!gltf.scene.getObjectByName('Pressure_Liner_rear-cabin_0')!.visible)
  exteriorVisibility.dispose()
  const runtime = new ShipModelRuntime(() => {}, async () => gltf)
  await new Promise(done => setImmediate(done))
  const apply = (state: ReturnType<typeof createShipInteraction>) => {
    runtime.update({ position: { x: 0, y: 0, z: 0 }, orientation: new Quaternion() }, { x: 0, y: 0, z: 0 }, true, true, 0, state)
    gltf.scene.updateMatrixWorld(true)
  }
  const closed = createShipInteraction(); apply(closed)
  const visible: Mesh[] = []
  gltf.scene.traverse(o => { if (o instanceof Mesh && o.visible) visible.push(o) })
  for (let y = -1.55; y < 1.19; y += .1) for (let x = -1.75; x < 1.79; x += .1) {
    assert(new Raycaster(new Vector3(x, y, 4.4), new Vector3(0, 0, 1), .01, 1)
      .intersectObjects(visible, false).length, `Closed bulkhead gap at ${x},${y}`)
  }
  for (const [door, node, plane] of [['inner', 'Door_Inner', 4.96], ['outer', 'Door_Outer', 7.16]] as const) {
    for (const degrees of [0, 5, 15, 30, 45, 60, 75, 90]) {
      const state = createShipInteraction(); state.doors[door].progress = degrees / 90; apply(state)
      const box = new Box3().setFromObject(gltf.scene.getObjectByName(node)!, true)
      assert(door === 'inner' ? box.min.z > plane : box.max.z < plane, `${door} leaf crosses infill plane at ${degrees} degrees`)
      assert(box.min.x > -1.84 && box.max.x < 1.84 && box.min.y > -1.68 && box.max.y < 1.26,
        `${door} leaf must clear side, roof and floor backing at ${degrees} degrees`)
    }
  }
  const opened = createShipInteraction(); opened.doors.inner.progress = 1; apply(opened)
  const clear = new Raycaster(new Vector3(0, -.45, 4.4), new Vector3(0, 0, 1), .01, 1).intersectObjects(visible, false)
  assert.equal(clear.length, 0, 'Opening must remain traversable')
  runtime.dispose(); runtime.dispose(); assert.equal(released, 2)
})

test('all three zones retain concealed slab backing and dispose it with the model owner', async () => {
  const gltf = await load(), runtime = new ShipModelRuntime(() => {}, async () => gltf)
  await new Promise(done => setImmediate(done))
  const visibility = new ShipVisibility(gltf.scene), visible: Mesh[] = []
  let geometryReleased = 0, materialReleased = 0, liners = 0
  visibility.apply({ view: 'cabin', innerOpen: false, outerOpen: false })
  gltf.scene.traverse(o => {
    if (!(o instanceof Mesh)) return
    if (o.visible) visible.push(o)
    if (o.userData.module !== 'pressure-liner') return
    liners++; assert.equal(o.geometry.index!.count, 6)
    o.geometry.addEventListener('dispose', () => geometryReleased++)
    ;(o.material as MeshStandardMaterial).addEventListener('dispose', () => materialReleased++)
  })
  assert.equal(liners, 17); gltf.scene.updateMatrixWorld(true)
  for (let z = -2.59; z < 7.15; z += .2) {
    for (let y = -1.55; y < 1.19; y += .2) for (const side of [-1, 1])
      assert(new Raycaster(new Vector3(0, y, z), new Vector3(side, 0, 0), .01, 2)
        .intersectObjects(visible, false).length, `Side gap at ${side},${y},${z}`)
    for (let x = -1.75; x < 1.79; x += .2) for (const side of [-1, 1])
      assert(new Raycaster(new Vector3(x, 0, z), new Vector3(0, side, 0), .01, 2)
        .intersectObjects(visible, false).length, `Slab gap at ${side},${x},${z}`)
  }
  visibility.dispose(); runtime.dispose(); runtime.dispose()
  assert.equal(geometryReleased, 17); assert.equal(materialReleased, 17)
})

test('wall service covers face inward, preserve bounds and stay fixed across repeated fitting', async () => {
  const gltf = await load(), walls:Mesh[]=[]
  gltf.scene.traverse(o=>{if(o instanceof Mesh && o.userData.module==='rear-cabin-wall') walls.push(o)})
  gltf.scene.updateMatrixWorld(true)
  const before=new Box3();walls.forEach(m=>before.union(new Box3().setFromObject(m)))
  fitShipInteriorModules(gltf.scene)
  const after=new Box3();walls.forEach(m=>after.union(new Box3().setFromObject(m)))
  assert(before.min.distanceTo(after.min)<1e-5);assert(before.max.distanceTo(after.max)<1e-5)
  const covers=walls.filter(m=>/_[12]_\d+$/.test(m.name));assert.equal(covers.length,4)
  covers.forEach(m=>assert(Math.abs(new Box3().setFromObject(m).getCenter(new Vector3()).x)<1.84))
  const matrices=walls.map(m=>m.matrixWorld.clone());fitShipInteriorModules(gltf.scene)
  walls.forEach((m,i)=>assert(m.matrixWorld.equals(matrices[i])))
  assert.equal(gltf.animations.length,5);assert(gltf.scene.getObjectByName('Door_Inner'))
  disposeShipModel(gltf.scene)
})

test('chamfered joinery supports both pedals, retains closed doors in every interior view and releases batches once', async () => {
  const gltf=await load();fitShipInteriorModules(gltf.scene);addShipPressureBoundaries(gltf.scene)
  addShipInteriorJoinery(gltf.scene);addShipInteriorJoinery(gltf.scene);gltf.scene.updateMatrixWorld(true)
  const group=gltf.scene.getObjectByName('Interior_Joinery')!,batches=group.children as Mesh[]
  assert.equal(batches.length,5);let released=0
  batches.forEach(m=>m.geometry.addEventListener('dispose',()=>released++))
  for(const x of [-.825,-.475,.475,.825]) {
    const hits=new Raycaster(new Vector3(x,-1.49,-4.94),new Vector3(0,-1,0),.001,.03).intersectObjects(batches,false)
    assert(hits.length,`Pedal support must reach the pedal at ${x}`)
  }
  const visibility=new ShipVisibility(gltf.scene)
  for(const view of ['cockpit','cabin','airlock'] as const) {
    visibility.apply({view,innerOpen:false,outerOpen:false})
    const leaf:Mesh[]=[];gltf.scene.getObjectByName('Door_Inner')!.traverse(o=>{if(o instanceof Mesh)leaf.push(o)})
    assert(leaf.every(m=>m.visible),`${view} must retain the closed inner leaf`)
  }
  visibility.dispose();disposeShipModel(gltf.scene);assert.equal(released,5)
})
