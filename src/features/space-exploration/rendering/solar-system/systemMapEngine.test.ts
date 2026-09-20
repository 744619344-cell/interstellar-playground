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

function makeEngine(cameraPreview = false) {
  const renders: number[] = []
  const disposed: string[] = []
  const snapshots: any[] = []
  const canvas = { addEventListener() {}, removeEventListener() {} } as any
  const clock = new FakeClock()
  const engine = new SystemMapEngine(
    { canvas, width: 800, height: 600, pixelRatio: 1, textures, cameraPreview, onSnapshot: (snap) => snapshots.push(snap) },
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

test('camera preview is opt-in and reuses the world across repeated entry/exit', () => {
  const disabled = makeEngine()
  disabled.engine.previewAction('enter')
  assert.equal(disabled.engine.snapshot().cameraPreview, undefined)
  disabled.engine.destroy()
  const { engine, clock } = makeEngine(true)
  const world = (engine as any).world
  const children = world.scene.children.length
  const projection = { fov: world.camera.fov, near: world.camera.near }
  engine.start()
  for (let i = 0; i < 10; i++) {
    engine.previewAction('enter')
    assert.equal(world.scene.children.length, children + 1)
    assert.equal(world.camera.fov, 55)
    const previewRoot = world.scene.children.at(-1)
    let releases = 0
    let geometries = 0
    previewRoot.traverse((node: any) => {
      if (!node.geometry) return
      geometries++
      node.geometry.addEventListener('dispose', () => releases++)
    })
    engine.overview()
    assert.equal(world.scene.children.length, children)
    assert.ok(geometries >= 3)
    assert.equal(releases, geometries)
    assert.equal(world.camera.fov, projection.fov)
    assert.equal(world.camera.near, projection.near)
    assert.equal((engine as any).world, world)
    assert.equal(clock.queue.length, 1)
  }
  engine.destroy()
})

test('preview freezes on pause and suspension, clears held input, and keeps camera usable during user pause', () => {
  const { engine, clock } = makeEngine(true)
  engine.previewAction('enter'); engine.start(); clock.flush(1000)
  engine.previewKey('KeyW', true); clock.flush(1050)
  const running = engine.snapshot().cameraPreview!
  assert.ok(running.speed > 0)
  engine.setSimulationPaused(true)
  clock.flush(1100)
  const paused = engine.snapshot().cameraPreview!
  assert.deepEqual(paused.flightPosition, running.flightPosition)
  engine.previewAction('free')
  assert.equal(engine.snapshot().cameraPreview?.mode, 'free')
  engine.setSimulationPaused(false); clock.flush(1150)
  assert.ok(engine.snapshot().cameraPreview!.speed < running.speed)
  engine.previewKey('KeyW', true)
  engine.setInputEnabled(false); clock.flush(1200)
  assert.equal(engine.previewKey('KeyW', true), false)
  const suspended = engine.snapshot().cameraPreview!
  clock.flush(1250)
  assert.deepEqual(engine.snapshot().cameraPreview?.flightPosition, suspended.flightPosition)
  engine.setInputEnabled(true); clock.flush(1300)
  assert.equal(engine.snapshot().cameraPreview?.speed, 0)
  engine.destroy()
})

test('three view keyboard cycle preserves paused flight state and renderer', () => {
  const { engine, clock } = makeEngine(true)
  engine.previewAction('enter'); engine.start(); clock.flush(1000)
  engine.previewKey('KeyW', true); clock.flush(1050)
  engine.setSimulationPaused(true)
  const before = engine.snapshot().cameraPreview!
  const world = (engine as any).world
  let time = 1050
  for (const mode of ['cockpit', 'free', 'follow']) {
    engine.previewKey('KeyC', true); engine.previewKey('KeyC', false)
    for (let i = 0; i < 20; i++) clock.flush(time += 50)
    const after = engine.snapshot().cameraPreview!
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
  const { engine } = makeEngine(true)
  engine.previewAction('enter')
  engine.previewAction('cockpit')
  assert.equal(engine.snapshot().cameraPreview?.interaction.seated, true)
  engine.previewAction('free')
  assert.equal(engine.snapshot().cameraPreview?.interaction.seated, false)
  engine.previewAction('anchor:console')
  assert.equal(engine.snapshot().cameraPreview?.interaction.activeAnchor, 'console')
  const preview = (engine as any).preview
  let interactions = 0
  preview.interact = () => { interactions++ }
  assert.equal(engine.previewKey('KeyF', true), true)
  assert.equal(engine.previewKey('KeyF', false), true)
  assert.equal(interactions, 1)
  engine.previewAction('reset')
  assert.equal(engine.snapshot().cameraPreview?.interaction.activeAnchor, 'cockpit')
  assert.equal(engine.snapshot().cameraPreview?.interaction.seated, false)
  engine.destroy()
})

test('navigation locks targets, assists without thrust, survives view changes and clears on reset', () => {
  const { engine, clock } = makeEngine(true)
  engine.previewAction('enter'); engine.start(); clock.flush(1000)
  engine.previewAction('target:moon'); engine.previewAction('assist')
  let time = 1000
  for (let i = 0; i < 60; i++) clock.flush(time += 50)
  let snap = engine.snapshot().cameraPreview!
  assert.equal(snap.navigation.targetId, 'moon')
  assert.ok(snap.navigation.target)
  assert.equal(snap.speed, 0)
  assert.notDeepEqual(snap.orientation, { x: 0, y: 0, z: 0, w: 1 })
  engine.setSimulationPaused(true)
  const orientation = snap.orientation
  engine.previewAction('cockpit')
  for (let i = 0; i < 20; i++) clock.flush(time += 50)
  snap = engine.snapshot().cameraPreview!
  assert.equal(snap.navigation.targetId, 'moon')
  assert.deepEqual(snap.orientation, orientation)
  engine.previewAction('clearTarget')
  assert.equal(engine.snapshot().cameraPreview!.navigation.assist, false)
  assert.equal(engine.snapshot().cameraPreview!.navigation.target, undefined)
  engine.previewAction('target:saturn'); engine.previewAction('reset')
  assert.equal(engine.snapshot().cameraPreview!.navigation.targetId, undefined)
  engine.destroy()
})

test('direct lateral movement keeps guidance while explicit stop relinquishes it', () => {
  const { engine, clock } = makeEngine(true)
  engine.previewAction('enter'); engine.start(); clock.flush(1000)
  engine.previewAction('target:moon'); engine.previewAction('assist')
  let time = 1000
  engine.previewKey('KeyA', true)
  for (let i = 0; i < 10; i++) clock.flush(time += 50)
  engine.previewKey('KeyA', false)
  assert.equal(engine.snapshot().cameraPreview!.navigation.assist, true)
  assert.equal(engine.snapshot().cameraPreview!.navigation.targetId, 'moon')
  engine.previewKey('Space', true); engine.previewKey('Space', false)
  assert.equal(engine.snapshot().cameraPreview!.navigation.assist, false)
  engine.destroy()
})

test('mouse view determines direct forward movement direction', () => {
  const { engine, clock } = makeEngine(true)
  engine.previewAction('enter'); engine.previewAction('free'); engine.start(); clock.flush(1000)
  engine.handlePointerDown(100, 100)
  engine.handlePointerMove(414, 100)
  engine.handlePointerUp(414, 100)
  let time = 1000
  for (let i = 0; i < 20; i++) clock.flush(time += 50)
  engine.previewKey('KeyW', true)
  for (let i = 0; i < 20; i++) clock.flush(time += 50)
  engine.previewKey('KeyW', false)
  const position = engine.snapshot().cameraPreview!.flightPosition
  assert.ok(Math.abs(position.x) > Math.abs(position.z) * 4, JSON.stringify(position))
  engine.destroy()
})

test('benchmark routes lock targets, switch and cancel, and pause/views do not complete', () => {
  const { engine, clock } = makeEngine(true)
  engine.previewAction('enter'); engine.start(); clock.flush(1000)
  engine.previewAction('route:earth')
  let snap = engine.snapshot().cameraPreview!
  assert.equal(snap.navigation.targetId, 'earth')
  assert.deepEqual(snap.navigation.route, { id: 'earth', phase: 'idle' })
  engine.previewAction('route:moon')
  snap = engine.snapshot().cameraPreview!
  assert.equal(snap.navigation.targetId, 'moon')
  assert.deepEqual(snap.navigation.route, { id: 'moon', phase: 'idle' })
  engine.previewAction('route:saturn')
  assert.deepEqual(engine.snapshot().cameraPreview!.navigation.route, { id: 'saturn', phase: 'idle' })
  engine.previewAction('clearTarget')
  assert.equal(engine.snapshot().cameraPreview!.navigation.route, undefined)
  engine.previewAction('route:earth'); engine.previewAction('reset')
  assert.equal(engine.snapshot().cameraPreview!.navigation.route, undefined)
  assert.equal(engine.snapshot().cameraPreview!.navigation.targetId, undefined)
  engine.previewAction('route:earth')
  engine.previewKey('KeyW', true)
  let time = 1000
  for (let i = 0; i < 20; i++) clock.flush(time += 50)
  engine.previewKey('KeyW', false)
  const flying = engine.snapshot().cameraPreview!
  assert.ok(flying.navigation.route?.phase === 'cruise' || flying.navigation.route?.phase === 'approach')
  assert.notEqual(flying.navigation.route?.phase, 'arrived')
  const phase = flying.navigation.route!.phase
  const world = (engine as any).world
  engine.setSimulationPaused(true)
  for (const mode of ['cockpit', 'free', 'follow'] as const) {
    engine.previewAction(mode)
    for (let i = 0; i < 10; i++) clock.flush(time += 50)
    const paused = engine.snapshot().cameraPreview!
    assert.equal(paused.navigation.route?.phase, phase)
    assert.equal(paused.mode, mode)
    assert.equal((engine as any).world, world)
  }
  engine.setInputEnabled(false)
  for (let i = 0; i < 10; i++) clock.flush(time += 50)
  assert.equal(engine.snapshot().cameraPreview!.navigation.route?.phase, phase)
  engine.setInputEnabled(true)
  engine.previewAction('target:mars')
  assert.equal(engine.snapshot().cameraPreview!.navigation.route, undefined)
  engine.previewAction('route:saturn')
  engine.overview()
  engine.previewAction('enter')
  assert.equal(engine.snapshot().cameraPreview!.navigation.route, undefined)
  engine.destroy()
})
