import { add3, dot3, length3, scale3, sub3, type Vec3 } from './vec3'

export interface ShipCameraObstacle { center: Vec3; radius: number }

/** Sweeps a camera sphere from the target along its boom, using conservative sphere proxies. */
export function constrainShipCamera(
  target: Vec3, desired: Vec3, obstacles: readonly ShipCameraObstacle[], radius = 0.35
) {
  const offset = sub3(desired, target)
  const distance = length3(offset)
  const direction = distance > 0 ? scale3(offset, 1 / distance) : { x: 0, y: 0, z: 0 }
  let allowed = distance
  let blocked = false
  for (const obstacle of obstacles) {
    if (!Number.isFinite(obstacle.radius) || obstacle.radius < 0 ||
      !Object.values(obstacle.center).every(Number.isFinite)) continue
    const relative = sub3(target, obstacle.center)
    const expanded = obstacle.radius + radius
    const c = dot3(relative, relative) - expanded * expanded
    if (c <= 0) { allowed = 0; blocked = true; break }
    const b = dot3(relative, direction)
    const discriminant = b * b - c
    if (b >= 0 || discriminant < 0) continue
    const entry = -b - Math.sqrt(discriminant)
    if (entry <= allowed) allowed = Math.max(0, entry - 0.02)
  }
  return { position: add3(target, scale3(direction, allowed)), distance: allowed,
    occluded: allowed < distance, blocked }
}
