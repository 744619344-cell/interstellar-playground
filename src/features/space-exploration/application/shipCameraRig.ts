import { constrainShipCamera, type ShipCameraObstacle } from '../domain/shipCameraCollision'
import { cameraPerpendicular, dampCameraDirection } from '../domain/shipCameraDirection'
import { interpolateShipRotation, normalizeRotation, rotateShipVector, type ShipQuaternion } from '../domain/shipFlightMath'
import { add3, length3, normalize3, scale3, sub3, type Vec3 } from '../domain/vec3'

export interface ShipCameraSubject { position: Vec3; orientation: ShipQuaternion }
export type ShipCameraMode = 'follow' | 'free'
export const SHIP_CAMERA = Object.freeze({ distance: 24, minDistance: 14, maxDistance: 64,
  pitch: 0.22, pitchLimit: 1.35, followYawLimit: Math.PI / 3, damping: 8, radius: 0.35 })
const finite = (n: number) => Number.isFinite(n) ? n : 0
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
const wrap = (n: number) => Math.atan2(Math.sin(n), Math.cos(n))

/** Pure camera rig: no input listeners, renderer, timers or changes to the flight subject. */
export class ShipCameraRig {
  private mode: ShipCameraMode = 'follow'
  private reference: ShipQuaternion
  private yaw = 0
  private pitch: number = SHIP_CAMERA.pitch
  private requestedDistance: number = SHIP_CAMERA.distance
  private distance: number = SHIP_CAMERA.distance
  private pose: { position: Vec3; target: Vec3; up: Vec3; blocked: boolean; occluded: boolean }

  constructor(subject: ShipCameraSubject) {
    this.reference = normalizeRotation(subject.orientation)
    const direction = rotateShipVector(this.reference, { x: 0, y: Math.sin(this.pitch), z: Math.cos(this.pitch) })
    this.pose = { position: add3(subject.position, scale3(direction, this.distance)), target: { ...subject.position },
      up: cameraPerpendicular(direction, rotateShipVector(this.reference, { x: 0, y: 1, z: 0 })),
      blocked: false, occluded: false }
  }

  setMode(mode: ShipCameraMode) {
    if (mode === this.mode) return
    this.mode = mode
    // Keep the rendered reference on entry; it no longer follows ship rotation in free mode.
    if (mode === 'follow') { this.yaw = 0; this.pitch = SHIP_CAMERA.pitch }
  }

  orbit(yawDelta: number, pitchDelta: number) {
    const yaw = wrap(this.yaw + wrap(finite(yawDelta)))
    this.yaw = yaw
    this.pitch = clamp(this.pitch + finite(pitchDelta), -SHIP_CAMERA.pitchLimit, SHIP_CAMERA.pitchLimit)
  }

  zoom(deltaMeters: number) {
    this.requestedDistance = clamp(this.requestedDistance + finite(deltaMeters),
      SHIP_CAMERA.minDistance, SHIP_CAMERA.maxDistance)
  }

  update(subject: ShipCameraSubject, elapsedSeconds: number, obstacles: readonly ShipCameraObstacle[] = []) {
    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return this.snapshot()
    const dt = clamp(finite(elapsedSeconds), 0, 0.25)
    const alpha = -Math.expm1(-SHIP_CAMERA.damping * dt)
    if (this.mode === 'follow') {
      this.reference = interpolateShipRotation(this.reference, normalizeRotation(subject.orientation), alpha)
    }
    const local = { x: Math.sin(this.yaw) * Math.cos(this.pitch), y: Math.sin(this.pitch),
      z: Math.cos(this.yaw) * Math.cos(this.pitch) }
    const direction = rotateShipVector(this.reference, local)
    // Smooth the offset rather than the world position: translation must not let the ship outrun its camera.
    const previousOffset = sub3(this.pose.position, this.pose.target)
    const oldDirection = length3(previousOffset) > 1e-6 ? normalize3(previousOffset) : direction
    const boom = dampCameraDirection(oldDirection, direction, alpha)
    const target = { ...subject.position }
    const extended = constrainShipCamera(target, add3(target, scale3(boom, this.requestedDistance)),
      obstacles, SHIP_CAMERA.radius)
    this.distance = extended.distance < this.distance ? extended.distance
      : this.distance + (extended.distance - this.distance) * alpha
    this.pose = { target, position: add3(target, scale3(boom, this.distance)),
      up: cameraPerpendicular(boom, rotateShipVector(this.reference, { x: 0, y: 1, z: 0 })),
      blocked: extended.blocked, occluded: extended.occluded }
    return this.snapshot()
  }

  snapshot() {
    return { ...this.pose, position: { ...this.pose.position }, target: { ...this.pose.target },
      up: { ...this.pose.up }, mode: this.mode, distance: this.distance,
      requestedDistance: this.requestedDistance, yaw: this.yaw, pitch: this.pitch }
  }
}
