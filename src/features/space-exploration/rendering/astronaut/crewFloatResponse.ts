import type { Vec3 } from '../../domain/vec3'

/** Small secondary-motion targets; the rig only rotates existing native joints. */
export class CrewFloatResponse {
  forward = 0
  side = 0
  turn = 0
  private target = { forward: 0, side: 0, turn: 0 }
  set(velocity: Vec3, turn: number, enabled: boolean) {
    const clamp = (n: number) => Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0
    this.target = enabled ? { forward: clamp(velocity.z / .6), side: clamp(velocity.x / .6), turn: clamp(turn) }
      : { forward: 0, side: 0, turn: 0 }
  }
  step(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return
    const blend = 1 - Math.exp(-Math.min(.05, seconds) * 5)
    for (const key of ['forward', 'side', 'turn'] as const) this[key] += (this.target[key] - this[key]) * blend
  }
}
