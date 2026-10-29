import { add3, sub3, scale3, dot3, cross3, length3, normalize3, distance3, type Vec3 } from './vec3'
import { integrateShipRotation, normalizeRotation, rotateShipVector, type ShipQuaternion } from './shipFlightMath'

export interface FloatContact { id: string; point: Vec3; normal: Vec3; kind?: 'handrail' }
export interface CabinFloatState {
  /** Body reference point, in metres in the cabin frame. */
  position: Vec3; velocity: Vec3; orientation: ShipQuaternion
  /** Inertial angular velocity, expressed in the body's own axes (isotropic-body approximation). */
  angularVelocity: Vec3; contact?: FloatContact; contactSeconds: number; fixed?: string; notice: string
}
export interface CabinFloatFrame { acceleration?: Vec3; angularVelocity?: Vec3; angularAcceleration?: Vec3;
  shipPose?: { position: Vec3; velocity: Vec3; orientation: ShipQuaternion; angularVelocity: Vec3 } }
export interface CabinFloatInput { forward?: number; right?: number; up?: number; pitch?: number; yaw?: number; roll?: number; push?: boolean }
export type FloatCollision = (from: Vec3, proposed: Vec3, velocity: Vec3) => { position: Vec3; velocity: Vec3 }
export const CABIN_FLOAT = Object.freeze({ pushSpeed: .52, contactTolerance: .012, catchSpeed: .65, bodyReach: 1.05, angularRate: .45 })
const zero = (): Vec3 => ({ x: 0, y: 0, z: 0 })
const finite = (v: Vec3) => [v.x, v.y, v.z].every(Number.isFinite)
const axis = (v = 0) => Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0
const inverseRotate = (q: ShipQuaternion, v: Vec3) => rotateShipVector({ x: -q.x, y: -q.y, z: -q.z, w: q.w }, v)

export function createCabinFloat(position: Vec3): CabinFloatState {
  if (!finite(position)) throw Error('Invalid float spawn')
  return { position: { ...position }, velocity: zero(), orientation: { x: 0, y: 0, z: 0, w: 1 },
    angularVelocity: zero(), contactSeconds: 0, notice: '漂浮中；靠近扶手后 F 抓握' }
}

/** Caller supplies an actual skinned hand contact, never just a proximity trigger or bone origin. */
export function catchCabinFloat(s: CabinFloatState, contact: FloatContact, actualHandPoint: Vec3): CabinFloatState {
  if (s.fixed || !contact.id || ![contact.point, contact.normal, actualHandPoint].every(finite)
    || length3(contact.normal) < .1 || distance3(contact.point, actualHandPoint) > CABIN_FLOAT.contactTolerance
    || distance3(contact.point, s.position) > CABIN_FLOAT.bodyReach || length3(s.velocity) > CABIN_FLOAT.catchSpeed)
    return { ...s, notice: '还未形成可达的实际手部接触' }
  let normal = normalize3(contact.normal)
  if (dot3(normal, sub3(s.position, contact.point)) < 0) normal = scale3(normal, -1)
  return { ...s, contact: { id: contact.id, point: { ...contact.point }, normal, ...(contact.kind && { kind: contact.kind }) }, contactSeconds: 0, notice: '抓握中，手臂吸收相对运动' }
}

export function releaseCabinFloat(s: CabinFloatState): CabinFloatState {
  if (s.fixed) return { ...s, notice: '先解除设备约束' }
  return { ...s, contact: undefined, contactSeconds: 0, notice: '已松手，保持惯性' }
}

export function unfixCabinFloat(s: CabinFloatState, frame: CabinFloatFrame = {}): CabinFloatState {
  return { ...s, fixed: undefined, velocity: zero(), contactSeconds: 0,
    angularVelocity: inverseRotate(s.orientation, frame.angularVelocity ?? zero()), notice: '约束已解除，先抓稳再推离' }
}

/** Restraints may only engage after actual approach/alignment; this does not teleport the body. */
export function fixCabinFloat(s: CabinFloatState, id: string, alignedBodyPoint: Vec3): CabinFloatState {
  if (!id || !finite(alignedBodyPoint) || distance3(s.position, alignedBodyPoint) > .08)
    return { ...s, notice: '尚未对齐设备约束' }
  return { ...s, fixed: id, contact: undefined, velocity: zero(), angularVelocity: zero(), notice: '已建立设备约束' }
}

function push(s: CabinFloatState, input: CabinFloatInput): CabinFloatState {
  if (!s.contact || s.contactSeconds < .25) return s
  let direction = rotateShipVector(s.orientation, normalize3({ x: axis(input.right), y: axis(input.up), z: -axis(input.forward) }))
  if (length3(direction) < .01) direction = s.contact.normal
  const outward = dot3(direction, s.contact.normal)
  if (outward < -.15) return { ...s, notice: '推离方向不能朝向墙面或设备内部' }
  // A verified grasped handrail can transmit tangential force. A bare surface still needs separation.
  if (s.contact.kind !== 'handrail' && outward < .2) direction = normalize3(add3(direction, scale3(s.contact.normal, .25 - outward)))
  return { ...s, velocity: scale3(direction, CABIN_FLOAT.pushSpeed), contact: undefined, contactSeconds: 0, notice: '已推离；松键继续滑行' }
}

function inertia(s: CabinFloatState, frame: CabinFloatFrame): Vec3 {
  const omega = frame.angularVelocity ?? zero(), angular = frame.angularAcceleration ?? zero()
  return scale3(add3(add3(frame.acceleration ?? zero(), scale3(cross3(omega, s.velocity), 2)),
    add3(cross3(omega, cross3(omega, s.position)), cross3(angular, s.position))), -1)
}

function stepContact(s: CabinFloatState, input: CabinFloatInput, frame: CabinFloatFrame, h: number): CabinFloatState {
  const follow = inverseRotate(s.orientation, frame.angularVelocity ?? zero()),turn = { x: axis(input.pitch), y: axis(input.yaw), z: -axis(input.roll) },target = add3(follow,
    scale3(turn, CABIN_FLOAT.angularRate / Math.max(1, length3(turn)))),blend = 1 - Math.exp(-10 * h)
  return { ...s, contactSeconds: s.contactSeconds + h, velocity: scale3(s.velocity, Math.exp(-12 * h)),
    angularVelocity: add3(s.angularVelocity, scale3(sub3(target, s.angularVelocity), blend)) }
}

/** No input thrust or air drag in free flight. Rotation/acceleration of the ship supplies frame forces. */
export function stepCabinFloat(state: CabinFloatState, input: CabinFloatInput, frame: CabinFloatFrame, seconds: number,
  collision?: FloatCollision, running = true): CabinFloatState {
  if (!running || !Number.isFinite(seconds) || seconds <= 0) return state
  if (![state.position, state.velocity, state.angularVelocity, frame.acceleration ?? zero(), frame.angularVelocity ?? zero(),
    frame.angularAcceleration ?? zero()].every(finite) || !Object.values(state.orientation).every(Number.isFinite)) throw Error('Invalid float state or frame')
  if (state.fixed) return state
  const dt = Math.min(seconds, .1), count = Math.ceil(dt * 120), h = dt / count
  let s = { ...state, orientation: normalizeRotation(state.orientation) }
  for (let i = 0; i < count; i++) {
    s = s.contact ? stepContact(s, input, frame, h) : { ...s, velocity: add3(s.velocity, scale3(inertia(s, frame), h)) }
    if (input.push && s.contact) s = push(s, input)
    const from = s.position, proposed = add3(from, scale3(s.velocity, h)), result = collision?.(from, proposed, s.velocity)
    if (result && (!finite(result.position) || !finite(result.velocity))) throw Error('Invalid float collision result')
    const relativeSpin = sub3(s.angularVelocity, inverseRotate(s.orientation, frame.angularVelocity ?? zero()))
    s = { ...s, position: result?.position ?? proposed, velocity: result?.velocity ?? s.velocity,
      orientation: integrateShipRotation(s.orientation, relativeSpin, h) }
    if (s.contact && distance3(s.position, s.contact.point) > CABIN_FLOAT.bodyReach) s = releaseCabinFloat(s)
  }
  return s
}
