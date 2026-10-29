import { Matrix3, Mesh, Vector3, type Group } from 'three'
import type { MicrogravitySurfaces } from './microgravitySurfaces'

interface Edge { a: Vector3; b: Vector3; normals: Vector3[] }
interface Contact { owner: Mesh; local: Vector3 }

/** Cable bends are derived from actual source edges. No invisible guide/anchor geometry. */
export class MicrogravityRopeRoute {
  private features = new Map<Mesh, Edge[]>()
  private contacts: Contact[] = []
  private valid = true
  constructor(private model: Group, private surfaces: MicrogravitySurfaces) {}
  private point(c: Contact) { return this.model.worldToLocal(c.owner.localToWorld(c.local.clone())) }
  private segmentClear(a: Vector3, b: Vector3) { return this.surfaces.clear(a, b, .001) }
  private edges(owner: Mesh) {
    const cached = this.features.get(owner); if (cached) return cached
    const p = owner.geometry.getAttribute('position'), index = owner.geometry.index, keys: string[] = [], edges = new Map<string, Edge>()
    for (let i = 0; i < p.count; i++) keys.push([p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e6)).join(','))
    const count = index?.count ?? p.count
    for (let i = 0; i < count; i += 3) {
      const ids = [0, 1, 2].map(k => index ? index.getX(i + k) : i + k), pts = ids.map(k => new Vector3().fromBufferAttribute(p, k))
      const normal = pts[1].clone().sub(pts[0]).cross(pts[2].clone().sub(pts[0])).normalize()
      for (let j = 0; j < 3; j++) {
        const a = ids[j], b = ids[(j + 1) % 3], key = [keys[a], keys[b]].sort().join('|')
        let edge = edges.get(key); if (!edge) { edge = { a: pts[j], b: pts[(j + 1) % 3], normals: [] }; edges.set(key, edge) }
        edge.normals.push(normal)
      }
    }
    const result = [...edges.values()].filter(e => e.normals.length !== 2 || e.normals[0].dot(e.normals[1]) < .94)
    this.features.set(owner, result); return result
  }
  private candidates(owner: Mesh, hit: Vector3, limit = 36) {
    owner.updateWorldMatrix(true, false)
    const matrix = this.model.matrixWorld.clone().invert().multiply(owner.matrixWorld), normalMatrix = new Matrix3().getNormalMatrix(matrix)
    const edges = this.edges(owner).map(e => {
      const a = e.a.clone().applyMatrix4(matrix), b = e.b.clone().applyMatrix4(matrix), delta = b.clone().sub(a)
      const point = a.clone().addScaledVector(delta, Math.max(0, Math.min(1, hit.clone().sub(a).dot(delta) / delta.lengthSq())))
      return { edge: e, point, tangent: delta.normalize(), score: hit.distanceToSquared(point), length: a.distanceTo(b) }
    }).filter(e => e.length > .025).sort((a, b) => a.score - b.score).slice(0, limit)
    const result: Contact[] = []
    for (const e of edges) {
      const normals = e.edge.normals.map(n => n.clone().applyMatrix3(normalMatrix).normalize())
      const directions = normals.flatMap(n => [n, n.clone().cross(e.tangent), e.tangent.clone().cross(n)])
      if (normals.length === 2) directions.push(normals[0].clone().add(normals[1]).normalize())
      for (const n of directions) {
        const point = e.point.clone().addScaledVector(n, .009)
        result.push({ owner, local: owner.worldToLocal(this.model.localToWorld(point)) })
      }
    }
    return result
  }
  private solve(start: Vector3, end: Vector3, contacts: Contact[]) {
    const unique: Contact[] = []
    contacts.sort((a, b) => { const pa = this.point(a), pb = this.point(b); return pa.distanceTo(start) + pa.distanceTo(end) - pb.distanceTo(start) - pb.distanceTo(end) })
    for (const c of contacts) if (!unique.some(u => this.point(u).distanceToSquared(this.point(c)) < .000004)) { unique.push(c); if (unique.length === 150) break }
    const points = [start, ...unique.map(c => this.point(c)), end], distance = points.map(() => Infinity), previous = points.map(() => -1), visited = new Set<number>()
    distance[0] = 0
    for (let k = 0; k < points.length; k++) {
      let at = -1; for (let i = 0; i < points.length; i++) if (!visited.has(i) && (at < 0 || distance[i] < distance[at])) at = i
      if (at < 0 || !Number.isFinite(distance[at])) break
      if (at === points.length - 1) {
        const path: Contact[] = []; for (let i = previous[at]; i > 0; i = previous[i]) path.unshift(unique[i - 1]); return path
      }
      visited.add(at)
      for (let i = 1; i < points.length; i++) if (!visited.has(i)) {
        const next = distance[at] + points[at].distanceTo(points[i])
        if (next < distance[i] && this.segmentClear(points[at], points[i])) { distance[i] = next; previous[i] = at }
      }
    }
    return undefined
  }
  update(start: Vector3, end: Vector3) {
    if (this.segmentClear(start, end)) { this.contacts = []; this.valid = true; return true }
    const old = this.path(start, end)
    if (old.every((p, i) => !i || this.segmentClear(old[i - 1], p))) { this.valid = true; return true }
    const candidates = [...this.contacts]
    for (const [a, b] of [[start, end], [end, start]]) {
      const hit = this.surfaces.cast(a, b)
      if (hit?.owner instanceof Mesh) candidates.push(...this.candidates(hit.owner, new Vector3().copy(hit.point)))
    }
    let solved = this.solve(start, end, candidates)
    for (let round = 0; !solved && round < 2; round++) {
      const hits: { owner: Mesh; point: Vector3 }[] = []
      for (const [a, b] of [[start, end], [end, start]]) {
        const visible = candidates.filter(c => this.segmentClear(a, this.point(c))).sort((c, d) => this.point(c).distanceTo(b) - this.point(d).distanceTo(b)).slice(0, 8)
        for (const c of visible) {
          const h = this.surfaces.cast(this.point(c), b)
          if (h && !hits.some(hit => hit.owner === h.owner && hit.point.distanceTo(new Vector3().copy(h.point)) < .08)) hits.push({ owner: h.owner, point: new Vector3().copy(h.point) })
        }
      }
      for (const hit of hits) candidates.push(...this.candidates(hit.owner, hit.point, 12))
      solved = this.solve(start, end, candidates)
    }
    if (solved) this.contacts = solved
    this.valid = !!solved; return this.valid
  }
  path(start: Vector3, end: Vector3) { return [start.clone(), ...this.contacts.map(c => this.point(c)), end.clone()] }
  get clear() { return this.valid }
  reset() { this.contacts = []; this.valid = true }
  dispose() { this.reset(); this.features.clear() }
}
