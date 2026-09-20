import { ConeGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three'
import { ShipViewCamera, type ShipViewMode } from './shipViewCamera'
import { ShipFlightSimulation } from '../../application/shipFlightSimulation'
import { ShipPreviewInput } from '../../input/shipPreviewInput'
import { SHIP_FLIGHT } from '../../domain/shipFlightModel'
import { shipTargetInfo, type ShipNavigationBody } from '../../domain/shipNavigation'
import { stepNavigatedShip, shipBrakingRisk } from '../../domain/shipFlightSafety'
import { createShipRoute, isShipRouteId, observeShipRoute, stepShipRoute, type ShipRouteId, type ShipRouteState } from '../../domain/shipRoute'
import { isSystemBodyId, type SystemBodyId } from '../../domain/registry'
import { rotateShipVector } from '../../domain/shipFlightMath'
import { shipFeedback, type ShipFeedback } from '../../domain/shipFeedback'
import { createThrusterVisuals, updateThrusterVisuals } from './shipThrusterVisuals'
import { add3, length3, normalize3, scale3, sub3, type Vec3 } from '../../domain/vec3'
import type { SystemMapWorld } from '../solar-system/systemMapWorld'
import { disposeObject } from '../voyageResources'
import { ShipModelRuntime } from './shipModelRuntime'
import { activateShipInteraction, createShipInteraction, isShipInteractionAnchor, selectShipInteraction,
  setShipSeated, stepShipInteraction, type ShipInteractionAnchor } from '../../domain/shipInteraction'

export type ShipPreviewAction = 'enter' | 'follow' | 'cockpit' | 'free' | 'reset' | 'obstacle'
  | 'assist' | 'clearTarget' | 'safety' | 'interact' | `anchor:${ShipInteractionAnchor}`
  | `target:${SystemBodyId}` | `route:${ShipRouteId}`
interface WorldBody { id: SystemBodyId; center: Vec3; radius: number }

export class ShipCameraPreview {
  readonly input = new ShipPreviewInput()
  private flight = new ShipFlightSimulation()
  private rig = new ShipViewCamera(this.flight.snapshot().state)
  private root = new Group()
  private marker = new Group()
  private seat = { x: 0, y: 0.8, z: -2 }
  private model = new ShipModelRuntime(seat => { this.seat = seat; this.rig.setSeat(seat, -0.35) })
  private thrusters = createThrusterVisuals()
  private obstacle = new Mesh(new SphereGeometry(2, 24, 16), new MeshStandardMaterial({ color: 0xefac55, wireframe: true }))
  private origin: Vec3
  private obstacleCenter?: Vec3
  private userPaused = false
  private suspended = false
  private savedProjection: { fov: number; near: number }
  private targetId?: SystemBodyId
  private assist = false
  private navigationBodies: ShipNavigationBody[] = []
  private contact?: string
  private contactSeconds = 0
  private safetyObstacle = false
  private route?: ShipRouteState
  private interaction = createShipInteraction()
  private feedback: ShipFeedback = shipFeedback({}, this.flight.snapshot().state, false)

  constructor(private world: SystemMapWorld, origin: Vec3) {
    this.origin = { ...origin }
    this.savedProjection = { fov: world.camera.fov, near: world.camera.near }
    const body = new Mesh(new SphereGeometry(1.5, 20, 12), new MeshStandardMaterial({ color: 0xbadce5, metalness: 0.4, roughness: 0.35 }))
    const arrow = new Mesh(new ConeGeometry(1, 4, 12), new MeshStandardMaterial({ color: 0x21dff1, emissive: 0x053540 }))
    arrow.rotation.x = -Math.PI / 2
    arrow.position.z = -3
    this.marker.add(body, arrow, this.thrusters.root)
    this.root.add(this.marker, this.obstacle)
    this.root.position.set(origin.x, origin.y, origin.z)
    this.obstacle.visible = false
    world.scene.add(this.root)
    world.camera.fov = 55
    world.camera.near = 0.05
    world.camera.updateProjectionMatrix()
    this.update(1 / 120, [])
  }

  pause(paused: boolean) { this.userPaused = paused; this.flight.setPaused('user', paused); this.input.clear() }
  suspend(paused: boolean) { this.suspended = paused; this.flight.setPaused('blur', paused); this.input.clear() }
  clear() { this.input.clear(); this.flight.setInput({}) }
  orbit(dx: number, dy: number) { this.rig.orbit(-dx * 0.005, dy * 0.005) }
  zoom(delta: number) { this.rig.zoom(delta * 0.025) }
  mode(mode: ShipViewMode) {
    this.rig.setMode(mode)
    this.interaction = setShipSeated(this.interaction, mode === 'cockpit')
  }
  key(code: string, down: boolean) {
    const handled = this.input.key(code, down)
    if (down && handled && code === 'Space') this.assist = false
    return handled
  }
  navigate(action: ShipPreviewAction) {
    if (action === 'interact') this.interact()
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
    else if (action === 'safety') {
      this.safetyObstacle = !this.safetyObstacle
      const state = this.flight.snapshot().state
      this.obstacleCenter = this.safetyObstacle
        ? add3(state.position, scale3(rotateShipVector(state.orientation, { x: 0, y: 0, z: -1 }), 12)) : undefined
      this.obstacle.visible = !!this.obstacleCenter
      if (this.obstacleCenter) this.obstacle.position.copy(this.obstacleCenter as Vector3)
    }
  }
  interact() {
    if (this.model.snapshot().status !== 'ready') {
      this.interaction = { ...this.interaction, notice: '飞船模型尚未就绪' }
      return
    }
    const result = activateShipInteraction(this.interaction)
    this.interaction = result.state
    if (result.view) this.rig.setMode(result.view)
  }
  reset() {
    this.flight.destroy()
    this.flight = new ShipFlightSimulation()
    this.flight.setPaused('user', this.userPaused)
    this.flight.setPaused('blur', this.suspended)
    this.rig = new ShipViewCamera(this.flight.snapshot().state, this.seat)
    if (this.model.snapshot().status === 'ready') this.rig.setSeat(this.seat, -0.35)
    this.clear()
    this.obstacleCenter = undefined
    this.obstacle.visible = false
    this.targetId = undefined; this.assist = false; this.contact = undefined; this.contactSeconds = 0
    this.safetyObstacle = false; this.route = undefined
    this.interaction = createShipInteraction()
  }
  toggleObstacle() {
    this.safetyObstacle = false
    if (this.obstacleCenter) this.obstacleCenter = undefined
    else {
      const pose = this.rig.snapshot()
      this.obstacleCenter = add3(pose.target, scale3(normalize3(sub3(pose.position, pose.target)), 10))
    }
    this.obstacle.visible = !!this.obstacleCenter
    if (this.obstacleCenter) this.obstacle.position.copy(this.obstacleCenter as Vector3)
  }

  private advanceNavigation(dt: number, worldBodies: readonly WorldBody[]) {
    const old = new Map(this.navigationBodies.map((b) => [b.id, b]))
    this.navigationBodies = worldBodies.map((b) => {
      const center = sub3(b.center, this.origin)
      const prior = old.get(b.id)
      return { ...b, center, velocity: prior && dt > 0 ? scale3(sub3(center, prior.center), 1 / dt) : { x: 0, y: 0, z: 0 } }
    })
    if (this.obstacleCenter) this.navigationBodies.push({ id: 'test-obstacle', center: this.obstacleCenter,
      radius: 2, velocity: { x: 0, y: 0, z: 0 } })
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
    const command = this.input.snapshot()
    this.flight.setInput(command)
    const simulation = this.advanceNavigation(dt, worldObstacles)
    this.advanceRoute(!this.userPaused && !this.suspended)
    const state = this.contact ? simulation.state : simulation.renderPose
    this.feedback = shipFeedback(command, simulation.state, !this.userPaused && !this.suspended)
    this.interaction = stepShipInteraction(this.interaction, dt, !this.userPaused && !this.suspended)
    updateThrusterVisuals(this.thrusters, this.feedback)
    this.marker.position.copy(state.position as Vector3)
    this.marker.quaternion.set(state.orientation.x, state.orientation.y, state.orientation.z, state.orientation.w)
    const obstacles = worldObstacles.map((item) => ({ center: sub3(item.center, this.origin), radius: item.radius }))
    if (this.obstacleCenter) obstacles.push({ center: this.obstacleCenter, radius: 2 })
    const pose = this.rig.update(state, dt, obstacles)
    const fov = pose.mode === 'cockpit' && this.model.snapshot().status === 'ready' ? 75 : 55
    if (this.world.camera.fov !== fov) { this.world.camera.fov = fov; this.world.camera.updateProjectionMatrix() }
    this.marker.visible = this.model.snapshot().status !== 'ready' && !pose.blocked && pose.mode !== 'cockpit' && !pose.transitioning
    this.model.update(state, this.origin, pose.mode === 'cockpit', !pose.blocked && !pose.transitioning,
      this.feedback.forward, this.interaction)
    if (!pose.blocked) {
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
      orientation: state.orientation, obstacle: !!this.obstacleCenter, suspended: this.suspended,
      navigation: { targetId: this.targetId, assist: this.assist, safetyObstacle: this.safetyObstacle,
        target: shipTargetInfo(state, this.navigationBodies.find((b) => b.id === this.targetId)),
        risk: shipBrakingRisk(state, this.navigationBodies), contact: this.contact,
        route: this.route ? { ...this.route } : undefined },
      feedback: { ...this.feedback }, model: this.model.snapshot(),
      interaction: { ...this.interaction, doors: { inner: { ...this.interaction.doors.inner },
        outer: { ...this.interaction.doors.outer } } },
      resources: { ...this.world.renderer.info.memory, programs: this.world.renderer.info.programs?.length ?? 0 } }
  }
  render() { this.model.render(this.world.renderer, this.world.camera) }
  destroy() {
    this.model.dispose()
    this.clear(); this.flight.destroy(); this.root.removeFromParent(); disposeObject(this.root)
    Object.assign(this.world.camera, this.savedProjection)
    this.world.camera.updateProjectionMatrix()
  }
}
