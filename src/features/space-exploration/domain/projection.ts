import { cameraEye, cameraFov, cameraUp, type CameraPose } from './cameraModel'
import { allBodyWorldPositions } from './layout'
import { cross3, dot3, normalize3, sub3, type Vec3 } from './vec3'
import { visualScale } from './visualScale'

export interface Viewport {
  width: number
  height: number
}

export interface ProjectedBody {
  id: string
  x: number
  y: number
  radius: number
  visible: boolean
}

export const SAFE_MARGIN = 0.03

export function projectPoint(point: Vec3, pose: CameraPose, viewport: Viewport, worldRadius = 1): ProjectedBody {
  const eye = cameraEye(pose)
  const forward = normalize3(sub3(pose.target, eye))
  const right = normalize3(cross3(forward, cameraUp(pose)))
  const up = cross3(right, forward)
  const rel = sub3(point, eye)
  const camZ = dot3(rel, forward)
  const camX = dot3(rel, right)
  const camY = dot3(rel, up)
  const f = 1 / Math.tan(cameraFov() * Math.PI / 360)
  const aspect = viewport.width / Math.max(1, viewport.height)
  if (camZ <= 0.15) return { id: '', x: -1, y: -1, radius: 0, visible: false }
  const ndcX = (camX * f / aspect) / camZ
  const ndcY = (camY * f) / camZ
  return {
    id: '',
    x: (ndcX * 0.5 + 0.5) * viewport.width,
    y: (-ndcY * 0.5 + 0.5) * viewport.height,
    radius: Math.max(2, (worldRadius * f / camZ) * viewport.height * 0.5),
    visible: Math.abs(ndcX) <= 1.15 && Math.abs(ndcY) <= 1.15
  }
}

export function projectBodies(pose: CameraPose, viewport: Viewport): ProjectedBody[] {
  return allBodyWorldPositions().map((body) => ({
    ...projectPoint(body.position, pose, viewport, body.radius),
    id: body.id
  }))
}

export function projectedOverlap(a: ProjectedBody, b: ProjectedBody) {
  if (!a.visible || !b.visible) return false
  return Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius
}

export function inSafeFrame(body: ProjectedBody, viewport: Viewport) {
  const margin = Math.min(viewport.width, viewport.height) * SAFE_MARGIN
  return body.visible
    && body.x - body.radius >= margin
    && body.x + body.radius <= viewport.width - margin
    && body.y - body.radius >= margin
    && body.y + body.radius <= viewport.height - margin
}

export function worldSpheresOverlap(idA: 'sun' | 'mercury' | 'earth' | 'moon', idB: typeof idA) {
  const a = visualScale(idA)
  const b = visualScale(idB)
  return a.radius + b.radius >= b.orbitRadius
}
