import { add3, cross3, length3, scale3, type Vec3 } from './vec3'

export interface ShipQuaternion { x: number; y: number; z: number; w: number }

export function normalizeRotation(q: ShipQuaternion): ShipQuaternion {
  const size = Math.hypot(q.x, q.y, q.z, q.w)
  if (!Number.isFinite(size) || size < 1e-12) return { x: 0, y: 0, z: 0, w: 1 }
  return { x: q.x / size, y: q.y / size, z: q.z / size, w: q.w / size }
}

export function rotateShipVector(q: ShipQuaternion, v: Vec3): Vec3 {
  const t = scale3(cross3(q, v), 2)
  return add3(v, add3(scale3(t, q.w), cross3(q, t)))
}

export function integrateShipRotation(q: ShipQuaternion, omega: Vec3, dt: number): ShipQuaternion {
  const speed = length3(omega)
  if (speed < 1e-12) return { ...q }
  const half = speed * dt / 2
  const v = scale3(omega, Math.sin(half) / speed)
  const w = Math.cos(half)
  // q * delta: angular velocity belongs to the ship's local frame.
  return normalizeRotation({
    x: q.w * v.x + q.x * w + q.y * v.z - q.z * v.y,
    y: q.w * v.y - q.x * v.z + q.y * w + q.z * v.x,
    z: q.w * v.z + q.x * v.y - q.y * v.x + q.z * w,
    w: q.w * w - q.x * v.x - q.y * v.y - q.z * v.z
  })
}

export function interpolateShipRotation(a: ShipQuaternion, b: ShipQuaternion, t: number) {
  const sign = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w < 0 ? -1 : 1
  return normalizeRotation({
    x: a.x * (1 - t) + b.x * t * sign,
    y: a.y * (1 - t) + b.y * t * sign,
    z: a.z * (1 - t) + b.z * t * sign,
    w: a.w * (1 - t) + b.w * t * sign
  })
}
