import { Quaternion, Vector3 } from 'three'
import type { CabinControlInput } from '../../domain/cabinControlAssist'
import type { CabinFloatState } from '../../domain/cabinFloatMotion'
import type { MicrogravityCrewRig } from '../astronaut/microgravityCrewRig'

export const seatEscapeCandidate = (search = typeof window === 'undefined' ? '' : window.location.search) => new URLSearchParams(search).get('seatEscape') === '1'
export const seatSlideCandidate = (search = typeof window === 'undefined' ? '' : window.location.search) => new URLSearchParams(search).get('seatSlide') === '1'
const direction = (input: CabinControlInput, state: CabinFloatState) => new Vector3(input.right ?? 0, input.up ?? 0, -(input.forward ?? 0))
  .applyQuaternion(new Quaternion(state.orientation.x, state.orientation.y, state.orientation.z, state.orientation.w))

/** Isolated, bounded response to the recorded right-leg/seat snag. Never bypasses skin sweeps. */
export class SeatEscapeAssist {
  private origin?: Vector3
  private wanted?: Vector3
  private elapsed = 0
  private watch?: Vector3
  private watchTime = 0
  private stalled = false
  private locked?: Vector3
  private runningRig?: MicrogravityCrewRig
  constructor(private readonly enabled = seatEscapeCandidate()) {}
  get active() { return !!this.origin }
  get tracking() { return this.enabled }
  get available() { return this.enabled && !this.active && !this.locked && this.stalled }
  snapshot() { return { active: this.active, ready: this.runningRig?.seatClearanceReady ?? false, stalled: this.stalled, locked: !!this.locked, elapsed: this.elapsed, watchTime: this.watchTime } }
  stop(rig: MicrogravityCrewRig, lock = false) {
    this.locked = lock ? this.wanted?.clone() : undefined
    this.origin = this.wanted = this.watch = undefined; this.elapsed = this.watchTime = 0; this.stalled = false
    const activeRig = this.runningRig ?? rig
    activeRig.endSeatClearance(); this.runningRig = undefined
  }
  sync(seconds: number, input: CabinControlInput, state: CabinFloatState, rig: MicrogravityCrewRig, permitted: boolean) {
    if (!this.enabled) return
    const wish = direction(input, state), position = new Vector3(state.position.x, state.position.y, state.position.z)
    if (!permitted || wish.lengthSq() < .01) { this.stop(rig); return }
    wish.normalize()
    if (this.locked && wish.dot(this.locked) < .5) this.locked = undefined
    if (this.active) {
      this.elapsed += seconds
      if (wish.dot(this.wanted!) < .5) this.stop(rig)
      else if (position.distanceTo(this.origin!) > .35 || this.elapsed > 3 || this.elapsed > 1.4 && !rig.seatClearanceReady) this.stop(rig, true)
      return
    }
    if (this.locked) return
    if (!this.watch) this.watch = position
    if (position.distanceTo(this.watch) >= .012) this.stalled = false
    this.watchTime += seconds
    if (this.watchTime >= .2) { this.stalled = position.distanceTo(this.watch) < .012; this.watch = position; this.watchTime = 0 }
  }
  begin(owner: string, bone: string | undefined, input: CabinControlInput, state: CabinFloatState, rig: MicrogravityCrewRig) {
    if (!this.enabled || this.active || this.locked || !this.stalled || !/^seat(?:_\d+)?$/.test(owner) || !/^(shin|foot)_R$/.test(bone ?? '')) return
    const wish = direction(input, state); if (wish.lengthSq() < .01) return
    this.origin = new Vector3(state.position.x, state.position.y, state.position.z); this.wanted = wish.normalize(); this.elapsed = 0
    this.runningRig = rig; rig.beginSeatClearance()
  }
  prepare(input: CabinControlInput, state: CabinFloatState, rig: MicrogravityCrewRig): CabinFloatState {
    if (!this.active) return state
    input.followYaw = undefined
    if (!rig.seatClearanceReady) { input.forward = input.right = input.up = 0; input.yaw = input.pitch = input.roll = 0 }
    const zero = { x: 0, y: 0, z: 0 }
    return { ...state, angularVelocity: zero, ...(!rig.seatClearanceReady && { velocity: zero }) }
  }
}
