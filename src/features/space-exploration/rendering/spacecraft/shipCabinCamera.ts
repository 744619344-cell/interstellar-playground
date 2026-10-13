import { Box3, Group, Matrix4, Mesh, Vector3 } from 'three'
import type { Vec3 } from '../../domain/vec3'
import { continuousRoofHeight } from './shipInteriorTransitions'
import { insideMasterCabin, type ShipCabinVolume } from './shipCabinVolume'

const RADIUS = .12
export const shipCabinOccupiesGate = (point: Vec3) => point.z > 4.87 - RADIUS && point.z < 5.05 + RADIUS
const fixtures = new Set(['seat', 'main-console', 'center-console', 'center-column', 'throttle',
  'pedals', 'joystick', 'mounting-fixture', 'rear-workbench', 'storage-cabinet', 'dual-suit-locker',
  'folding-berth', 'airlock-pressure-panel', 'airlock-handrail'])

/** Local-space inspection obstacles taken from the installed assembly, without owning GPU resources. */
export function shipCabinObstacles(model: Group) {
  model.updateMatrixWorld(true)
  const inverse = new Matrix4().copy(model.matrixWorld).invert(), boxes: Box3[] = []
  model.traverse(o => {
    if (!(o instanceof Mesh) || !fixtures.has(o.userData.module)) return
    // Door side plates share one source label across both sides and both doors.
    // Their union would seal the entire aisle; the aperture/door slab is constrained separately.
    if (o.userData.module === 'mounting-fixture' && String(o.userData.label).includes('门框')) return
    o.geometry.computeBoundingBox()
    boxes.push(o.geometry.boundingBox!.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld)))
  })
  return boxes.map(box => box.expandByScalar(RADIUS))
}

/** Bounded inspection camera, separate from spacecraft movement and astronaut physics. */
export class ShipCabinCamera {
  private position = new Vector3(0, -.18, -3.84)
  private initialized = false
  private boxes: readonly Box3[] = []
  private volume?: ShipCabinVolume
  blocked = false
  setSeat(seat: Vec3) {
    if (!this.initialized) { this.position.copy(seat); this.initialized = true }
  }
  setObstacles(boxes: readonly Box3[]) { this.boxes = boxes }
  setVolume(volume?: ShipCabinVolume) { this.volume = volume }
  snapshot(): Vec3 { return { x: this.position.x, y: this.position.y, z: this.position.z } }
  private safe(point: Vector3, innerOpen: boolean) {
    if (this.volume) return insideMasterCabin(point, this.volume, RADIUS, innerOpen)
      && !this.boxes.some(box => box.containsPoint(point))
    if (Math.abs(point.x) > 1.78 - RADIUS || point.z < -5.75 || point.z > 7.07 - RADIUS
      || point.y < -1.598 + RADIUS || point.y > continuousRoofHeight(point.z) - RADIUS) return false
    if (shipCabinOccupiesGate(point)
      && (!innerOpen || Math.abs(point.x) > .78 - RADIUS || point.y > .9 - RADIUS)) return false
    return !this.boxes.some(box => box.containsPoint(point))
  }
  move(forward: number, right: number, vertical: number, yaw: number, innerOpen: boolean) {
    if (![forward, right, vertical, yaw].every(Number.isFinite)) return
    const delta = new Vector3(-Math.sin(yaw)*forward + Math.cos(yaw)*right,
      vertical, -Math.cos(yaw)*forward - Math.sin(yaw)*right)
    // Substeps prevent tunnelling even for a large wheel/drag or a slow frame.
    delta.clampLength(0, 1)
    if (!delta.lengthSq()) return
    const steps = Math.max(1, Math.ceil(delta.length() / .025)); delta.divideScalar(steps)
    this.blocked = false
    for (let i = 0; i < steps; i++) for (const axis of ['x', 'z', 'y'] as const) {
      if (!delta[axis]) continue
      const candidate = this.position.clone(); candidate[axis] += delta[axis]
      if (this.safe(candidate, innerOpen)) this.position.copy(candidate)
      else this.blocked = true
    }
  }
}
