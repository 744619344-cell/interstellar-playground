import { rotateShipVector } from './shipFlightMath'
import { sanitizeShipInput, type ShipFlightInput, type ShipFlightState } from './shipFlightModel'
import { dot3, length3, normalize3, sub3, type Vec3 } from './vec3'

export interface ShipNavigationBody { id: string; center: Vec3; velocity: Vec3; radius: number }
// Conservative origin-centred envelope for the full-size PBR assembly; checked on load.
export const SHIP_PROTECTION = Object.freeze({ radius: 10, margin: 3 })
const clamp = (value: number) => Math.max(-1, Math.min(1, value))
export const validNavigationBodies = (bodies: readonly ShipNavigationBody[]) => bodies.filter((b) =>
  Number.isFinite(b.radius) && b.radius >= 0 && [...Object.values(b.center), ...Object.values(b.velocity)].every(Number.isFinite))

export function shipTargetInfo(state: ShipFlightState, target?: ShipNavigationBody) {
  if (!target) return undefined
  const delta = sub3(target.center, state.position)
  const distance = length3(delta)
  const q = state.orientation
  const local = rotateShipVector({ x: -q.x, y: -q.y, z: -q.z, w: q.w }, normalize3(delta))
  const yaw = Math.atan2(-local.x, -local.z)
  const pitch = Math.atan2(local.y, Math.hypot(local.x, local.z))
  const angle = distance < 1e-9 ? 0 : Math.acos(Math.max(-1, Math.min(1, -local.z)))
  return { id: target.id, distance, clearance: distance - target.radius - SHIP_PROTECTION.radius,
    angleDegrees: angle * 180 / Math.PI, yaw, pitch,
    closingSpeed: dot3(sub3(state.velocity, target.velocity), normalize3(delta)) }
}

/** Assists rotation only. Manual axes and the explicit stabilizer take precedence. */
export function assistedShipInput(state: ShipFlightState, command: Partial<ShipFlightInput>,
  target: ShipNavigationBody | undefined, enabled: boolean): ShipFlightInput {
  const input = sanitizeShipInput(command)
  const info = shipTargetInfo(state, target)
  if (!enabled || !info || info.distance < 1e-9 || input.stabilize) return input
  return { ...input,
    yaw: input.yaw || clamp(info.yaw * 1.6 - state.angularVelocity.y * 2.4),
    pitch: input.pitch || clamp(info.pitch * 1.6 - state.angularVelocity.x * 2.4) }
}
