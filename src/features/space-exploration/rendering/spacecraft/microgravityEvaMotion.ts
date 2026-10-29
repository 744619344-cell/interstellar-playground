import { Quaternion, Vector3, type Group } from 'three'
import { evaCabinPoint, evaCabinRotation, evaCabinVelocity, evaWorldPoint, evaWorldRotation, evaWorldVelocity, type EvaShipFrame } from '../../application/evaShipFrame'
import { createEvaMotion, stepEvaMotion, constrainEvaLine, EVA_MOTION, type EvaMotion, type EvaControls } from '../../domain/evaMotion'
import type { CabinFloatFrame, CabinFloatState } from '../../domain/cabinFloatMotion'
import type { Vec3 } from '../../domain/vec3'
import type { MicrogravityCrewRig } from '../astronaut/microgravityCrewRig'
import { MicrogravityRopeRoute } from './microgravityRopeRoute'
import type { MicrogravitySurfaces } from './microgravitySurfaces'
import type { MicrogravityTether } from './microgravityTether'

export interface MicroEvaSaved { motion?: EvaMotion; side?: 'L' | 'R'; fuel: number; lineLength: number }
const vector = (p: Vec3) => new Vector3(p.x, p.y, p.z)
const plain = (p: Vector3): Vec3 => ({ x: p.x, y: p.y, z: p.z })
const stationary: EvaShipFrame = { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 }, angularVelocity: { x: 0, y: 0, z: 0 } }

/** World-inertial flight, finite game RCS and a source-edge contact cable. */
export class MicrogravityEvaMotion {
  private route: MicrogravityRopeRoute
  private motion?: EvaMotion
  private side?: 'L' | 'R'
  private fuel = 1
  private lineLength: number = EVA_MOTION.maxLine
  private points: Vector3[] = []
  private failedFor = 0
  notice = ''
  constructor(model: Group, private surfaces: MicrogravitySurfaces, private tether: MicrogravityTether, saved?: MicroEvaSaved) {
    this.route = new MicrogravityRopeRoute(model, surfaces)
    if (saved) { this.motion = saved.motion ? structuredClone(saved.motion) : undefined; this.side = saved.side; this.fuel = saved.fuel; this.lineLength = saved.lineLength }
  }
  private attachment(rig: MicrogravityCrewRig) {
    if (!this.side) this.side = rig.harness('L').distanceToSquared(this.tether.anchor) < rig.harness('R').distanceToSquared(this.tether.anchor) ? 'L' : 'R'
    return rig.harness(this.side)
  }
  sync(rig: MicrogravityCrewRig, attached: boolean, seconds = 0) {
    if (!attached) { this.route.reset(); this.side = undefined; this.points = []; this.tether.update(undefined); return true }
    const end = this.attachment(rig)
    this.failedFor = Math.max(0, this.failedFor - seconds)
    if (this.failedFor > 0) return false
    const clear = this.route.update(this.tether.anchor, end)
    if (!clear) { this.failedFor = .2; this.notice = '安全绳路径被结构挡住，请沿原路退回'; return false }
    this.points = this.route.path(this.tether.anchor, end)
    this.tether.update(end, this.points); return true
  }
  private prefix() { return this.points.slice(1, -1).reduce((sum, p, i) => sum + p.distanceTo(this.points[i]), 0) }
  private anchor(frame: EvaShipFrame, dt: number) {
    const local = this.points[this.points.length - 2] ?? this.tether.anchor, velocity = evaWorldVelocity(frame, local, { x: 0, y: 0, z: 0 })
    return { position: plain(vector(evaWorldPoint(frame, local)).addScaledVector(vector(velocity), -dt)), velocity }
  }
  private start(state: CabinFloatState, rig: MicrogravityCrewRig, frame: EvaShipFrame) {
    const end = this.attachment(rig), offset = end.clone().sub(vector(state.position)), spin = vector(state.angularVelocity).applyQuaternion(new Quaternion().copy(state.orientation))
    this.motion = { ...createEvaMotion(evaWorldPoint(frame, end)), orientation: evaWorldRotation(frame, state.orientation), angularVelocity: { ...state.angularVelocity }, fuel: this.fuel,
      velocity: evaWorldVelocity(frame, end, plain(vector(state.velocity).add(spin.cross(offset)))), lineLength: Math.max(.8, this.lineLength - this.prefix()) }
  }
  step(state: CabinFloatState, rig: MicrogravityCrewRig, input: EvaControls, frameInput: CabinFloatFrame, dt: number): CabinFloatState {
    const frame = frameInput.shipPose ?? stationary
    if (!this.motion) this.start(state, rig, frame)
    const before = this.motion!, prefix = this.prefix(), end = this.attachment(rig), localOffset = end.clone().sub(vector(state.position)).applyQuaternion(new Quaternion().copy(state.orientation).invert())
    let next = stepEvaMotion({ ...before, lineLength: Math.max(.8, Math.min(8, this.lineLength - prefix)) }, input, this.anchor(frame, dt), dt)
    this.lineLength = Math.min(8, next.lineLength + prefix); this.fuel = next.fuel
    const orientation = evaCabinRotation(frame, next.orientation), offset = localOffset.applyQuaternion(new Quaternion().copy(orientation)), proposed = vector(evaCabinPoint(frame, next.position)).sub(offset)
    const velocity = evaCabinVelocity(frame, proposed, next.velocity), hit = this.surfaces.translate(rig.bodyPoints(), state.position, proposed, velocity, state.contact)
    let result = { ...state, contact: undefined, position: plain(vector(hit.position)), velocity: plain(vector(hit.velocity)), orientation, angularVelocity: { ...next.angularVelocity } }
    const attachment = vector(result.position).add(offset)
    if (!this.route.update(this.tether.anchor, attachment)) { this.motion = before; this.notice = '绳索遇到结构，请退回并调整方向'; return { ...state, velocity: { x: 0, y: 0, z: 0 } } }
    this.points = this.route.path(this.tether.anchor, attachment)
    const newPrefix = this.prefix()
    if (newPrefix + .8 > this.lineLength) { this.motion = before; this.notice = '安全绳转折余量不足，请退回'; return { ...state, velocity: { x: 0, y: 0, z: 0 } } }
    next = { ...next, position: evaWorldPoint(frame, attachment), velocity: evaWorldVelocity(frame, result.position, result.velocity), lineLength: this.lineLength - newPrefix }
    const constraint = this.anchor(frame, 0); next = constrainEvaLine(next, constraint)
    const corrected = vector(evaCabinPoint(frame, next.position)).sub(offset)
    const swept = this.surfaces.translate(rig.bodyPoints().map(p => p.clone().add(vector(result.position).sub(vector(state.position)))), result.position, corrected, evaCabinVelocity(frame, corrected, next.velocity))
    result = { ...result, position: plain(vector(swept.position)), velocity: plain(vector(swept.velocity)) }
    this.motion = { ...next, position: evaWorldPoint(frame, vector(result.position).add(offset)), velocity: evaWorldVelocity(frame, result.position, result.velocity) }
    return result
  }
  reconcile(state: CabinFloatState, rig: MicrogravityCrewRig, frameInput: CabinFloatFrame, attached: boolean) {
    if (!attached || state.contact) { this.motion = undefined; return }
    if (!this.motion) return
    const frame = frameInput.shipPose ?? stationary
    this.motion = { ...this.motion, position: evaWorldPoint(frame, this.attachment(rig)), orientation: evaWorldRotation(frame, state.orientation), angularVelocity: { ...state.angularVelocity } }
  }
  get clear() { return this.route.clear && this.failedFor === 0 }
  cord() { return this.points.flatMap((p, i) => { if (!i) return [p.clone()]; const a = this.points[i - 1], count = Math.max(1, Math.ceil(a.distanceTo(p) / .02)); return Array.from({ length: count }, (_, k) => a.clone().lerp(p, (k + 1) / count)) }) }
  save(): MicroEvaSaved { return { motion: this.motion ? structuredClone(this.motion) : undefined, side: this.side, fuel: this.fuel, lineLength: this.lineLength } }
  snapshot() { return { fuel: this.fuel, lineLength: this.lineLength, taut: this.motion?.taut ?? false, clear: this.clear, deployed: this.points.slice(1).reduce((sum, p, i) => sum + p.distanceTo(this.points[i]), 0) } }
  reset() { this.motion = undefined; this.side = undefined; this.fuel = 1; this.lineLength = 8; this.points = []; this.route.reset(); this.tether.update(undefined) }
  dispose() { this.route.dispose(); this.points = [] }
}
