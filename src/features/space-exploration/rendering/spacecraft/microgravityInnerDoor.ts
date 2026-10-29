import { Group, Matrix4, Mesh, Object3D, Vector3 } from 'three'
import { CabinTriangleField } from './cabinTriangleField'
import type { MicrogravitySurfaces } from './microgravitySurfaces'

const ease = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * t * (10 + t * (-15 + t * 6)) }
/** Controls the authorized source leaf: retract clear of the thick seal/frame, then slide alongside it. */
export class MicrogravityInnerDoor {
  private hinge: Object3D
  readonly leaf: Object3D
  private rest: Vector3
  private field: CabinTriangleField
  private samples: Vector3[] = []
  private progress = 0
  readonly center: Vector3
  constructor(private model: Group) {
    const hinge = model.getObjectByName('InnerDoorHinge'), leaf = model.getObjectByName('InnerDoorLeaf')
    if (!hinge || !leaf) throw Error('Missing qualified inner door source parts')
    this.hinge = hinge; this.leaf = leaf; this.rest = hinge.position.clone()
    hinge.userData.microClosedPosition = this.rest.toArray()
    model.updateWorldMatrix(true, true)
    this.center = model.worldToLocal(hinge.getWorldPosition(new Vector3()))
    const meshes: Mesh[] = []; leaf.traverse(o => { if (o instanceof Mesh) meshes.push(o) })
    this.field = new CabinTriangleField(hinge, meshes)
    const inverse = hinge.matrixWorld.clone().invert(), directions = [new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)]
    const chosen = directions.map(() => ({ score: -Infinity, point: new Vector3() }))
    for (const mesh of meshes) { const p = mesh.geometry.getAttribute('position'), matrix = inverse.clone().multiply(mesh.matrixWorld)
      for (let i = 0; i < p.count; i++) { const point = new Vector3().fromBufferAttribute(p, i).applyMatrix4(matrix)
        directions.forEach((d, k) => { const score = point.dot(d); if (score > chosen[k].score) chosen[k] = { score, point } }) }
    }
    this.samples = chosen.map(s => s.point)
  }
  apply(progress: number) {
    this.progress = Math.max(0, Math.min(1, progress)); this.hinge.position.copy(this.rest)
    this.hinge.position.z -= .092 * ease(this.progress / .38)
    this.hinge.position.x -= .233 * ease((this.progress - .38) / .62)
    this.hinge.updateWorldMatrix(true, true)
  }
  private matrix(progress: number) { this.apply(progress); return this.model.matrixWorld.clone().invert().multiply(this.hinge.matrixWorld) }
  blocked(from: number, to: number, points: readonly Vector3[], surfaces: MicrogravitySurfaces, cord: readonly Vector3[] = []) {
    const original = this.progress, a = this.matrix(from), b = this.matrix(to), invA = a.clone().invert(), invB = b.clone().invert()
    try {
      for (const p of [...points, ...cord]) if (this.field.cast(p.clone().applyMatrix4(invA), p.clone().applyMatrix4(invB))) return true
      for (const p of this.samples) {
        const start = p.clone().applyMatrix4(a), end = p.clone().applyMatrix4(b)
        if (!surfaces.clear(start, end, .001, this.leaf)) return true
      }
      return false
    } finally { this.apply(original) }
  }
  boundsMatrix(progress: number) { const prior = this.progress, matrix = this.matrix(progress); this.apply(prior); return new Matrix4().copy(matrix) }
  dispose() { this.apply(0); this.samples = []; this.field.dispose() }
}
