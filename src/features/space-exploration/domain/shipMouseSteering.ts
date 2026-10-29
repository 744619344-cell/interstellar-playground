import { integrateShipRotation, normalizeRotation, type ShipQuaternion } from './shipFlightMath'
import type { ShipFlightInput, ShipFlightState } from './shipFlightModel'

const clamp = (n: number) => Math.max(-1, Math.min(1, n))

/** Pointer deltas set a world attitude target; camera follow never feeds back into steering. */
export class ShipMouseSteering {
  private target?: ShipQuaternion

  clear() { this.target = undefined }

  drag(orientation: ShipQuaternion, dx: number, dy: number) {
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (!dx && !dy)) return
    this.target = integrateShipRotation(this.target ?? normalizeRotation(orientation),
      { x: -dy * .004, y: -dx * .004, z: 0 }, 1)
  }

  command(state: ShipFlightState, input: Partial<ShipFlightInput>): Partial<ShipFlightInput> {
    if (input.stabilize) this.clear()
    if (!this.target) return input
    const q = normalizeRotation(state.orientation), t = this.target
    // inverse(current) * target expresses the shortest attitude error in ship-local axes.
    const error = normalizeRotation({
      x: q.w * t.x - q.x * t.w - q.y * t.z + q.z * t.y,
      y: q.w * t.y + q.x * t.z - q.y * t.w - q.z * t.x,
      z: q.w * t.z - q.x * t.y + q.y * t.x - q.z * t.w,
      w: q.w * t.w + q.x * t.x + q.y * t.y + q.z * t.z
    })
    const sign = error.w < 0 ? -1 : 1
    const size = Math.hypot(error.x, error.y, error.z)
    const angle = 2 * Math.atan2(size, Math.abs(error.w))
    const scale = size > 1e-9 ? sign * angle / size : 0
    const rate = state.angularVelocity
    if (angle < .0005 && Math.hypot(rate.x, rate.y, rate.z) < .001) {
      this.clear(); return input
    }
    return { ...input, pitch: clamp(6 * error.x * scale - 4 * rate.x),
      yaw: clamp(6 * error.y * scale - 4 * rate.y),
      roll: -clamp(6 * error.z * scale - 4 * rate.z) }
  }
}
