import type { SystemBodyId } from './registry'

export interface VisualScale {
  id: SystemBodyId
  radius: number
  orbitRadius: number
  orbitAngle: number
  ringInner?: number
  ringOuter?: number
}

export const MAX_SAFE_COORD = 480
export const SYSTEM_FAR_PLANE = 2200
export const SYSTEM_NEAR_PLANE = 0.2
export const OVERVIEW_DISTANCE = 400
export const OVERVIEW_YAW = 0.4
export const OVERVIEW_PITCH = 0.63
export const CAMERA_FOV_DEG = 11
export const BODY_RADIUS_MULTIPLIER = 2.3
export const SUN_RADIUS_MULTIPLIER = 1.9
export const RING_RADIUS_MULTIPLIER = 1.25

const SCALES: readonly VisualScale[] = [
  scale('sun', 10, 0, 0),
  scale('mercury', 1.5, 28, 2.69),
  { ...scale('venus', 2.2, 40, 2.15) },
  { ...scale('earth', 2.4, 62, 0.3) },
  { ...scale('moon', 0.85, 14, 5.75) },
  { ...scale('mars', 1.9, 83, 5.63) },
  { ...scale('jupiter', 4.6, 99, 2.91) },
  {
    ...scale('saturn', 4.0, 127, 4.4),
    ringInner: 8 * RING_RADIUS_MULTIPLIER,
    ringOuter: 13.2 * RING_RADIUS_MULTIPLIER
  },
  { ...scale('uranus', 2.8, 152, 5.27) },
  { ...scale('neptune', 2.6, 168, 1.86) }
]

const BY_ID = new Map(SCALES.map((item) => [item.id, item]))

export function visualScale(id: SystemBodyId) {
  const item = BY_ID.get(id)
  if (!item) throw new Error(`missing visual scale: ${id}`)
  return item
}

export function allVisualScales() {
  return SCALES
}

export function maxSystemRadius() {
  return Math.max(...SCALES.map((item) => item.orbitRadius + item.radius + (item.ringOuter ?? 0)))
}

export function spheresSeparated(idA: SystemBodyId, idB: SystemBodyId, parentGap: boolean) {
  const a = visualScale(idA)
  const b = visualScale(idB)
  if (parentGap) return a.radius + b.radius < b.orbitRadius
  return true
}

export function visualOuterRadius(id: SystemBodyId) {
  const item = visualScale(id)
  return Math.max(item.radius, item.ringOuter ?? 0)
}

export function solarOrbitEnvelope(id: Exclude<SystemBodyId, 'sun' | 'moon'>) {
  if (id !== 'earth') return visualOuterRadius(id)
  return Math.max(visualOuterRadius('earth'), visualScale('moon').orbitRadius + visualOuterRadius('moon'))
}

function scale(id: SystemBodyId, radius: number, orbitRadius: number, orbitAngle: number): VisualScale {
  const multiplier = id === 'sun' ? SUN_RADIUS_MULTIPLIER : BODY_RADIUS_MULTIPLIER
  return { id, radius: radius * multiplier, orbitRadius, orbitAngle }
}
