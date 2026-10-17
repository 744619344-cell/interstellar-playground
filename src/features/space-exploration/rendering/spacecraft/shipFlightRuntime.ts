import type { Vector3 } from 'three'
import { ShipViewCamera, type ShipViewMode } from './shipViewCamera'
import { shipCabinOccupiesGate } from './shipCabinCamera'
import { insideMasterInnerSweep } from './shipCabinVolume'
import { ShipFlightSimulation } from '../../application/shipFlightSimulation'
import { ShipPreviewInput } from '../../input/shipPreviewInput'
import { SHIP_FLIGHT } from '../../domain/shipFlightModel'
import { shipTargetInfo, type ShipNavigationBody } from '../../domain/shipNavigation'
import { stepNavigatedShip, shipBrakingRisk } from '../../domain/shipFlightSafety'
import { createShipRoute, isShipRouteId, observeShipRoute, stepShipRoute, type ShipRouteId, type ShipRouteState } from '../../domain/shipRoute'
import { isSystemBodyId, type SystemBodyId } from '../../domain/registry'
import { shipFeedback, type ShipFeedback } from '../../domain/shipFeedback'
import { add3, length3, scale3, sub3, type Vec3 } from '../../domain/vec3'
import { shipBerthPosition } from '../../domain/shipBerth'
import type { SystemMapWorld } from '../solar-system/systemMapWorld'
import { ShipModelRuntime } from './shipModelRuntime'
import { ShipFrameStats } from './shipFrameStats'
import { activateShipInteraction, createShipInteraction, isShipInteractionAnchor, selectShipInteraction,
  setShipSeated, stepShipInteraction, type ShipInteractionAnchor } from '../../domain/shipInteraction'

export type ShipFlightAction = 'enter' | 'follow' | 'cockpit' | 'cabin' | 'free' | 'reset' | 'retryModel'
  | 'zoomIn' | 'zoomOut' | 'cabinForward' | 'cabinBack' | 'cabinLeft' | 'cabinRight'
  | 'assist' | 'clearTarget' | 'interact' | `anchor:${ShipInteractionAnchor}`
  | `target:${SystemBodyId}` | `route:${ShipRouteId}`
interface WorldBody { id: SystemBodyId; center: Vec3; radius: number }

export class ShipFlightRuntime {
  readonly input = new ShipPreviewInput()
  private flight = new ShipFlightSimulation()
  private rig = new ShipViewCamera(this.flight.snapshot().state)
  private active = false
  private parked = true
  private seat = { x: 0, y: 0.8, z: -2 }
  private seatPitch = -0.35
  private standing?: Vec3
  private frames = new ShipFrameStats()
  private model = new ShipModelRuntime((seat, pitch, standing) => {
    this.seat = seat; this.standing = standing; this.seatPitch = pitch ?? -0.35; this.rig.setSeat(seat, this.seatPitch, standing)
    this.rig.setCabinObstacles(this.model.cabinObstacles()); this.rig.setCabinVolume(this.model.cabinVolume()); this.frames.reset()
  })
  private origin: Vec3
  private userPaused = false
  private suspended = false
  private savedProjection: { fov: number; near: number }
  private targetId?: SystemBodyId
  private assist = false
  private navigationBodies: ShipNavigationBody[] = []
  private contact?: string
  private contactSeconds = 0
  private route?: ShipRouteState
  private interaction = createShipInteraction()
  private feedback: ShipFeedback = shipFeedback({}, this.flight.snapshot().state, false)
  private graphicsBackend?: string

  constructor(private world: SystemMapWorld, earth: Vec3) {
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      const gl = world.renderer.getContext()
      const debug = gl.getExtension('WEBGL_debug_renderer_info')
      this.graphicsBackend = String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER))
    }
    this.origin = shipBerthPosition(earth)
    this.savedProjection = { fov: world.camera.fov, near: world.camera.near }
  }

  setActive(active: boolean) {
    this.active = active; this.clear()
    Object.assign(this.world.camera, active ? { fov: 55, near: .05 } : this.savedProjection)
    this.world.camera.updateProjectionMatrix()
  }
  retryModel() {
    if (this.suspended || this.model.snapshot().status !== 'failed') return
    this.model.suspend(true); this.model.suspend(false)
  }

  pause(paused: boolean) { this.userPaused = paused; this.flight.setPaused('user', paused); this.input.clear() }
  suspend(paused: boolean) {
    this.suspended = paused; this.flight.setPaused('blur', paused); this.input.clear(); this.model.suspend(paused)
    if (paused) this.frames.reset()
  }
  clear() { this.input.clear(); this.flight.setInput({}) }
  measureFrame(time: number) {
    if (this.suspended || this.model.snapshot().status !== 'ready') this.frames.reset()
    else this.frames.frame(time)
  }
  orbit(dx: number, dy: number) { this.rig.orbit(-dx * 0.005, dy * 0.005) }
  zoom(delta: number) { this.rig.zoom(delta * 0.025) }
  private canMoveCabin() { return !this.userPaused && !this.suspended && this.model.snapshot().status === 'ready' }
  private innerOpen() { return this.interaction.doors.inner.progress >= 1 - 1e-6 && this.interaction.doors.inner.target === 1 }
  pan(dx: number, dy: number) {
    if (!this.canMoveCabin()) return
    if (this.rig.snapshot().mode === 'cockpit') this.mode('cabin')
    this.rig.moveCabin(0, -dx * .003, dy * .003, this.innerOpen())
  }
  mode(mode: ShipViewMode) {
    this.clear()
    this.rig.setMode(mode)
    this.interaction = setShipSeated(this.interaction, mode === 'cockpit')
  }
  key(code: string, down: boolean) {
    const handled = this.input.key(code, down)
    if (down && handled && code === 'Space') this.assist = false
    return handled
  }
  navigate(action: ShipFlightAction) {
    if (action === 'zoomIn' || action === 'zoomOut') this.zoom(action === 'zoomIn' ? -200 : 200)
    else if (['cabinForward', 'cabinBack', 'cabinLeft', 'cabinRight'].includes(action)) {
      if (this.canMoveCabin()) this.rig.moveCabin(action === 'cabinForward' ? .3 : action === 'cabinBack' ? -.3 : 0,
        action === 'cabinRight' ? .3 : action === 'cabinLeft' ? -.3 : 0, 0, this.innerOpen())
    }
    else if (action === 'interact') this.interact()
    else if (action.startsWith('anchor:')) {
      const anchor = action.slice(7)
      if (isShipInteractionAnchor(anchor)) this.interaction = selectShipInteraction(this.interaction, anchor)
    }
    else if (action === 'clearTarget') { this.targetId = undefined; this.assist = false; this.route = undefined }
    else if (action === 'assist' && this.targetId) this.assist = !this.assist
    else if (action.startsWith('route:')) {
      const id = action.slice(6)
      if (isShipRouteId(id)) { this.targetId = id; this.route = createShipRoute(id) }
    }
    else if (action.startsWith('target:') && isSystemBodyId(action.slice(7))) {
      this.targetId = action.slice(7) as SystemBodyId
      if (this.route && this.route.id !== this.targetId) this.route = undefined
    }
  }
  interact() {
    if (this.model.snapshot().status !== 'ready') {
      this.interaction = { ...this.interaction, notice: '飞船模型尚未就绪' }
      return
    }
    const view = this.rig.snapshot()
    const volume = this.model.cabinVolume()
    const occupiesDoor = volume ? insideMasterInnerSweep(view.cabinPosition, volume) : shipCabinOccupiesGate(view.cabinPosition)
    if (view.mode === 'cabin' && this.interaction.activeAnchor === 'inner-door'
      && this.interaction.doors.inner.target === 1 && occupiesDoor) {
      this.interaction = { ...this.interaction, notice: '观察位置在门的活动范围内，请先移出门框及开门范围再关门' }
      return
    }
    const result = activateShipInteraction(this.interaction)
    this.interaction = result.state
    if (result.view) { this.clear(); this.rig.setMode(result.view) }
  }
  reset() {
    this.flight.destroy()
    this.flight = new ShipFlightSimulation()
    this.flight.setPaused('user', this.userPaused)
    this.flight.setPaused('blur', this.suspended)
    this.rig = new ShipViewCamera(this.flight.snapshot().state, this.seat)
    if (this.model.snapshot().status === 'ready') this.rig.setSeat(this.seat, this.seatPitch, this.standing)
    this.rig.setCabinObstacles(this.model.cabinObstacles()); this.rig.setCabinVolume(this.model.cabinVolume())
    this.clear()
    this.parked = true
    this.targetId = undefined; this.assist = false; this.contact = undefined; this.contactSeconds = 0
    this.route = undefined
    this.interaction = createShipInteraction()
  }
  private advanceNavigation(dt: number, worldBodies: readonly WorldBody[]) {
    const old = new Map(this.navigationBodies.map((b) => [b.id, b]))
    this.navigationBodies = worldBodies.map((b) => {
      const center = sub3(b.center, this.origin)
      const prior = old.get(b.id)
      return { ...b, center, velocity: prior && dt > 0 ? scale3(sub3(center, prior.center), 1 / dt) : { x: 0, y: 0, z: 0 } }
    })
    const fraction = this.flight.snapshot().alpha * SHIP_FLIGHT.stepSeconds
    let offset = -dt - fraction
    if (!this.userPaused && !this.suspended) this.contactSeconds = Math.max(0, this.contactSeconds - dt)
    if (!this.contactSeconds) this.contact = undefined
    return this.flight.advance(dt, (state, input) => {
      const bodies = this.navigationBodies.map((b) => ({ ...b, center: add3(b.center, scale3(b.velocity, offset)) }))
      offset += SHIP_FLIGHT.stepSeconds
      const result = stepNavigatedShip(state, input, bodies, this.targetId, this.assist, this.rig.movementBasis())
      if (result.contact) { this.contact = result.contact; this.contactSeconds = 0.8 }
      return result.state
    })
  }

  private advanceRoute(advanced: boolean) {
    if (!this.route) return
    const body = this.navigationBodies.find((item) => item.id === this.route!.id)
    this.route = stepShipRoute(this.route, observeShipRoute(this.flight.snapshot().state, body), advanced)
  }

  update(dt: number, worldObstacles: readonly WorldBody[]) {
    const moving = this.input.snapshot(), roaming = this.rig.snapshot().mode === 'cabin'
    const command = roaming || !this.active ? {} : moving
    if (this.active && !this.userPaused && !this.suspended && (moving.throttle || moving.strafe) && !roaming) this.parked = false
    const earth = worldObstacles.find(body => body.id === 'earth')
    if (this.parked && earth) this.origin = shipBerthPosition(earth.center)
    if (this.active && roaming && this.canMoveCabin() && Number.isFinite(dt) && dt > 0 && !moving.stabilize) {
      const time = Math.min(dt, .05), length = Math.max(1, Math.hypot(moving.throttle ?? 0, moving.strafe ?? 0))
      this.rig.moveCabin((moving.throttle ?? 0) * time / length, (moving.strafe ?? 0) * time / length, 0, this.innerOpen())
    }
    this.flight.setInput(command)
    const simulation = this.advanceNavigation(dt, worldObstacles)
    this.advanceRoute(!this.userPaused && !this.suspended)
    const state = this.contact ? simulation.state : simulation.renderPose
    this.feedback = shipFeedback(command, simulation.state, !this.userPaused && !this.suspended)
    this.interaction = stepShipInteraction(this.interaction, dt, !this.userPaused && !this.suspended)
    const obstacles = worldObstacles.map((item) => ({ center: sub3(item.center, this.origin), radius: item.radius }))
    const pose = this.rig.update(state, dt, obstacles)
    const inside = this.active && (pose.mode === 'cockpit' || pose.mode === 'cabin')
    const fov = inside ? pose.interiorFov : 55
    if (this.active && this.world.camera.fov !== fov) { this.world.camera.fov = fov; this.world.camera.updateProjectionMatrix() }
    this.model.update(state, this.origin, inside, !this.active || (!pose.blocked && !pose.transitioning),
      this.feedback.forward, this.interaction)
    if (this.active && !pose.blocked) {
      this.world.camera.position.copy(add3(this.origin, pose.position) as Vector3)
      this.world.camera.up.copy(pose.up as Vector3)
      const target = add3(this.origin, pose.target)
      this.world.camera.lookAt(target.x, target.y, target.z)
    }
    return this.snapshot()
  }

  snapshot() {
    const state = this.flight.snapshot().state
    return { ...this.rig.snapshot(), speed: length3(state.velocity), flightPosition: state.position,
      worldPosition: add3(this.origin, state.position), parked: this.parked,
      orientation: state.orientation, suspended: this.suspended,
      navigation: { targetId: this.targetId, assist: this.assist,
        target: shipTargetInfo(state, this.navigationBodies.find((b) => b.id === this.targetId)),
        risk: shipBrakingRisk(state, this.navigationBodies), contact: this.contact,
        route: this.route ? { ...this.route } : undefined },
      feedback: { ...this.feedback }, model: this.model.snapshot(), frames: this.frames.snapshot(),
      windowFocused: typeof document === 'undefined' || document.hasFocus(),
      graphicsBackend: this.graphicsBackend,
      interaction: { ...this.interaction, doors: { inner: { ...this.interaction.doors.inner },
        outer: { ...this.interaction.doors.outer } } },
      resources: { ...this.world.renderer.info.memory, programs: this.world.renderer.info.programs?.length ?? 0 } }
  }
  render() { this.model.render(this.world.renderer, this.world.camera) }
  destroy() {
    this.model.dispose()
    this.clear(); this.flight.destroy()
    Object.assign(this.world.camera, this.savedProjection)
    this.world.camera.updateProjectionMatrix()
  }
}
