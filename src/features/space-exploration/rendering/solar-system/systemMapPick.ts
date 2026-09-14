import type { SystemBodyId } from '../../domain/registry'
import type { ProjectedBody } from '../../domain/projection'
import { dot3, scale3, sub3, type Vec3 } from '../../domain/vec3'

export interface PickSphere {
  id: SystemBodyId
  center: Vec3
  radius: number
}

export function pickClosestSphere(origin: Vec3, direction: Vec3, spheres: PickSphere[]): SystemBodyId | null {
  let best: { id: SystemBodyId, distance: number } | null = null
  for (const sphere of spheres) {
    const distance = raySphere(origin, direction, sphere.center, sphere.radius)
    if (distance === null) continue
    if (!best || distance < best.distance) best = { id: sphere.id, distance }
  }
  return best?.id ?? null
}

export function pickProjectedBody(x: number, y: number, bodies: ProjectedBody[], minRadius: number) {
  let best: { id: SystemBodyId, score: number } | null = null
  for (const body of bodies) {
    if (!body.visible) continue
    const hitRadius = Math.max(body.radius, minRadius)
    const distance = Math.hypot(x - body.x, y - body.y)
    if (distance > hitRadius) continue
    const score = distance / hitRadius
    if (!best || score < best.score) best = { id: body.id as SystemBodyId, score }
  }
  return best?.id ?? null
}

function raySphere(origin: Vec3, direction: Vec3, center: Vec3, radius: number) {
  const oc = sub3(origin, center)
  const b = dot3(oc, direction)
  const c = dot3(oc, oc) - radius * radius
  const disc = b * b - c
  if (disc < 0) return null
  const t = -b - Math.sqrt(disc)
  return t >= 0 ? t : null
}

export function screenRay(ndcX: number, ndcY: number, eye: Vec3, target: Vec3, up: Vec3, fovDeg: number, aspect: number) {
  const forward = normalize(sub3(target, eye))
  const right = normalize(cross(forward, up))
  const camUp = cross(right, forward)
  const tan = Math.tan(fovDeg * Math.PI / 360)
  const dir = normalize({
    x: forward.x + right.x * ndcX * tan * aspect + camUp.x * ndcY * tan,
    y: forward.y + right.y * ndcX * tan * aspect + camUp.y * ndcY * tan,
    z: forward.z + right.z * ndcX * tan * aspect + camUp.z * ndcY * tan
  })
  return { origin: eye, direction: dir }
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1
  return scale3(v, 1 / len)
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }
}
