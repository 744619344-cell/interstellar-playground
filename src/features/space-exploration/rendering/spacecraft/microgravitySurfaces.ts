import { Box3, Group, Mesh, Object3D, Vector3 } from 'three'
import type { Vec3 } from '../../domain/vec3'
import { CabinTriangleField, type CabinSurfaceHit } from './cabinTriangleField'

export interface CabinGrip { id: string; point: Vector3; normal: Vector3; surfaceNormal: Vector3; kind?: 'handrail'; title?: string }
export interface CabinCollisionProbe { owner: string; triangle: number; sample: number; from: Vec3; point: Vec3; hit: Vec3; normal: Vec3; delta: Vec3; samples: Vec3[]; identity?: { mesh: string; vertex: number; bone?: string }; pose?: { rootRotation: number[]; bones: { name: string; rotation: number[] }[] }; escape?: { active: boolean; ready: boolean; stalled: boolean; locked: boolean; elapsed: number; watchTime: number } }
const vector = (p: Vec3) => new Vector3(p.x, p.y, p.z)
const under = (o: Object3D, test: (p: Object3D) => boolean) => { for (let p: Object3D | null = o; p; p = p.parent) if (test(p)) return true; return false }

/** Actual static/source triangles plus separately transformed moving-leaf triangles. */
export class MicrogravitySurfaces {
  private fixed: CabinTriangleField
  private moving: { root: Object3D; field: CabinTriangleField }[] = []
  private probe = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cabinContactProbe') === '1'
  lastCollision?: CabinCollisionProbe
  readonly grips: CabinGrip[] = []

  constructor(private model: Group) {
    const fixed: Mesh[] = [], moving = new Map<Object3D, Mesh[]>()
    model.updateMatrixWorld(true)
    model.traverse(o => {
      if (!(o instanceof Mesh) || under(o, p => p.name === 'MicrogravitySourceOwnership' || p.name.includes('ThrusterPlume') || p.userData.currentShipPart === 'crew' || p.userData.nonSolid)) return
      let leaf: Object3D | undefined
      for (let p: Object3D | null = o; p; p = p.parent) if (p.name === 'AftDoorLeaf' || p.name === 'InnerDoorLeaf' || p.userData.microDoorLeaf) { leaf = p; break }
      if (leaf) { const list = moving.get(leaf) ?? []; list.push(o); moving.set(leaf, list) } else fixed.push(o)
    })
    this.fixed = new CabinTriangleField(model, fixed)
    for (const [root, meshes] of moving) this.moving.push({ root, field: new CabinTriangleField(root, meshes) })
    this.findGrips()
    this.findHatchGrips()
  }

  private castOnce(from: Vec3, to: Vec3): CabinSurfaceHit | undefined {
    let closest = this.fixed.cast(from, to)
    for (const item of this.moving) {
      const a = item.root.worldToLocal(this.model.localToWorld(vector(from))), b = item.root.worldToLocal(this.model.localToWorld(vector(to))), hit = item.field.cast(a, b)
      if (!hit) continue
      const point = this.model.worldToLocal(item.root.localToWorld(vector(hit.point))), normal = vector(hit.normal).transformDirection(item.root.matrixWorld).transformDirection(this.model.matrixWorld.clone().invert())
      const distance = point.distanceTo(vector(from))
      if (!closest || distance < closest.distance) closest = { ...hit, point, normal, distance }
    }
    return closest
  }
  cast(from: Vec3, to: Vec3, ignore?: Object3D): CabinSurfaceHit | undefined {
    const start = vector(from), end = vector(to), direction = end.clone().sub(start).normalize(); let current = start.clone(), last: CabinSurfaceHit | undefined
    for (let i = 0; i < 32; i++) {
      const hit = this.castOnce(current, end); if (!hit) return undefined
      last = { ...hit, distance: start.distanceTo(vector(hit.point)) }
      if (!ignore || !under(hit.owner, o => o === ignore)) return { ...hit, distance: start.distanceTo(vector(hit.point)) }
      if (vector(hit.point).distanceTo(end) < .002) return undefined
      current = vector(hit.point).addScaledVector(direction, .002)
    }
    return last
  }
  clear(from: Vec3, to: Vec3, tolerance = .025, ignore?: Object3D) { const hit = this.cast(from, to, ignore); return !hit || hit.distance >= vector(from).distanceTo(vector(to)) - tolerance }

  private findGrips() {
    for (const name of ['micro-port-liner', 'micro-starboard-liner', 'micro-work', 'micro-locker', 'micro-inner-airlock']) {
      const part = this.model.getObjectByName(name); if (!part) continue
      const inverse = part.matrixWorld.clone().invert(), points: Vector3[] = [], box = new Box3()
      part.traverse(o => { if (o instanceof Mesh) { const p = o.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) { const point = new Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).applyMatrix4(inverse); points.push(point); box.expandByPoint(point) } } })
      const size = box.getSize(new Vector3()), liner = name.includes('liner')
      const coordinates = liner ? [-.17, .17].flatMap(x => [.31, .72].map(y => [x, y, .95])) : [[-.39, .54, .8], [.39, .54, .8]]
      coordinates.forEach(([x, y, z], index) => {
        const goal = new Vector3(box.min.x + size.x * (.5 + x), box.min.y + size.y * y, box.min.z + size.z * z)
        let chosen: Vector3 | undefined, score = Infinity
        for (const point of points) { const distance = point.distanceToSquared(goal); if (distance < score) { chosen = point; score = distance } }
        if (!chosen) return
        const point = this.model.worldToLocal(part.localToWorld(chosen.clone())), normal = new Vector3(0, 0, 1).transformDirection(part.matrixWorld).transformDirection(this.model.matrixWorld.clone().invert())
        const surface = this.fixed.cast(point.clone().addScaledVector(normal, .3), point.clone().addScaledVector(normal, -.1))
        // Only this frozen-source rail has been visually and cross-section verified so far.
        const kind = name === 'micro-port-liner' && index === 1 ? 'handrail' as const : undefined
        this.grips.push({ id: `${name}:rail:${index}`, point: surface ? vector(surface.point) : point, normal, surfaceNormal: surface ? vector(surface.normal) : normal.clone(), ...(kind && { kind }) })
      })
    }
  }

  private findHatchGrips() {
    for (const name of ['InnerDoorHinge', 'AftDoorHinge']) {
      const hinge = this.model.getObjectByName(name), leaf = this.model.getObjectByName(name === 'InnerDoorHinge' ? 'InnerDoorLeaf' : 'AftDoorLeaf')
      if (!hinge || !leaf) continue
      const position = hinge.position.clone(), quaternion = hinge.quaternion.clone()
      if (hinge.userData.microClosedPosition) hinge.position.fromArray(hinge.userData.microClosedPosition)
      if (hinge.userData.microClosedRotation) hinge.quaternion.fromArray(hinge.userData.microClosedRotation)
      hinge.updateWorldMatrix(true, true)
      const bounds = new Box3().setFromObject(leaf, true).applyMatrix4(this.model.matrixWorld.clone().invert()), center = bounds.getCenter(new Vector3())
      hinge.position.copy(position); hinge.quaternion.copy(quaternion); hinge.updateWorldMatrix(true, true)
      for (const side of [-1, 1]) for (const rear of [-1, 1]) for (const dy of [-.3, .3]) {
        const x = side < 0 ? bounds.min.x - .06 : bounds.max.x + .06, from = new Vector3(x, center.y + dy, center.z + rear * .7), to = new Vector3(x, center.y + dy, center.z - rear * .2), hit = this.fixed.cast(from, to)
        if (hit) this.grips.push({ id: `${name}:lip:${side}:${rear}:${dy}`, point: vector(hit.point), normal: new Vector3(0, 0, rear), surfaceNormal: vector(hit.normal) })
      }
    }
  }

  /** Sweeps real posed extremal skin vertices. The collision removes only inward normal velocity. */
  translate(points: readonly Vector3[], from: Vec3, proposed: Vec3, velocity: Vec3, release?: { point: Vec3; normal: Vec3 }, slide = false) {
    let delta = vector(proposed).sub(vector(from)); const moved = new Vector3(), next = vector(velocity); let contact: { owner: string; sample: number } | undefined
    for (let pass = 0; pass < (slide ? 3 : 1) && delta.lengthSq() > 1e-16; pass++) {
      let amount = 1, normal: Vec3 | undefined, best: { hit: CabinSurfaceHit; point: Vector3; sample: number } | undefined
      for (let sample = 0; sample < points.length; sample++) {
        const point = points[sample].clone().add(moved), hit = this.cast(point, point.clone().add(delta)); if (!hit) continue
        if (release && hit.distance < .008 && point.distanceTo(vector(release.point)) < .15 && delta.dot(vector(release.normal)) > 0) continue
        const fraction = Math.max(0, (hit.distance - .004) / delta.length())
        if (fraction < amount) { amount = fraction; normal = hit.normal; contact = { owner: hit.owner?.name ?? '', sample }; if (this.probe) best = { hit, point, sample } }
      }
      if (best) this.lastCollision = { owner: best.hit.owner.name, triangle: best.hit.triangle, sample: best.sample, from: { ...vector(from).add(moved) }, point: { ...best.point }, hit: { ...best.hit.point }, normal: { ...best.hit.normal }, delta: { ...delta }, samples: points.map(p => ({ ...p.clone().add(moved) })) }
      moved.addScaledVector(delta, amount)
      if (!normal) break
      const n = vector(normal)
      // Keep a horizontal command horizontal while sliding along a sloped fitting.
      if (slide && Math.abs(delta.y) < 1e-6 && n.x * n.x + n.z * n.z > .05) { n.y = 0; n.normalize() }
      const speed = next.length(), inward = next.dot(n)
      if (inward < 0) next.addScaledVector(n, -inward)
      if (!slide) break
      delta = delta.multiplyScalar(1 - amount)
      const remaining = delta.length(), remainingInward = delta.dot(n)
      if (remainingInward < 0) delta.addScaledVector(n, -remainingInward)
      const tangent = delta.length(), tangentSpeed = next.length()
      // Assisted motion can keep a useful pace along an edge, but never gain path length.
      if (tangent > remaining * .15 && tangent > 1e-10) delta.multiplyScalar(Math.min(2, remaining / tangent))
      if (tangentSpeed > speed * .15 && tangentSpeed > 1e-10) next.multiplyScalar(Math.min(2, speed / tangentSpeed))
    }
    return { position: vector(from).add(moved), velocity: next, contact }
  }
  poseClear(before: readonly Vector3[], after: readonly Vector3[], release?: { point: Vec3; normal: Vec3 }, tolerance = .003) {
    return before.length === after.length && before.every((p, i) => {
      if (this.clear(p, after[i], tolerance)) return true
      const delta = after[i].clone().sub(p), hit = this.cast(p, after[i])
      return !!release && p.distanceTo(vector(release.point)) < .18 && delta.dot(vector(release.normal)) > 0 && !!hit && hit.distance < .035
    })
  }
  rememberGrip(grip: CabinGrip) {
    const index = this.grips.findIndex(previous => previous.id === grip.id)
    if (index < 0) this.grips.push(grip); else this.grips[index] = grip
  }
  nearestGrip(position: Vec3, reachable?: (grip: CabinGrip) => boolean) {
    return this.grips.filter(g => g.point.distanceTo(vector(position)) <= 1.05 && this.clear(position, g.point))
      .sort((a, b) => a.point.distanceToSquared(vector(position)) - b.point.distanceToSquared(vector(position))).find(g => !reachable || reachable(g))
  }
  dispose() { this.fixed.dispose(); this.moving.forEach(m => m.field.dispose()); this.moving = []; this.grips.length = 0 }
}
