import { add3, vec3, type Vec3 } from './vec3'
import { getSystemBody, SYSTEM_BODIES, type SystemBodyId } from './registry'
import { visualScale } from './visualScale'

const ORBIT_SPEED_MULTIPLIER = 0.7
const SPIN_SPEED_MULTIPLIER = 1.8

const ORBIT_SPEED: Record<SystemBodyId, number> = {
  sun: 0,
  mercury: 0.105,
  venus: 0.078,
  earth: 0.058,
  moon: 0.22,
  mars: 0.046,
  jupiter: 0.027,
  saturn: 0.019,
  uranus: 0.014,
  neptune: 0.011
}

const SPIN_SPEED: Record<SystemBodyId, number> = {
  sun: 0.025,
  mercury: 0.018,
  venus: -0.012,
  earth: 0.075,
  moon: 0.018,
  mars: 0.068,
  jupiter: 0.11,
  saturn: 0.095,
  uranus: -0.055,
  neptune: 0.065
}

export function bodyPositionsAt(seconds: number) {
  const cache = new Map<SystemBodyId, Vec3>()
  for (const body of SYSTEM_BODIES) positionAt(body.id, seconds, cache)
  return cache
}

export function bodySpinAt(id: SystemBodyId, seconds: number) {
  return SPIN_SPEED[id] * SPIN_SPEED_MULTIPLIER * seconds
}

function positionAt(id: SystemBodyId, seconds: number, cache: Map<SystemBodyId, Vec3>): Vec3 {
  const cached = cache.get(id)
  if (cached) return cached
  const body = getSystemBody(id)
  const scale = visualScale(id)
  const parent = body.parentId ? positionAt(body.parentId, seconds, cache) : vec3(0, 0, 0)
  const angle = scale.orbitAngle + ORBIT_SPEED[id] * ORBIT_SPEED_MULTIPLIER * seconds
  const radius = scale.orbitRadius
  const position = body.parentId
    ? add3(parent, vec3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius))
    : parent
  cache.set(id, position)
  return position
}
