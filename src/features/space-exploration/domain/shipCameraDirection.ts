import { add3, cross3, dot3, length3, normalize3, scale3, sub3, type Vec3 } from './vec3'

export function cameraPerpendicular(direction: Vec3, preferred: Vec3): Vec3 {
  const projected = sub3(preferred, scale3(direction, dot3(preferred, direction)))
  if (length3(projected) > 1e-6) return normalize3(projected)
  const fallback = Math.abs(direction.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }
  return normalize3(sub3(fallback, scale3(direction, dot3(fallback, direction))))
}

/** Great-circle damping also handles exactly opposite offsets without sticking at 180 degrees. */
export function dampCameraDirection(from: Vec3, to: Vec3, alpha: number): Vec3 {
  const cosine = Math.max(-1, Math.min(1, dot3(from, to)))
  if (cosine > 0.999999) return normalize3(add3(scale3(from, 1 - alpha), scale3(to, alpha)))
  const angle = Math.acos(cosine)
  const cross = cross3(from, to)
  const axis = length3(cross) > 1e-6 ? normalize3(cross) : cameraPerpendicular(from, { x: 0, y: 1, z: 0 })
  const turn = angle * alpha
  return normalize3(add3(scale3(from, Math.cos(turn)), scale3(cross3(axis, from), Math.sin(turn))))
}
