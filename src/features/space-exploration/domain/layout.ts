import { add3, vec3, type Vec3 } from './vec3'
import { getSystemBody, SYSTEM_BODIES, type SystemBodyId } from './registry'
import { visualScale } from './visualScale'

export function localOffset(id: SystemBodyId): Vec3 {
  const scale = visualScale(id)
  if (!getSystemBody(id).parentId) return vec3(0, 0, 0)
  return vec3(
    Math.cos(scale.orbitAngle) * scale.orbitRadius,
    0,
    Math.sin(scale.orbitAngle) * scale.orbitRadius
  )
}

export function bodyWorldPosition(id: SystemBodyId, cache = new Map<SystemBodyId, Vec3>()): Vec3 {
  const hit = cache.get(id)
  if (hit) return hit
  const parentId = getSystemBody(id).parentId
  const local = localOffset(id)
  const world = parentId ? add3(bodyWorldPosition(parentId, cache), local) : local
  cache.set(id, world)
  return world
}

export function allBodyWorldPositions() {
  const cache = new Map<SystemBodyId, Vec3>()
  return SYSTEM_BODIES.map((body) => ({
    id: body.id,
    position: bodyWorldPosition(body.id, cache),
    radius: visualScale(body.id).radius
  }))
}

export function visualDistance(from: Vec3, to: Vec3) {
  return Math.hypot(from.x - to.x, from.y - to.y, from.z - to.z)
}
