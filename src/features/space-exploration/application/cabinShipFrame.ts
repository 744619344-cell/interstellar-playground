import type { CabinFloatFrame } from '../domain/cabinFloatMotion'
import type { ShipFlightState } from '../domain/shipFlightModel'
import { rotateShipVector } from '../domain/shipFlightMath'
import { scale3, sub3 } from '../domain/vec3'

/** Convert the actual flight simulation's accelerations to the cabin frame. */
export function cabinShipFrame(previous: ShipFlightState | undefined, state: ShipFlightState, seconds: number): CabinFloatFrame {
  const inverse = { x: -state.orientation.x, y: -state.orientation.y, z: -state.orientation.z, w: state.orientation.w }
  const elapsed = Number.isFinite(seconds) && seconds > 0 && seconds < .5 ? seconds : 0
  return { angularVelocity: { ...state.angularVelocity }, shipPose: { position: { ...state.position }, velocity: { ...state.velocity }, orientation: { ...state.orientation }, angularVelocity: { ...state.angularVelocity } },
    acceleration: previous && elapsed ? rotateShipVector(inverse, scale3(sub3(state.velocity, previous.velocity), 1 / elapsed)) : { x: 0, y: 0, z: 0 },
    angularAcceleration: previous && elapsed ? scale3(sub3(state.angularVelocity, previous.angularVelocity), 1 / elapsed) : { x: 0, y: 0, z: 0 } }
}
