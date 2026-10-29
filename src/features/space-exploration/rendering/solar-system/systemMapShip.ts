import type { ShipFlightRuntime } from '../spacecraft/shipFlightRuntime'
import { cameraEye, type CameraPose } from '../../domain/cameraModel'
import { projectPoint, type ProjectedBody, type Viewport } from '../../domain/projection'
import { bodyPositionsAt } from '../../domain/orbitMotion'
import { SHIP_PROTECTION } from '../../domain/shipNavigation'
import { visualScale } from '../../domain/visualScale'
import { dot3, length3, normalize3, sub3, type Vec3 } from '../../domain/vec3'
import type { ShipLoadProgress } from '../spacecraft/shipLoadProgress'

export interface SystemShipSnapshot {
  position: Vec3; projected: ProjectedBody; status: 'loading' | 'ready' | 'failed'; suspended: boolean; parked: boolean
  loadProgress?: ShipLoadProgress; loadError?: string
  previewReady?: boolean
  crewReady?: boolean
  microgravity?: boolean
}

export function projectSystemShip(ship: ReturnType<ShipFlightRuntime['snapshot']> | undefined,
  pose: CameraPose, viewport: Viewport, time: number): SystemShipSnapshot | undefined {
  if (!ship) return undefined
  const projected = projectPoint(ship.worldPosition, pose, viewport, SHIP_PROTECTION.radius)
  const eye = cameraEye(pose), delta = sub3(ship.worldPosition, eye), distance = length3(delta), ray = normalize3(delta)
  for (const [id, center] of bodyPositionsAt(time)) {
    const relative = sub3(center, eye), depth = dot3(relative, ray), radius = visualScale(id).radius
    if (depth <= 0 || depth >= distance) continue
    if (dot3(relative, relative) - depth * depth < radius * radius) { projected.visible = false; break }
  }
  return { position: ship.worldPosition, projected, status: ship.model.status, suspended: ship.suspended, parked: ship.parked,
    loadProgress: ship.model.loadProgress, loadError: ship.model.loadError, previewReady: ship.model.previewReady,
    crewReady: !!ship.model.cabin && ship.model.status === 'ready' && !ship.suspended,
    microgravity: !!ship.model.cabin && 'microgravity' in ship.model.cabin }
}

export function hitSystemShip(ship: SystemShipSnapshot | undefined, x: number, y: number) {
  return !!ship && (ship.status === 'ready' || (ship.status === 'loading' && ship.previewReady === true)) && !ship.suspended && ship.projected.visible
    && Math.hypot(x - ship.projected.x, y - ship.projected.y) <= Math.max(12, ship.projected.radius)
}
