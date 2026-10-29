import type { Vector3 } from 'three'
import { isMicrogravityCabin } from './microgravityCabinRuntime'
import { isCabinEvaAction, type CabinEvaAction } from '../../domain/cabinEvaControls'
import { ShipViewCamera, type ShipViewMode } from './shipViewCamera'
import { shipCabinOccupiesGate } from './shipCabinCamera'
import { insideMasterInnerSweep } from './shipCabinVolume'
import { ShipFlightSimulation } from '../../application/shipFlightSimulation'
import { ShipPreviewInput } from '../../input/shipPreviewInput'
import { SHIP_FLIGHT } from '../../domain/shipFlightModel'
import { cabinShipFrame } from '../../application/cabinShipFrame'
import { cloneShipFlightState, type ShipFlightState } from '../../domain/shipFlightModel'
import { ShipMouseSteering } from '../../domain/shipMouseSteering'
import { shipTargetInfo, type ShipNavigationBody } from '../../domain/shipNavigation'
import { stepNavigatedShip, shipBrakingRisk } from '../../domain/shipFlightSafety'
import { createShipRoute, isShipRouteId, observeShipRoute, stepShipRoute, type ShipRouteId, type ShipRouteState } from '../../domain/shipRoute'
import { isSystemBodyId, type SystemBodyId } from '../../domain/registry'
import { shipFeedback, type ShipFeedback } from '../../domain/shipFeedback'
import { add3, length3, scale3, sub3, type Vec3 } from '../../domain/vec3'
import { shipBerthPosition } from '../../domain/shipBerth'
import type { SystemMapWorld } from '../solar-system/systemMapWorld'
import { ShipModelRuntime } from './shipModelRuntime'
import { parseCabinEquipmentAction } from '../../domain/cabinEquipmentCatalog'
import { ShipFrameStats } from './shipFrameStats'
import { activateShipInteraction, createShipInteraction, isShipInteractionAnchor, selectShipInteraction,
  setShipSeated, stepShipInteraction, type ShipInteractionAnchor } from '../../domain/shipInteraction'

export type ShipFlightAction = 'enter' | 'follow' | 'cockpit' | 'cabin' | 'free' | 'reset' | 'retryModel'
  | 'zoomIn' | 'zoomOut' | 'cabinForward' | 'cabinBack' | 'cabinLeft' | 'cabinRight'
  | 'wave' | 'curl' | 'relax' | 'inspect' | 'lookAft' | 'cabinControls'
  | `eva:${CabinEvaAction}`
  | `equipment:${string}:${import('../../domain/cabinEquipmentCatalog').CabinEquipmentAction}`
  | 'assist' | 'clearTarget' | 'interact' | `anchor:${ShipInteractionAnchor}`
  | `target:${SystemBodyId}` | `route:${ShipRouteId}`
interface WorldBody { id: SystemBodyId; center: Vec3; radius: number }

export class ShipFlightRuntime {
  readonly input = new ShipPreviewInput()
  private flight = new ShipFlightSimulation()
  private steering = new ShipMouseSteering()
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
  private seatIntent=false
  private cabinFrameState?: ShipFlightState

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

  pause(paused: boolean) { this.userPaused = paused; this.flight.setPaused('user', paused); this.clear(); if(paused)this.model.cancelCabinAction() }
  suspend(paused: boolean, releaseResources = true) {
    this.suspended = paused; this.flight.setPaused('blur', paused); this.clear()
    if (paused) this.model.cancelCabinAction()
    if (releaseResources || !paused) this.model.suspend(paused)
    if (paused) this.frames.reset()
  }
  clear() { this.input.clear(); this.model.clearCabinInput(); this.flight.setInput({}); this.steering.clear() }
  measureFrame(time: number) {
    if (this.suspended || this.model.snapshot().status !== 'ready') this.frames.reset()
    else this.frames.frame(time)
  }
  orbit(dx: number, dy: number) {
    const mode = this.rig.snapshot().mode
    if (mode === 'free' || mode === 'cabin') { this.rig.orbit(-dx * .005, dy * .005); return }
    if (!this.active || this.userPaused || this.suspended || this.input.snapshot().stabilize
      || !Number.isFinite(dx) || !Number.isFinite(dy) || (!dx && !dy)) return
    this.assist = false
    this.steering.drag(this.flight.snapshot().state.orientation, dx, dy)
  }
  zoom(delta: number) { this.rig.zoom(delta * 0.025) }
  private canMoveCabin() { return !this.userPaused && !this.suspended && this.model.snapshot().status === 'ready' }
  private innerOpen() { return this.interaction.doors.inner.progress >= 1 - 1e-6 && this.interaction.doors.inner.target === 1 }
  pan(dx: number, dy: number) {
    if (!this.canMoveCabin()) return
    if (this.rig.snapshot().mode === 'cockpit') this.mode('cabin')
    if (this.model.snapshot().cabin) { this.orbit(dx, dy); return }
    this.rig.moveCabin(0, -dx * .003, dy * .003, this.innerOpen())
  }
  mode(mode: ShipViewMode) {
    this.clear()
    if(this.model.snapshot().cabin&&(mode==='cockpit'||mode==='cabin')&&!this.model.cabinSeat(mode==='cockpit')){
      this.rig.setMode('cabin');this.seatIntent=false;return
    }
    this.seatIntent=mode==='cockpit'&&!!this.model.snapshot().cabin&&!this.model.snapshot().cabin!.pilotReady
    if(this.seatIntent)mode='cabin'
    if (mode !== 'cabin'&&mode!=='cockpit') this.model.cancelCabinAction()
    this.rig.setMode(mode)
    if (mode === 'follow' || mode === 'cockpit') this.rig.centerLook()
    this.interaction = setShipSeated(this.interaction, mode === 'cockpit')
  }
  key(code: string, down: boolean) {
    if(code==='Escape'&&this.model.snapshot().cabin){if(down){this.seatIntent=false;this.model.cancelCabinAction(true)}return true}
    if (this.rig.snapshot().mode === 'cabin' && this.canMoveCabin() && this.model.cabinKey(code, down)) return true
    if (this.rig.snapshot().mode === 'cabin' && this.model.snapshot().cabin) {
      const action = { KeyE: 'door', KeyQ: 'wave', KeyG: 'curl', KeyH: 'relax' } as const
      if (code in action) {
        if (down && this.canMoveCabin()) this.model.cabinAction(action[code as keyof typeof action])
        return true
      }
    }
    const handled = this.input.key(code, down)
    if (down && handled && code === 'Space') { this.assist = false; this.steering.clear() }
    return handled
  }
  navigate(action: ShipFlightAction) {
    if (action === 'cabinControls') { if (this.canMoveCabin() && this.rig.snapshot().mode === 'cabin') this.model.cabinControls(); return }
    if (action.startsWith('equipment:')) {
      const command = parseCabinEquipmentAction(action)
      if (command && this.canMoveCabin() && this.rig.snapshot().mode === 'cabin') this.model.cabinEquipment(command.id, command.action)
    }
    else if (action.startsWith('eva:')) {
      const command = action.slice(4)
      if (this.canMoveCabin() && this.rig.snapshot().mode === 'cabin' && isCabinEvaAction(command)) this.model.cabinEva(command)
    }
    else if (action === 'zoomIn' || action === 'zoomOut') this.zoom(action === 'zoomIn' ? -200 : 200)
    else if (['cabinForward', 'cabinBack', 'cabinLeft', 'cabinRight'].includes(action)) {
      if (this.canMoveCabin()) {
        const forward=action === 'cabinForward' ? 1 : action === 'cabinBack' ? -1 : 0
        const right=action === 'cabinRight' ? 1 : action === 'cabinLeft' ? -1 : 0
        if (this.model.snapshot().cabin) this.model.cabinNudge(forward,right)
        else this.rig.moveCabin(forward*.3,right*.3,0,this.innerOpen())
      }
    }
    else if (action === 'lookAft') this.rig.lookAft()
    else if (action === 'wave' || action === 'curl' || action === 'relax' || action === 'inspect') {if(this.canMoveCabin())this.model.cabinAction(action)}
    else if (action === 'interact') this.interact()
    else if (action.startsWith('anchor:')) {
      const anchor = action.slice(7)
      if (isShipInteractionAnchor(anchor) && (!this.model.snapshot().currentFittedAssembly || this.model.snapshot().anchors.includes(anchor)))
        this.interaction = selectShipInteraction(this.interaction, anchor)
    }
    else if (action === 'clearTarget') { this.targetId = undefined; this.assist = false; this.route = undefined }
    else if (action === 'assist' && this.targetId) { this.steering.clear(); this.assist = !this.assist }
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
    if(this.userPaused||this.suspended)return
    if (this.model.snapshot().status !== 'ready') {
      this.interaction = { ...this.interaction, notice: '飞船模型尚未就绪' }
      return
    }
    const view = this.rig.snapshot()
    if (this.model.snapshot().cabin) {
      if(view.mode!=='cabin'&&view.mode!=='cockpit')this.mode('cabin')
      else {const mode=this.model.cabinInteract();if(mode)this.mode(mode)}
      return
    }
    if (this.model.snapshot().currentFittedAssembly && !this.model.snapshot().anchors.includes(this.interaction.activeAnchor)) {
      this.interaction = { ...this.interaction, notice: '当前模型未提供此交互' }; return
    }
    const volume = this.model.cabinVolume()
    const occupiesDoor = volume ? insideMasterInnerSweep(view.cabinPosition, volume) : shipCabinOccupiesGate(view.cabinPosition)
    if (view.mode === 'cabin' && this.interaction.activeAnchor === 'inner-door'
      && this.interaction.doors.inner.target === 1 && occupiesDoor) {
      this.interaction = { ...this.interaction, notice: '观察位置在门的活动范围内，请先移出门框及开门范围再关门' }
      return
    }
    const result = activateShipInteraction(this.interaction)
    this.interaction = result.state
    if (result.view) this.mode(result.view)
  }
  reset() {
    this.cabinFrameState = undefined
    this.seatIntent=false
    this.model.resetCabin()
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
      const result = stepNavigatedShip(state, this.steering.command(state, input), bodies, this.targetId, this.assist)
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
    const posture=this.model.snapshot().cabin
    if(this.seatIntent&&posture?.pilotReady){this.rig.setMode('cockpit');this.interaction=setShipSeated(this.interaction,true);this.seatIntent=false}
    else if(this.seatIntent&&posture?.posture==='standing'&&!posture.busy)this.seatIntent=false
    const moving = this.input.snapshot(), roaming = this.rig.snapshot().mode === 'cabin'
    const crew=this.model.snapshot().cabin
    const command = roaming || !this.active || crew&&!crew.pilotReady ? {} : moving
    if (this.active && !this.userPaused && !this.suspended && (moving.throttle || moving.strafe) && !roaming) this.parked = false
    const earth = worldObstacles.find(body => body.id === 'earth')
    if (this.parked && earth) this.origin = shipBerthPosition(earth.center)
    if (!this.model.snapshot().cabin && this.active && roaming && this.canMoveCabin() && Number.isFinite(dt) && dt > 0 && !moving.stabilize) {
      const time = Math.min(dt, .05), length = Math.max(1, Math.hypot(moving.throttle ?? 0, moving.strafe ?? 0))
      this.rig.moveCabin((moving.throttle ?? 0) * time / length, (moving.strafe ?? 0) * time / length, 0, this.innerOpen())
    }
    this.flight.setInput(command)
    const simulation = this.advanceNavigation(dt, worldObstacles)
    this.advanceRoute(!this.userPaused && !this.suspended)
    const state = this.contact ? simulation.state : simulation.renderPose
    this.feedback = shipFeedback(command, simulation.state, !this.userPaused && !this.suspended)
    this.interaction = stepShipInteraction(this.interaction, dt, !this.userPaused && !this.suspended)
    const look=this.rig.snapshot(),running=this.active&&!this.userPaused&&!this.suspended
    this.rig.setCrewPose(this.model.updateCabin(dt,
      {forward:moving.stabilize?0:moving.throttle??0,right:moving.stabilize?0:moving.strafe??0},look.yaw,look.pitch,
      this.active&&roaming,look.mode==='cockpit',running,cabinShipFrame(this.cabinFrameState,simulation.state,dt)))
    this.cabinFrameState = cloneShipFlightState(simulation.state)
    const obstacles = worldObstacles.map((item) => ({ center: sub3(item.center, this.origin), radius: item.radius }))
    const pose = this.rig.update(state, dt, obstacles)
    const cabinSnapshot = this.model.snapshot().cabin
    const outside = isMicrogravityCabin(cabinSnapshot) && cabinSnapshot.eva.location === 'outside'
    const inside = this.active && !outside && (pose.mode === 'cockpit' || pose.mode === 'cabin')
    const fov = inside ? pose.interiorFov : 55
    if (this.active && this.world.camera.fov !== fov) { this.world.camera.fov = fov; this.world.camera.updateProjectionMatrix() }
    this.model.update(state, this.origin, inside, !this.active || (!pose.blocked && (!pose.transitioning||pose.interiorTransition)),
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
      orientation: state.orientation, suspended: this.suspended, paused: this.userPaused,
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
  render() { this.model.render(this.world.renderer, this.world.camera, this.world.scene) }
  tryCabinButton(x: number, y: number, width: number, height: number) {
    return this.active && this.canMoveCabin() && this.rig.snapshot().mode === 'cabin'
      && this.model.hitCabinButton(this.world.camera,x,y,width,height)
  }
  destroy() {
    this.model.dispose()
    this.clear(); this.flight.destroy()
    Object.assign(this.world.camera, this.savedProjection)
    this.world.camera.updateProjectionMatrix()
  }
}
