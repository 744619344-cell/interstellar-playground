import { Bone, Quaternion, Vector3 } from 'three'

/** Short, reversible use of existing joints; source skin collision still decides each step. */
export class SeatClearancePose {
  active = false
  private thigh = 0
  private shin = 0
  private last = 0
  private joint: 'thigh' | 'shin' = 'thigh'
  get ready() { return this.active && this.thigh >= .2 - 1e-8 && this.shin >= .2 - 1e-8 }
  begin() { this.active = true; this.thigh = this.shin = this.last = 0 }
  cancel() { this.active = false; this.last = 0 }
  step(seconds: number, bones: ReadonlyMap<string, Bone>) {
    this.last = 0
    if (!this.active || this.ready || !Number.isFinite(seconds) || seconds <= 0) return
    this.joint = this.thigh < .2 - 1e-8 ? 'thigh' : 'shin'
    const current = this.joint === 'thigh' ? this.thigh : this.shin
    const bone = bones.get(this.joint === 'thigh' ? 'thigh_R' : 'shin_R')
    if (!bone) { this.cancel(); return }
    this.last = Math.min(.2 - current, Math.min(.05, seconds) * 1.6)
    if (this.joint === 'thigh') this.thigh += this.last; else this.shin += this.last
    bone.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), this.joint === 'thigh' ? this.last : -this.last))
  }
  rollback() {
    if (this.joint === 'thigh') this.thigh -= this.last; else this.shin -= this.last
    this.last = 0
  }
}
