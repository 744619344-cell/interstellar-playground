import { Group, Mesh, Object3D, Vector3 } from 'three'
import { CabinTriangleField } from './cabinTriangleField'
import { LOCKER_DOOR_FIT, LOCKER_LEAVES } from './microgravityLockerDoorParts'
import type { MicrogravitySurfaces } from './microgravitySurfaces'

export interface LockerDoorSaved { progress: number; target: 0 | 1; blocked: boolean }
const ease = (v: number) => v * v * v * (10 + v * (-15 + 6 * v))

/** Collision-aware controller for the separately saved four-leaf candidate. */
export class MicrogravityLockerDoors {
  private root?: Object3D
  private leaves: { pivot: Object3D; field: CabinTriangleField; points: Vector3[] }[] = []
  private state: LockerDoorSaved
  notice = ''
  constructor(private model: Group, saved?: LockerDoorSaved) {
    this.root = model.getObjectByName('MicrogravityLockerDoorAssembly')
    this.state = saved ? { ...saved } : { progress: 0, target: 0, blocked: false }
    for (const name of LOCKER_LEAVES) {
      const pivot = this.root?.getObjectByName(name); if (!pivot) continue
      const mesh = pivot.children.find(o => o instanceof Mesh && o.name.endsWith('Panel')) as Mesh
      if (!mesh) throw Error('Incomplete locker door candidate')
      const points: Vector3[] = [], p = mesh.geometry.getAttribute('position')
      mesh.updateMatrix(); for (let i = 0; i < p.count; i++) { const point = new Vector3().fromBufferAttribute(p, i).applyMatrix4(mesh.matrix); if (!points.some(p => p.distanceToSquared(point) < 1e-12)) points.push(point) }
      this.leaves.push({ pivot, field: new CabinTriangleField(pivot, [mesh]), points })
    }
    if (this.root && this.leaves.length !== 4) throw Error('Locker candidate must contain all four authorized leaves')
    this.apply(this.state.progress)
  }
  get available() { return this.leaves.length === 4 }
  get ready() { return !this.available || this.state.progress === 1 && this.state.target === 1 }
  private apply(progress: number) {
    const angle = ease(progress) * LOCKER_DOOR_FIT.angle
    this.leaves.forEach(({ pivot }, i) => { pivot.rotation.y = [-1, 2, 1, -2][i] * angle })
    this.root?.updateWorldMatrix(true, true)
  }
  request(open: boolean) { this.state.target = open ? 1 : 0; this.state.blocked = false; this.notice = open ? '正在展开宇航服柜门' : '正在合拢宇航服柜门' }
  step(dt: number, people: readonly Vector3[], surfaces: MicrogravitySurfaces) {
    if (!this.available || this.state.progress === this.state.target) return
    const prior = this.state.progress, next = prior + Math.sign(this.state.target - prior) * Math.min(Math.abs(this.state.target - prior), dt / 2.2)
    const inverse = this.model.matrixWorld.clone().invert()
    const before = this.leaves.map(l => inverse.clone().multiply(l.pivot.matrixWorld))
    this.apply(next); const after = this.leaves.map(l => inverse.clone().multiply(l.pivot.matrixWorld))
    const blocked = this.leaves.some((leaf, i) => {
      if (people.some(p => leaf.field.cast(p.clone().applyMatrix4(before[i].clone().invert()), p.clone().applyMatrix4(after[i].clone().invert())))) return true
      return leaf.points.some(p => !surfaces.clear(p.clone().applyMatrix4(before[i]), p.clone().applyMatrix4(after[i]), .001, this.root))
    })
    this.state.blocked = blocked
    if (blocked) { this.apply(prior); this.notice = '柜门活动范围被挡住，稍退后便会继续'; return }
    this.state.progress = next
    if (next === this.state.target) this.notice = next ? '宇航服柜门已完全展开' : '宇航服柜门已关闭'
  }
  snapshot() { return { ...this.state } }
  reset() { this.state = { progress: 0, target: 0, blocked: false }; this.apply(0) }
  dispose() { this.leaves.forEach(l => l.field.dispose()); this.leaves = [] }
}
