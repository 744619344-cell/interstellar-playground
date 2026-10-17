import assert from 'node:assert/strict'
import test from 'node:test'
import { SystemMapEngine } from './systemMapEngine'
import { overviewPose } from '../../domain/cameraModel'

class FakeClock {
  nextId = 1
  queue: Array<{ id: number, callback: (time: number) => void }> = []
  requestAnimationFrame(callback: (time: number) => void) {
    const id = this.nextId++
    this.queue.push({ id, callback })
    return id
  }
  cancelAnimationFrame(handle: number) {
    this.queue = this.queue.filter((item) => item.id !== handle)
  }
  flush(time = 16) {
    const batch = this.queue.splice(0)
    batch.forEach((item) => item.callback(time))
  }
}

function fakeRenderer(renders: number[], disposed: string[]) {
  return {
    setPixelRatio() {},
    setSize() {},
    outputColorSpace: '',
    toneMapping: 0,
    toneMappingExposure: 1,
    render() { renders.push(1) },
    dispose() { disposed.push('renderer') },
    info: { memory: { geometries: 12, textures: 5 }, programs: [1] }
  }
}

const textures = {
  surface: {
    sun: 'sun', mercury: 'mercury', venus: 'venus', earth: 'earth', moon: 'moon',
    mars: 'mars', jupiter: 'jupiter', saturn: 'saturn', uranus: 'uranus', neptune: 'neptune'
  },
  earthNight: 'night', earthClouds: 'clouds', saturnRing: 'ring', milkyWay: 'sky'
} as any

function makeEngine() {
  const renders: number[] = []
  const disposed: string[] = []
  const snapshots: any[] = []
  const canvas = { addEventListener() {}, removeEventListener() {} } as any
  const clock = new FakeClock()
  const engine = new SystemMapEngine(
    { canvas, width: 800, height: 600, pixelRatio: 1, textures, onSnapshot: (snap) => snapshots.push(snap) },
    clock,
    { createRenderer: () => fakeRenderer(renders, disposed) as any },
    { load() {} } as any
  )
  return { engine, clock, renders, disposed, snapshots }
}

test('repeated start stop destroy does not create a second RAF', () => {
  const { engine, clock, disposed } = makeEngine()
  engine.start()
  engine.start()
  assert.equal(clock.queue.length, 1)
  clock.flush(16)
  assert.equal(clock.queue.length, 1)
  engine.stop()
  engine.stop()
  assert.equal(clock.queue.length, 0)
  engine.destroy()
  engine.destroy()
  engine.start()
  assert.equal(clock.queue.length, 0)
  assert.deepEqual(disposed, ['renderer'])
})

test('resize with zero size is ignored and later size reuses the same renderer', () => {
  const { engine, disposed } = makeEngine()
  engine.resize(0, 0, 1)
  engine.resize(1024, 768, 1.5)
  engine.destroy()
  assert.equal(disposed.filter((item) => item === 'renderer').length, 1)
})

test('overview resize refits the camera and preserves relative user zoom', () => {
  const { engine } = makeEngine()
  engine.resize(1280, 720, 1)
  assert.ok(Math.abs(engine.snapshot().visualDistance - overviewPose({ width: 1280, height: 720 }).distance) < 1e-7)
  engine.zoomBy(-100)
  const zoom = engine.snapshot().visualDistance / overviewPose({ width: 1280, height: 720 }).distance
  engine.resize(1920, 1080, 1)
  assert.ok(Math.abs(engine.snapshot().visualDistance / overviewPose({ width: 1920, height: 1080 }).distance - zoom) < 1e-7)
  engine.destroy()
})

test('overview zoom-out keeps planets and orbit guides within a readable range', () => {
  const { engine } = makeEngine()
  const fitted = overviewPose({ width: 800, height: 600 }).distance
  engine.zoomBy(5000)
  assert.ok(engine.snapshot().visualDistance <= fitted * 1.35)
  engine.destroy()
})

test('sky stays centered on the camera after zoom and pan', () => {
  const { engine } = makeEngine()
  engine.zoomBy(100)
  engine.handlePointerDown(100, 100, 1, true)
  engine.handlePointerMove(200, 180, 1, true)
  engine.handlePointerUp(200, 180, 1, true)
  const state = engine as any
  assert.deepEqual(state.sky.position.toArray(), state.world.camera.position.toArray())
  assert.ok(state.sky.geometry.parameters.radius < state.world.camera.far)
  engine.destroy()
  assert.equal(state.sky, undefined)
})

test('focusing earth then moon then saturn leaves only saturn selected', () => {
  const { engine, snapshots } = makeEngine()
  engine.focus('earth')
  engine.focus('moon')
  engine.focus('saturn')
  const last = snapshots.at(-1)
  assert.equal(last.focusedId, 'saturn')
  assert.equal(last.selectedId, 'saturn')
  assert.equal(last.mode, 'focus')
  engine.overview()
  assert.equal(engine.snapshot().focusedId, null)
  assert.equal(engine.snapshot().selectedId, null)
  assert.equal(engine.snapshot().mode, 'overview')
})

test('double tap keeps the first tap target when a moving body misses the second pick', () => {
  const { engine } = makeEngine()
  engine.select('earth')
  ;(engine as any).pick = () => null
  ;(engine as any).focusFromTap(100, 100)
  assert.equal(engine.snapshot().focusedId, 'earth')
  assert.equal(engine.snapshot().selectedId, 'earth')
  engine.destroy()
})

test('context loss stops the loop and reports failure', () => {
  const renders: number[] = []
  const disposed: string[] = []
  const failures: string[] = []
  const listeners = new Map<string, EventListener>()
  const canvas = {
    addEventListener(type: string, listener: EventListener) { listeners.set(type, listener) },
    removeEventListener(type: string) { listeners.delete(type) }
  } as any
  const clock = new FakeClock()
  const engine = new SystemMapEngine(
    {
      canvas, width: 400, height: 300, pixelRatio: 1, textures,
      onSnapshot() {},
      onFail: (reason) => failures.push(reason)
    },
    clock,
    { createRenderer: () => fakeRenderer(renders, disposed) as any },
    { load() {} } as any
  )
  engine.start()
  const event = { preventDefault() {} } as Event
  listeners.get('webglcontextlost')?.(event)
  assert.deepEqual(failures, ['context-lost'])
  assert.equal(engine.snapshot().ship?.suspended, true)
  assert.equal(clock.queue.length, 0)
  engine.destroy()
})

test('simulation pause freezes planets while leaving the render loop available for camera input', () => {
  const { engine, clock } = makeEngine()
  const earth = () => {
    const position = (engine as any).bodies.get('earth').group.position
    return { x: position.x, z: position.z }
  }
  const initial = earth()
  engine.start()
  clock.flush(1000)
  clock.flush(1016)
  const running = earth()
  assert.notDeepEqual(running, initial)
  engine.setSimulationPaused(true)
  clock.flush(5000)
  assert.deepEqual(earth(), running)
  assert.equal(clock.queue.length, 1)
  engine.setSimulationPaused(false)
  clock.flush(5016)
  assert.notDeepEqual(earth(), running)
  engine.destroy()
})

test('the default solar ship persists across camera entry/exit without another instance or load', () => {
  const { engine, clock } = makeEngine()
  const world = (engine as any).world
  const ship = (engine as any).ship
  const generation = ship.model.generation
  assert.ok(engine.snapshot().ship)
  assert.equal(engine.snapshot().shipFlight, undefined)
  assert.equal(engine.shipKey('KeyW', true), false)
  const children = world.scene.children.length
  const projection = { fov: world.camera.fov, near: world.camera.near }
  engine.start()
  for (let i = 0; i < 10; i++) {
    engine.shipAction('enter')
    assert.equal(world.scene.children.length, children)
    assert.equal(world.camera.fov, 55)
    const modelRoot = ship.model.root
    engine.overview()
    assert.equal(world.scene.children.length, children)
    assert.equal((engine as any).ship, ship)
    assert.equal(ship.model.root, modelRoot)
    assert.equal(ship.model.generation, generation)
    assert.equal(engine.snapshot().shipFlight, undefined)
    assert.equal(ship.model.root.visible, true)
    assert.equal(world.camera.fov, projection.fov)
    assert.equal(world.camera.near, projection.near)
    assert.equal((engine as any).world, world)
    assert.equal(clock.queue.length, 1)
  }
  engine.destroy()
})

test('preview freezes on pause and suspension, clears held input, and keeps camera usable during user pause', () => {
  const { engine, clock } = makeEngine()
  engine.shipAction('enter'); engine.start(); clock.flush(1000)
  engine.shipKey('KeyW', true); clock.flush(1050)
  const running = engine.snapshot().shipFlight!
  assert.ok(running.speed > 0)
  engine.setSimulationPaused(true)
  clock.flush(1100)
  const paused = engine.snapshot().shipFlight!
  assert.deepEqual(paused.flightPosition, running.flightPosition)
  engine.shipAction('free')
  assert.equal(engine.snapshot().shipFlight?.mode, 'free')
  engine.setSimulationPaused(false); clock.flush(1150)
  assert.ok(engine.snapshot().shipFlight!.speed < running.speed)
  engine.shipKey('KeyW', true)
  engine.setInputEnabled(false); clock.flush(1200)
  assert.equal(engine.shipKey('KeyW', true), false)
  const suspended = engine.snapshot().shipFlight!
  clock.flush(1250)
  assert.deepEqual(engine.snapshot().shipFlight?.flightPosition, suspended.flightPosition)
  engine.setInputEnabled(true); clock.flush(1300)
  assert.equal(engine.snapshot().shipFlight?.speed, 0)
  engine.destroy()
})

test('four view keyboard cycle preserves paused flight state and renderer', () => {
  const { engine, clock } = makeEngine()
  engine.shipAction('enter'); engine.start(); clock.flush(1000)
  engine.shipKey('KeyW', true); clock.flush(1050)
  engine.setSimulationPaused(true)
  const before = engine.snapshot().shipFlight!
  const world = (engine as any).world
  let time = 1050
  for (const mode of ['cockpit', 'cabin', 'free', 'follow']) {
    engine.shipKey('KeyC', true); engine.shipKey('KeyC', false)
    for (let i = 0; i < 20; i++) clock.flush(time += 50)
    const after = engine.snapshot().shipFlight!
    assert.equal(after.mode, mode)
    assert.equal(after.transitioning, false)
    assert.deepEqual(after.flightPosition, before.flightPosition)
    assert.deepEqual(after.orientation, before.orientation)
    assert.equal(after.speed, before.speed)
    assert.equal((engine as any).world, world)
  }
  engine.destroy()
})

test('seat state follows view controls, F routes one contextual interaction, and reset clears the anchor', () => {
  const { engine } = makeEngine()
  engine.shipAction('enter')
  engine.shipAction('cockpit')
  assert.equal(engine.snapshot().shipFlight?.interaction.seated, true)
  engine.shipAction('free')
  assert.equal(engine.snapshot().shipFlight?.interaction.seated, false)
  engine.shipAction('anchor:console')
  assert.equal(engine.snapshot().shipFlight?.interaction.activeAnchor, 'console')
  const preview = (engine as any).ship
  let interactions = 0
  preview.interact = () => { interactions++ }
  assert.equal(engine.shipKey('KeyF', true), true)
  assert.equal(engine.shipKey('KeyF', false), true)
  assert.equal(interactions, 1)
  engine.shipAction('reset')
  assert.equal(engine.snapshot().shipFlight?.interaction.activeAnchor, 'cockpit')
  assert.equal(engine.snapshot().shipFlight?.interaction.seated, false)
  engine.destroy()
})

test('cabin controls move only the observer, freeze on pause, and dispatch Ctrl pan separately from orbit', () => {
  const {engine,clock}=makeEngine()
  engine.shipAction('enter');engine.start();clock.flush(1000)
  const preview=(engine as any).ship
  // Simulate a ready installed model; this test exercises input routing rather than asynchronous asset loading.
  preview.model.status='ready';preview.model.render=()=>{};preview.rig.setSeat({x:0,y:-.18,z:1})
  engine.shipAction('cabin');clock.flush(1050)
  const before=engine.snapshot().shipFlight!
  engine.shipKey('KeyS',true)
  for(let i=0;i<10;i++)clock.flush(1100+i*50)
  engine.shipKey('KeyS',false)
  const after=engine.snapshot().shipFlight!
  assert(after.cabinPosition.z > before.cabinPosition.z)
  assert.deepEqual(after.flightPosition,before.flightPosition);assert.equal(after.speed,0)
  engine.clearInput();clock.flush(1650)
  assert.deepEqual(engine.snapshot().shipFlight!.cabinPosition,after.cabinPosition)
  engine.setSimulationPaused(true);engine.shipKey('KeyS',true);clock.flush(1700)
  engine.shipAction('cabinBack')
  assert.deepEqual(engine.snapshot().shipFlight!.cabinPosition,after.cabinPosition)
  engine.setSimulationPaused(false)
  engine.shipAction('zoomIn');assert.equal(engine.snapshot().shipFlight!.interiorFov,50)
  const yaw=engine.snapshot().shipFlight!.yaw
  engine.handlePointerDown(500,300,1,true);engine.handlePointerMove(530,320,1,true);engine.handlePointerUp(530,320,1,true)
  const panned=engine.snapshot().shipFlight!
  assert.notDeepEqual(panned.cabinPosition,after.cabinPosition);assert.equal(panned.yaw,yaw)
  engine.setInputEnabled(false);clock.flush(1800)
  assert.deepEqual(engine.snapshot().shipFlight!.cabinPosition,panned.cabinPosition)
  engine.destroy()
})

test('inspection at the inner doorway prevents closing until the observer clears the frame', () => {
  const { engine, clock } = makeEngine()
  engine.shipAction('enter'); engine.start(); clock.flush(1000)
  const preview = (engine as any).ship
  preview.model.status = 'ready'; preview.model.render = () => {}
  preview.rig.setSeat({ x: 0, y: -.18, z: 5 }); engine.shipAction('cabin')
  preview.interaction.doors.inner = { progress: 1, target: 1 }
  engine.shipAction('anchor:inner-door'); engine.shipAction('interact')
  assert.equal(engine.snapshot().shipFlight!.interaction.doors.inner.target, 1)
  assert.match(engine.snapshot().shipFlight!.interaction.notice!, /先移出门框/)
  engine.shipAction('cabinForward'); engine.shipAction('interact')
  assert.equal(engine.snapshot().shipFlight!.interaction.doors.inner.target, 0)
  engine.destroy()
})

test('navigation locks targets, assists without thrust, survives view changes and clears on reset', () => {
  const { engine, clock } = makeEngine()
  engine.shipAction('enter'); engine.start(); clock.flush(1000)
  engine.shipAction('target:moon'); engine.shipAction('assist')
  let time = 1000
  for (let i = 0; i < 60; i++) clock.flush(time += 50)
  let snap = engine.snapshot().shipFlight!
  assert.equal(snap.navigation.targetId, 'moon')
  assert.ok(snap.navigation.target)
  assert.equal(snap.speed, 0)
  assert.notDeepEqual(snap.orientation, { x: 0, y: 0, z: 0, w: 1 })
  engine.setSimulationPaused(true)
  const orientation = snap.orientation
  engine.shipAction('cockpit')
  for (let i = 0; i < 20; i++) clock.flush(time += 50)
  snap = engine.snapshot().shipFlight!
  assert.equal(snap.navigation.targetId, 'moon')
  assert.deepEqual(snap.orientation, orientation)
  engine.shipAction('clearTarget')
  assert.equal(engine.snapshot().shipFlight!.navigation.assist, false)
  assert.equal(engine.snapshot().shipFlight!.navigation.target, undefined)
  engine.shipAction('target:saturn'); engine.shipAction('reset')
  assert.equal(engine.snapshot().shipFlight!.navigation.targetId, undefined)
  engine.destroy()
})

test('direct lateral movement keeps guidance while explicit stop relinquishes it', () => {
  const { engine, clock } = makeEngine()
  engine.shipAction('enter'); engine.start(); clock.flush(1000)
  engine.shipAction('target:moon'); engine.shipAction('assist')
  let time = 1000
  engine.shipKey('KeyA', true)
  for (let i = 0; i < 10; i++) clock.flush(time += 50)
  engine.shipKey('KeyA', false)
  assert.equal(engine.snapshot().shipFlight!.navigation.assist, true)
  assert.equal(engine.snapshot().shipFlight!.navigation.targetId, 'moon')
  engine.shipKey('Space', true); engine.shipKey('Space', false)
  assert.equal(engine.snapshot().shipFlight!.navigation.assist, false)
  engine.destroy()
})

test('mouse view determines direct forward movement direction', () => {
  const { engine, clock } = makeEngine()
  engine.shipAction('enter'); engine.shipAction('free'); engine.start(); clock.flush(1000)
  engine.handlePointerDown(100, 100)
  engine.handlePointerMove(414, 100)
  engine.handlePointerUp(414, 100)
  let time = 1000
  for (let i = 0; i < 20; i++) clock.flush(time += 50)
  engine.shipKey('KeyW', true)
  for (let i = 0; i < 20; i++) clock.flush(time += 50)
  engine.shipKey('KeyW', false)
  const position = engine.snapshot().shipFlight!.flightPosition
  assert.ok(Math.abs(position.x) > Math.abs(position.z) * 4, JSON.stringify(position))
  engine.destroy()
})

test('benchmark routes lock targets, switch and cancel, and pause/views do not complete', () => {
  const { engine, clock } = makeEngine()
  engine.shipAction('enter'); engine.start(); clock.flush(1000)
  engine.shipAction('route:earth')
  let snap = engine.snapshot().shipFlight!
  assert.equal(snap.navigation.targetId, 'earth')
  assert.deepEqual(snap.navigation.route, { id: 'earth', phase: 'idle' })
  engine.shipAction('route:moon')
  snap = engine.snapshot().shipFlight!
  assert.equal(snap.navigation.targetId, 'moon')
  assert.deepEqual(snap.navigation.route, { id: 'moon', phase: 'idle' })
  engine.shipAction('route:saturn')
  assert.deepEqual(engine.snapshot().shipFlight!.navigation.route, { id: 'saturn', phase: 'idle' })
  engine.shipAction('clearTarget')
  assert.equal(engine.snapshot().shipFlight!.navigation.route, undefined)
  engine.shipAction('route:earth'); engine.shipAction('reset')
  assert.equal(engine.snapshot().shipFlight!.navigation.route, undefined)
  assert.equal(engine.snapshot().shipFlight!.navigation.targetId, undefined)
  engine.shipAction('route:earth')
  engine.shipKey('KeyW', true)
  let time = 1000
  for (let i = 0; i < 20; i++) clock.flush(time += 50)
  engine.shipKey('KeyW', false)
  const flying = engine.snapshot().shipFlight!
  assert.ok(flying.navigation.route?.phase === 'cruise' || flying.navigation.route?.phase === 'approach')
  assert.notEqual(flying.navigation.route?.phase, 'arrived')
  const phase = flying.navigation.route!.phase
  const world = (engine as any).world
  engine.setSimulationPaused(true)
  for (const mode of ['cockpit', 'free', 'follow'] as const) {
    engine.shipAction(mode)
    for (let i = 0; i < 10; i++) clock.flush(time += 50)
    const paused = engine.snapshot().shipFlight!
    assert.equal(paused.navigation.route?.phase, phase)
    assert.equal(paused.mode, mode)
    assert.equal((engine as any).world, world)
  }
  engine.setInputEnabled(false)
  for (let i = 0; i < 10; i++) clock.flush(time += 50)
  assert.equal(engine.snapshot().shipFlight!.navigation.route?.phase, phase)
  engine.setInputEnabled(true)
  engine.shipAction('target:mars')
  assert.equal(engine.snapshot().shipFlight!.navigation.route, undefined)
  engine.shipAction('route:saturn')
  engine.overview()
  engine.shipAction('enter')
  assert.deepEqual(engine.snapshot().shipFlight!.navigation.route, { id: 'saturn', phase: 'idle' })
  engine.destroy()
})

test('the parked model follows Earth; both map rendering and labels use its world position', () => {
  const { engine, clock } = makeEngine(), state = engine as any
  let shipPasses = 0
  state.ship.render = () => { shipPasses++ }
  engine.start(); clock.flush(1000)
  const before = engine.snapshot().ship!
  clock.flush(1050)
  const after = engine.snapshot().ship!, earth = state.bodies.get('earth').group.position
  assert.equal(shipPasses, 2)
  assert.notDeepEqual(after.position, before.position)
  assert.deepEqual(after.position, { x: earth.x, y: earth.y + 20, z: earth.z + 30 })
  assert.equal(after.parked, true); assert.equal(after.projected.visible, true)
  assert.equal(engine.snapshot().shipFlight, undefined)
  const camera = state.world.camera.position.clone()
  engine.zoomBy(-100); clock.flush(1100)
  assert.notDeepEqual(state.world.camera.position, camera)
  assert.equal(state.ship.model.cockpit, false)
  engine.destroy()
})

test('leaving cockpit preserves independent flight position, target and model while restoring the map camera', () => {
  const { engine, clock } = makeEngine(), state = engine as any
  const ship = state.ship, model = ship.model
  engine.shipAction('enter'); engine.shipAction('target:moon'); engine.start(); clock.flush(1000)
  engine.shipKey('KeyW', true)
  for (let i = 0; i < 12; i++) clock.flush(1050 + i * 50)
  engine.shipKey('KeyW', false); engine.setSimulationPaused(true)
  engine.shipAction('cockpit')
  const before = engine.snapshot().shipFlight!
  assert.equal(before.parked, false)
  engine.overview()
  assert.deepEqual(engine.snapshot().ship!.position, before.worldPosition)
  assert.equal(model.root.visible, true); assert.equal(model.cockpit, false)
  assert.equal(state.world.camera.fov, 11); assert.equal(state.world.camera.near, .2)
  assert.equal(engine.shipKey('KeyW', true), false)
  clock.flush(2000); engine.shipAction('enter')
  const after = engine.snapshot().shipFlight!
  assert.deepEqual(after.flightPosition, before.flightPosition); assert.deepEqual(after.worldPosition, before.worldPosition)
  assert.equal(after.navigation.targetId, 'moon'); assert.equal(ship.model, model)
  engine.destroy()
})

test('map suspension and retry reuse the ship and its world position instead of spawning another', () => {
  const { engine } = makeEngine(), state = engine as any, ship = state.ship
  const position = engine.snapshot().ship!.position
  const initial = ship.model.generation
  engine.setInputEnabled(false)
  assert.equal(engine.snapshot().ship!.suspended, true); assert.equal(ship.model.root.visible, false)
  assert.ok(ship.model.generation > initial)
  engine.setInputEnabled(true)
  assert.equal(engine.snapshot().ship!.suspended, false)
  const resumed = ship.model.generation
  ship.model.status = 'failed'
  engine.shipAction('retryModel')
  assert.ok(ship.model.generation > resumed); assert.equal((engine as any).ship, ship)
  assert.deepEqual(engine.snapshot().ship!.position, position)
  assert.equal(engine.snapshot().shipFlight, undefined); assert.equal(engine.snapshot().ship!.status, 'loading')
  engine.destroy()
})

test('clicking the actual projected ship enters its view without a replacement instance', () => {
  const { engine } = makeEngine(), state = engine as any, ship = state.ship
  ship.model.status = 'ready'; ship.model.render = () => {}
  const { x, y } = engine.snapshot().ship!.projected
  engine.handlePointerDown(x, y); engine.handlePointerUp(x, y)
  assert.ok(engine.snapshot().shipFlight); assert.equal(state.ship, ship)
  engine.destroy()
})
