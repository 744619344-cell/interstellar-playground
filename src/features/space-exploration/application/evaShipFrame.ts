import { normalizeRotation, rotateShipVector, type ShipQuaternion } from '../domain/shipFlightMath'
import { add3, cross3, sub3, type Vec3 } from '../domain/vec3'

export interface EvaShipFrame { position: Vec3; velocity: Vec3; orientation: ShipQuaternion; angularVelocity: Vec3 }
const inverse = (q: ShipQuaternion) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w })
export function composeEvaRotation(a: ShipQuaternion, b: ShipQuaternion): ShipQuaternion {
  return normalizeRotation({ x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z })
}
export const evaWorldPoint = (frame: EvaShipFrame, point: Vec3) => add3(frame.position, rotateShipVector(frame.orientation, point))
export const evaCabinPoint = (frame: EvaShipFrame, point: Vec3) => rotateShipVector(inverse(frame.orientation), sub3(point, frame.position))
/** Includes the actual velocity of a point on the rotating hull. */
export const evaWorldVelocity = (frame: EvaShipFrame, point: Vec3, velocity: Vec3) =>
  add3(frame.velocity, rotateShipVector(frame.orientation, add3(velocity, cross3(frame.angularVelocity, point))))
export const evaCabinVelocity = (frame: EvaShipFrame, point: Vec3, velocity: Vec3) =>
  sub3(rotateShipVector(inverse(frame.orientation), sub3(velocity, frame.velocity)), cross3(frame.angularVelocity, point))
export const evaWorldRotation = (frame: EvaShipFrame, orientation: ShipQuaternion) => composeEvaRotation(frame.orientation, orientation)
export const evaCabinRotation = (frame: EvaShipFrame, orientation: ShipQuaternion) => composeEvaRotation(inverse(frame.orientation), orientation)
