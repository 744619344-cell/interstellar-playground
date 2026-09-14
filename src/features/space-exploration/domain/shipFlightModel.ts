import { add3, dot3, length3, normalize3, scale3, sub3, type Vec3 } from './vec3'
import { integrateShipRotation, rotateShipVector, type ShipQuaternion } from './shipFlightMath'

export const SHIP_FLIGHT = Object.freeze({
  stepSeconds: 1 / 120, maxFrameSeconds: 0.25, acceleration: 8,
  braking: 12, maxSpeed: 80, angularAcceleration: 1.2, maxAngularSpeed: 0.8,
  angularDamping: 4, lateralDamping: 2
})

export interface ShipFlightState {
  position: Vec3
  velocity: Vec3
  orientation: ShipQuaternion
  angularVelocity: Vec3
}

// Positive pitch raises the nose, positive yaw turns left, positive roll banks right.
export interface ShipFlightInput {
  throttle: number
  strafe: number
  brake: number
  pitch: number
  yaw: number
  roll: number
  stabilize: boolean
}

export function neutralShipInput(): ShipFlightInput {
  return { throttle: 0, strafe: 0, brake: 0, pitch: 0, yaw: 0, roll: 0, stabilize: false }
}

export function sanitizeShipInput(input: Partial<ShipFlightInput>): ShipFlightInput {
  const axis = (value: number | undefined, min = -1) => (
    Number.isFinite(value) ? Math.max(min, Math.min(1, value!)) : 0
  )
  return {
    throttle: axis(input.throttle), strafe: axis(input.strafe), brake: axis(input.brake, 0),
    pitch: axis(input.pitch), yaw: axis(input.yaw), roll: axis(input.roll),
    stabilize: input.stabilize === true
  }
}

export function createShipFlightState(): ShipFlightState {
  return {
    position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 1 }, angularVelocity: { x: 0, y: 0, z: 0 }
  }
}

export function cloneShipFlightState(s: ShipFlightState): ShipFlightState {
  return {
    position: { ...s.position }, velocity: { ...s.velocity },
    orientation: { ...s.orientation }, angularVelocity: { ...s.angularVelocity }
  }
}

function limit(v: Vec3, max: number): Vec3 {
  const speed = length3(v)
  return speed > max ? scale3(v, max / speed) : v
}

function angularStep(previous: Vec3, input: ShipFlightInput): Vec3 {
  const dt = SHIP_FLIGHT.stepSeconds
  const damped = input.stabilize ? scale3(previous, Math.exp(-SHIP_FLIGHT.angularDamping * dt)) : previous
  const torque = scale3({ x: input.pitch, y: input.yaw, z: -input.roll }, SHIP_FLIGHT.angularAcceleration * dt)
  return limit(add3(damped, torque), SHIP_FLIGHT.maxAngularSpeed)
}

export interface ShipMovementBasis { forward: Vec3; right: Vec3 }

function velocityStep(previous: Vec3, basis: ShipMovementBasis, input: ShipFlightInput): Vec3 {
  const dt = SHIP_FLIGHT.stepSeconds
  let velocity = previous
  const movement = add3(scale3(basis.forward, input.throttle), scale3(basis.right, input.strafe))
  if (input.brake > 0 || input.stabilize || length3(movement) < 1e-9) {
    const speed = length3(velocity)
    const strength = input.brake > 0 ? input.brake : 1
    velocity = scale3(velocity, speed ? Math.max(0, 1 - SHIP_FLIGHT.braking * strength * dt / speed) : 0)
  } else {
    const direction = normalize3(movement)
    velocity = add3(velocity, scale3(direction, SHIP_FLIGHT.acceleration * dt))
    const along = scale3(direction, dot3(velocity, direction))
    velocity = add3(along, scale3(sub3(velocity, along), Math.exp(-8 * dt)))
  }
  return limit(velocity, SHIP_FLIGHT.maxSpeed)
}

/** One fixed simulation step. State is trusted internal data; external inputs are sanitized. */
export function stepShipFlight(state: ShipFlightState, command: Partial<ShipFlightInput>, suppliedBasis?: ShipMovementBasis): ShipFlightState {
  const input = sanitizeShipInput(command)
  const angularVelocity = angularStep(state.angularVelocity, input)
  const orientation = integrateShipRotation(state.orientation, angularVelocity, SHIP_FLIGHT.stepSeconds)
  const forward = rotateShipVector(orientation, { x: 0, y: 0, z: -1 })
  const right = rotateShipVector(orientation, { x: 1, y: 0, z: 0 })
  const basis = suppliedBasis ? { forward: normalize3(suppliedBasis.forward), right: normalize3(suppliedBasis.right) } : { forward, right }
  const velocity = velocityStep(state.velocity, basis, input)
  return {
    position: add3(state.position, scale3(velocity, SHIP_FLIGHT.stepSeconds)),
    velocity, orientation, angularVelocity
  }
}
