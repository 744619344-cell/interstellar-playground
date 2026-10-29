import { Box3, Matrix4, Mesh, Ray, Vector3, type Object3D } from 'three'
import type { Vec3 } from '../../domain/vec3'

export interface CabinSurfaceHit { point: Vec3; normal: Vec3; distance: number; owner: Mesh; triangle: number }
const CELL = .16
const key = (x: number, y: number, z: number) => `${x},${y},${z}`
const plain = (p: Vector3): Vec3 => ({ x: p.x, y: p.y, z: p.z })
const finite = (p: Vec3) => [p.x, p.y, p.z].every(Number.isFinite)

/** Read-only triangle-index cache in root coordinates. No meshes, fixtures, faces or GPU buffers are authored. */
export class CabinTriangleField {
  private values = new Float32Array()
  private pending: number[] = []
  private bins = new Map<string, number[]>()
  private owners: Mesh[] = []
  private faces: number[] = []
  private stamps = new Uint32Array()
  private stamp = 0
  private inverse: Matrix4
  private a = new Vector3()
  private b = new Vector3()
  private c = new Vector3()
  private hit = new Vector3()
  private ray = new Ray()
  readonly bounds = new Box3()

  constructor(root: Object3D, meshes: readonly Mesh[]) {
    root.updateWorldMatrix(true, true)
    this.inverse = root.matrixWorld.clone().invert()
    for (const mesh of meshes) this.add(mesh)
    this.values = new Float32Array(this.pending); this.pending = []
    this.stamps = new Uint32Array(this.owners.length)
  }

  private add(mesh: Mesh) {
    const pos = mesh.geometry.getAttribute('position'), index = mesh.geometry.index
    if (!pos) return
    const matrix = this.inverse.clone().multiply(mesh.matrixWorld), box = new Box3()
    for (let i = 0; i < (index?.count ?? pos.count); i += 3) {
      this.a.fromBufferAttribute(pos, index ? index.getX(i) : i).applyMatrix4(matrix)
      this.b.fromBufferAttribute(pos, index ? index.getX(i + 1) : i + 1).applyMatrix4(matrix)
      this.c.fromBufferAttribute(pos, index ? index.getX(i + 2) : i + 2).applyMatrix4(matrix)
      if (![this.a, this.b, this.c].every(finite)) throw Error('Non-finite source collision triangle')
      const id = this.owners.length
      this.pending.push(...this.a.toArray(), ...this.b.toArray(), ...this.c.toArray())
      this.owners.push(mesh); this.faces.push(i / 3)
      box.setFromPoints([this.a, this.b, this.c]); this.bounds.union(box)
      for (let x = Math.floor(box.min.x / CELL); x <= Math.floor(box.max.x / CELL); x++)
        for (let y = Math.floor(box.min.y / CELL); y <= Math.floor(box.max.y / CELL); y++)
          for (let z = Math.floor(box.min.z / CELL); z <= Math.floor(box.max.z / CELL); z++) {
            const idKey = key(x, y, z); let cell = this.bins.get(idKey)
            if (!cell) { cell = []; this.bins.set(idKey, cell) }
            cell.push(id)
          }
    }
  }

  /** Closest actual source-surface intersection on a finite segment; both face directions count. */
  cast(from: Vec3, to: Vec3): CabinSurfaceHit | undefined {
    if (!this.owners.length || !finite(from) || !finite(to)) return undefined
    const origin = new Vector3(from.x, from.y, from.z), delta = new Vector3(to.x - from.x, to.y - from.y, to.z - from.z), length = delta.length()
    if (length < 1e-10 || length > 100) return undefined
    this.ray.set(origin, delta.clone().divideScalar(length))
    if (!this.ray.intersectsBox(this.bounds)) return undefined
    this.stamp = (this.stamp + 1) >>> 0
    if (!this.stamp) { this.stamps.fill(0); this.stamp = 1 }
    const cell = origin.toArray().map(v => Math.floor(v / CELL)), direction = delta.toArray(), start = origin.toArray()
    const steps = direction.map(Math.sign), next = direction.map((d, i) => d ? ((cell[i] + (d > 0 ? 1 : 0)) * CELL - start[i]) / d : Infinity)
    const stride = direction.map(d => d ? CELL / Math.abs(d) : Infinity)
    let closest = length + 1e-8, winner = -1
    for (let n = 0; n < 2048; n++) {
      for (const id of this.bins.get(key(cell[0], cell[1], cell[2])) ?? []) {
        if (this.stamps[id] === this.stamp) continue
        this.stamps[id] = this.stamp; this.read(id)
        if (!this.ray.intersectTriangle(this.a, this.b, this.c, false, this.hit)) continue
        const distance = this.hit.distanceTo(origin)
        if (distance <= length + 1e-8 && distance < closest) { closest = distance; winner = id }
      }
      const axis = next[0] <= next[1] && next[0] <= next[2] ? 0 : next[1] <= next[2] ? 1 : 2
      if (next[axis] > 1 || next[axis] * length > closest) break
      cell[axis] += steps[axis]; next[axis] += stride[axis]
    }
    if (winner < 0) return undefined
    this.read(winner)
    const normal = this.b.clone().sub(this.a).cross(this.c.clone().sub(this.a)).normalize()
    if (normal.dot(this.ray.direction) > 0) normal.negate()
    return { point: plain(origin.addScaledVector(this.ray.direction, closest)), normal: plain(normal), distance: closest,
      owner: this.owners[winner], triangle: this.faces[winner] }
  }

  private read(id: number) {
    const offset = id * 9
    this.a.fromArray(this.values, offset); this.b.fromArray(this.values, offset + 3); this.c.fromArray(this.values, offset + 6)
  }
  snapshot() { return { triangles: this.owners.length, cells: this.bins.size, bytes: this.values.byteLength + this.stamps.byteLength } }
  dispose() { this.values = new Float32Array(); this.stamps = new Uint32Array(); this.pending = []; this.bins.clear(); this.owners = []; this.faces = []; this.bounds.makeEmpty() }
}
