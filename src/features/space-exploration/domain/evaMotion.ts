import { add3, dot3, length3, normalize3, scale3, sub3, type Vec3 } from './vec3'
import { integrateShipRotation, normalizeRotation, rotateShipVector, type ShipQuaternion } from './shipFlightMath'

/** Local short-range prototype parameters; not SAFER specifications or orbital dynamics. */
export const EVA_MOTION = Object.freeze({ acceleration: .14, torque: .6, minLine: .8, maxLine: 8, reelSpeed: .25 })
export interface EvaMotion {
  /** World position of the suit's tether attachment point. */
  position: Vec3; velocity: Vec3; orientation: ShipQuaternion; angularVelocity: Vec3
  fuel: number; lineLength: number; taut: boolean; radialCorrection: number
}
/** Anchor position at the start of the frame, and its world velocity. */
export interface EvaAnchor { position: Vec3; velocity: Vec3 }
export interface EvaControls {
  right?: number; up?: number; forward?: number; pitch?: number; yaw?: number; roll?: number
  thrusters?: boolean; brake?: boolean; stabilize?: boolean; reel?: number
}
const axis = (n = 0) => Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0
const limited = (v: Vec3) => scale3(v, 1 / Math.max(1, length3(v)))
const finiteVector = (v: Vec3) => [v.x, v.y, v.z].every(Number.isFinite)

export function createEvaMotion(position: Vec3 = { x: 0, y: 0, z: -.65 }): EvaMotion {
  return { position: { ...position }, velocity: { x: 0, y: 0, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 }, angularVelocity: { x: 0, y: 0, z: 0 },
    fuel: 1, lineLength: EVA_MOTION.maxLine, taut: false, radialCorrection: 0 }
}

function validate(s: EvaMotion, anchor: EvaAnchor) {
  if (![s.position, s.velocity, s.angularVelocity, anchor.position, anchor.velocity].every(finiteVector)
    || ![s.orientation.x, s.orientation.y, s.orientation.z, s.orientation.w, s.fuel, s.lineLength].every(Number.isFinite)
    || s.fuel < 0 || s.fuel > 1 || s.lineLength < EVA_MOTION.minLine || s.lineLength > EVA_MOTION.maxLine)
    throw new Error('Invalid EVA motion state or anchor')
}

function drive(s: EvaMotion, input: EvaControls, anchorVelocity: Vec3, h: number): EvaMotion {
  if (!input.thrusters || s.fuel <= 0) return s
  const relative = sub3(s.velocity, anchorVelocity), speed = length3(relative), spin = length3(s.angularVelocity)
  const force = input.brake ? scale3(normalize3(relative), -Math.min(1, speed / (EVA_MOTION.acceleration * h)))
    : rotateShipVector(s.orientation, limited({ x: axis(input.right), y: axis(input.up), z: -axis(input.forward) }))
  const torque = input.stabilize ? scale3(normalize3(s.angularVelocity), -Math.min(1, spin / (EVA_MOTION.torque * h)))
    : limited({ x: axis(input.pitch), y: axis(input.yaw), z: -axis(input.roll) })
  const cost = h * (.08 * length3(force) + .035 * length3(torque)), fraction = cost > 0 ? Math.min(1, s.fuel / cost) : 0
  return { ...s, velocity: add3(s.velocity, scale3(force, EVA_MOTION.acceleration * h * fraction)),
    angularVelocity: add3(s.angularVelocity, scale3(torque, EVA_MOTION.torque * h * fraction)), fuel: Math.max(0, s.fuel - cost) }
}

function constrain(s: EvaMotion, anchor: EvaAnchor, lengthRate: number): EvaMotion {
  const offset = sub3(s.position, anchor.position), distance = length3(offset)
  if (distance < s.lineLength - 1e-9) return { ...s, taut: false }
  const normal = normalize3(offset), relative = sub3(s.velocity, anchor.velocity)
  const correction = Math.max(0, dot3(relative, normal) - lengthRate)
  return { ...s, position: add3(anchor.position, scale3(normal, s.lineLength)),
    velocity: sub3(s.velocity, scale3(normal, correction)), taut: true,
    radialCorrection: s.radialCorrection + correction }
}

/** Reapply the same unilateral constraint after a source-edge cable contact changes. */
export function constrainEvaLine(state: EvaMotion, anchor: EvaAnchor): EvaMotion {
  validate(state, anchor); return constrain(state, anchor, 0)
}

/** Massless unilateral line constraint: preserve tangential and inward motion, remove outward relative motion.
 * No air drag, automatic hovering, collisions, rope wrapping, tether torque or gravity gradients are modeled.
 * Powered reeling is an explicit game aid; it is not inferred to be a real passive safety-reel capability.
 */
export function stepEvaMotion(state: EvaMotion, input: EvaControls, anchor: EvaAnchor, seconds: number, running = true): EvaMotion {
  if (!running || !Number.isFinite(seconds) || seconds <= 0) return state
  validate(state, anchor)
  const dt = Math.min(seconds, .25), count = Math.ceil(dt * 120), h = dt / count
  let s = { ...state, orientation: normalizeRotation(state.orientation), radialCorrection: 0 }
  for (let i = 0; i < count; i++) {
    const previousLength = s.lineLength
    s = drive(s, input, anchor.velocity, h)
    s = { ...s, position: add3(s.position, scale3(s.velocity, h)),
      orientation: integrateShipRotation(s.orientation, s.angularVelocity, h),
      lineLength: Math.max(EVA_MOTION.minLine, Math.min(EVA_MOTION.maxLine, previousLength - axis(input.reel) * EVA_MOTION.reelSpeed * h)) }
    const moving = { position: add3(anchor.position, scale3(anchor.velocity, (i + 1) * h)), velocity: anchor.velocity }
    s = constrain(s, moving, (s.lineLength - previousLength) / h)
  }
  return s
}
