import { Matrix4, Quaternion, Vector3 } from 'three'
import { ShipCameraRig, type ShipCameraSubject } from '../../application/shipCameraRig'
import { constrainShipCamera, type ShipCameraObstacle } from '../../domain/shipCameraCollision'
import { normalize3, sub3 } from '../../domain/vec3'

export type ShipViewMode = 'follow' | 'cockpit' | 'free'
export const nextShipView = (mode: ShipViewMode): ShipViewMode =>
  mode === 'follow' ? 'cockpit' : mode === 'cockpit' ? 'free' : 'follow'
const vector = (v: { x: number; y: number; z: number }) => new Vector3(v.x, v.y, v.z)
const plain = (v: Vector3) => ({ x: v.x, y: v.y, z: v.z })
const rotation = (pose: { position: Vector3; target: Vector3; up: Vector3 }) =>
  new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(pose.position, pose.target, pose.up))

/** Render adapter: exterior rig plus fixed seat and interruptible view transitions. */
export class ShipViewCamera {
  private rig: ShipCameraRig
  private mode: ShipViewMode = 'follow'
  private subjectPosition: Vector3
  private pose: { position: Vector3; target: Vector3; up: Vector3 }
  private transition?: { offset: Vector3; rotation: Quaternion; elapsed: number }
  private blocked = false
  private occluded = false
  private cockpitPitchOffset = 0
  constructor(subject: ShipCameraSubject, private seat = { x: 0, y: 0.8, z: -2 }) {
    this.rig = new ShipCameraRig(subject)
    this.subjectPosition = vector(subject.position)
    const pose = this.rig.snapshot()
    this.pose = { position: vector(pose.position), target: vector(pose.target), up: vector(pose.up) }
  }
  setMode(mode: ShipViewMode) {
    if (mode === this.mode) return
    this.transition = { offset: this.pose.position.clone().sub(this.subjectPosition),
      rotation: rotation(this.pose), elapsed: 0 }
    this.mode = mode
    this.rig.setMode(mode === 'cockpit' ? 'follow' : mode)
  }
  orbit(dx: number, dy: number) { this.rig.orbit(dx, dy) }
  setSeat(seat: { x: number; y: number; z: number }, pitchOffset = 0) {
    this.seat = { ...seat }
    this.cockpitPitchOffset = pitchOffset
    if (this.mode === 'cockpit') this.transition = { offset: this.pose.position.clone().sub(this.subjectPosition),
      rotation: rotation(this.pose), elapsed: 0 }
  }
  zoom(delta: number) { if (this.mode !== 'cockpit') this.rig.zoom(delta) }
  update(subject: ShipCameraSubject, dt: number, obstacles: readonly ShipCameraObstacle[] = []) {
    if (!Number.isFinite(dt) || dt <= 0) return this.snapshot()
    this.subjectPosition.copy(subject.position)
    const exterior = this.rig.update(subject, dt, obstacles)
    const q = new Quaternion(subject.orientation.x, subject.orientation.y, subject.orientation.z, subject.orientation.w).normalize()
    const seat = vector(this.seat).applyQuaternion(q).add(this.subjectPosition)
    const look = this.rig.snapshot()
    const cockpitPitch = look.pitch - 0.22 + this.cockpitPitchOffset
    const cockpitDirection = new Vector3(-Math.sin(look.yaw) * Math.cos(cockpitPitch), Math.sin(cockpitPitch),
      -Math.cos(look.yaw) * Math.cos(cockpitPitch)).applyQuaternion(q)
    let destination = this.mode === 'cockpit'
      ? { position: seat, target: cockpitDirection.add(seat), up: new Vector3(0, 1, 0).applyQuaternion(q) }
      : { position: vector(exterior.position), target: vector(exterior.target), up: vector(exterior.up) }
    if (this.transition) {
      this.transition.elapsed += Math.min(dt, 0.25)
      const t = Math.min(1, this.transition.elapsed / 0.6)
      const alpha = t * t * (3 - 2 * t)
      const orientation = this.transition.rotation.clone().slerp(rotation(destination), alpha)
      const position = this.transition.offset.clone().add(this.subjectPosition).lerp(destination.position, alpha)
      destination = { position, target: new Vector3(0, 0, -1).applyQuaternion(orientation).add(position),
        up: new Vector3(0, 1, 0).applyQuaternion(orientation) }
      if (t === 1) this.transition = undefined
    }
    const safe = constrainShipCamera(subject.position, plain(destination.position), obstacles, 0.35)
    this.blocked = safe.blocked
    this.occluded = safe.occluded || (this.mode !== 'cockpit' && exterior.occluded)
    const adjustment = vector(safe.position).sub(destination.position)
    destination.position.add(adjustment); destination.target.add(adjustment)
    this.pose = destination
    return this.snapshot()
  }
  snapshot() {
    return { ...this.rig.snapshot(), position: plain(this.pose.position), target: plain(this.pose.target),
      up: plain(this.pose.up), mode: this.mode, transitioning: !!this.transition, blocked: this.blocked,
      occluded: this.occluded, distance: this.pose.position.distanceTo(this.subjectPosition) }
  }
  movementBasis() {
    const forward = normalize3(sub3(plain(this.pose.target), plain(this.pose.position)))
    const up = normalize3(plain(this.pose.up))
    return { forward, right: normalize3({ x: forward.y * up.z - forward.z * up.y,
      y: forward.z * up.x - forward.x * up.z, z: forward.x * up.y - forward.y * up.x }) }
  }
}
