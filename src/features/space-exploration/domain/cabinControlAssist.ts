import type { CabinFloatFrame, CabinFloatInput, CabinFloatState } from './cabinFloatMotion'
import { rotateShipVector } from './shipFlightMath'
import { add3, length3, normalize3, scale3, sub3, type Vec3 } from './vec3'

export type CabinControlMode = 'assisted' | 'inertial'
export interface CabinControlInput extends CabinFloatInput { brake?: boolean; fast?: boolean; followYaw?: number }
export const CABIN_ASSIST = Object.freeze({ speed: .6, fastSpeed: .85, acceleration: 1.2, stopping: 1, braking: 1.8, turnRate: 1.35 })
const approach = (from: Vec3, to: Vec3, amount: number) => {
  const delta = sub3(to, from), distance = length3(delta)
  return distance <= amount ? { ...to } : add3(from, scale3(delta, amount / distance))
}

/** Explicit game assistance, never used by an inertial observation. The caller still sweeps real skin. */
export function assistCabinControls(state: CabinFloatState, input: CabinControlInput, frame: CabinFloatFrame, seconds: number): CabinFloatState {
  if (state.contact || state.fixed || !Number.isFinite(seconds) || seconds <= 0) return state
  const dt = Math.min(.05, seconds), local = { x: input.right ?? 0, y: input.up ?? 0, z: -(input.forward ?? 0) }
  const moving = length3(local) > 1e-5, zero = { x: 0, y: 0, z: 0 }
  const wanted = scale3(rotateShipVector(state.orientation, normalize3(local)), input.fast ? CABIN_ASSIST.fastSpeed : CABIN_ASSIST.speed)
  const velocity = input.brake ? approach(state.velocity, zero, CABIN_ASSIST.braking * dt)
    : moving ? approach(state.velocity, wanted, CABIN_ASSIST.acceleration * dt) : approach(state.velocity, zero, CABIN_ASSIST.stopping * dt)
  const turn = { x: input.pitch ?? 0, y: input.yaw ?? 0, z: -(input.roll ?? 0) }
  if (!turn.y && Number.isFinite(input.followYaw)) {
    const facing = rotateShipVector(state.orientation, { x: 0, y: 0, z: -1 })
    const error = input.followYaw! - Math.atan2(-facing.x, -facing.z)
    turn.y = Math.max(-1, Math.min(1, Math.atan2(Math.sin(error), Math.cos(error)) * 2.5))
  }
  const inverse = { x: -state.orientation.x, y: -state.orientation.y, z: -state.orientation.z, w: state.orientation.w }
  const follow = rotateShipVector(inverse, frame.angularVelocity ?? zero)
  const target = add3(follow, scale3(turn, CABIN_ASSIST.turnRate / Math.max(1, length3(turn))))
  const angularVelocity = add3(state.angularVelocity, scale3(sub3(target, state.angularVelocity), 1 - Math.exp(-8 * dt)))
  return { ...state, velocity: { ...velocity }, angularVelocity }
}
