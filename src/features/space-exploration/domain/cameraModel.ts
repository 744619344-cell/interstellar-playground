import { add3, cross3, lerp3, normalize3, scale3, sub3, vec3, type Vec3 } from './vec3'
import { bodyWorldPosition } from './layout'
import type { SystemBodyId } from './registry'
import {
  CAMERA_FOV_DEG, OVERVIEW_DISTANCE, OVERVIEW_PITCH, OVERVIEW_YAW, maxSystemRadius, visualScale
} from './visualScale'

export interface CameraPose {
  yaw: number
  pitch: number
  distance: number
  target: Vec3
}

export interface CameraTransition {
  generation: number
  from: CameraPose
  to: CameraPose
  elapsed: number
  duration: number
}

export const MIN_DISTANCE = 2.2
export const MAX_DISTANCE = 1800
export const MIN_PITCH = -Math.PI
export const MAX_PITCH = Math.PI
export const FOCUS_DURATION = 0.72
export const DRAG_YAW = 0.005
export const DRAG_PITCH = 0.004
export const ZOOM_STEP = 0.0018
const OVERVIEW_FIT_PADDING = 1.005

interface OverviewViewport { width: number, height: number }

export function overviewPose(viewport?: OverviewViewport): CameraPose {
  return {
    yaw: OVERVIEW_YAW,
    pitch: OVERVIEW_PITCH,
    distance: viewport ? fitOverviewDistance(viewport) : OVERVIEW_DISTANCE,
    target: vec3(0, 0, 0)
  }
}

export function fitOverviewDistance(viewport: OverviewViewport) {
  if (viewport.width < 1 || viewport.height < 1) return OVERVIEW_DISTANCE
  let near = 120
  let far = MAX_DISTANCE
  for (let step = 0; step < 20; step += 1) {
    const distance = (near + far) / 2
    if (overviewFits(distance, viewport)) far = distance
    else near = distance
  }
  return Math.min(MAX_DISTANCE, far * OVERVIEW_FIT_PADDING)
}

function overviewFits(distance: number, viewport: OverviewViewport) {
  const pose = { yaw: OVERVIEW_YAW, pitch: OVERVIEW_PITCH, distance, target: vec3(0, 0, 0) }
  const eye = cameraEye(pose)
  const forward = normalize3(scale3(eye, -1))
  const right = normalize3(cross3(forward, vec3(0, 1, 0)))
  const up = cross3(right, forward)
  const radius = maxSystemRadius()
  const focal = 1 / Math.tan(CAMERA_FOV_DEG * Math.PI / 360)
  const aspect = viewport.width / viewport.height
  // Keep the header clear while allowing the lower orbit to use more of the canvas.
  const inset = { x: Math.min(28, viewport.width * 0.06), top: 104, bottom: 32 }
  for (let index = 0; index < 96; index += 1) {
    const angle = index / 96 * Math.PI * 2
    const relative = sub3(vec3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius), eye)
    const depth = relative.x * forward.x + relative.y * forward.y + relative.z * forward.z
    const x = ((relative.x * right.x + relative.y * right.y + relative.z * right.z) * focal / aspect / depth * 0.5 + 0.5) * viewport.width
    const y = (-(relative.x * up.x + relative.y * up.y + relative.z * up.z) * focal / depth * 0.5 + 0.5) * viewport.height
    if (depth <= 1 || x < inset.x || x > viewport.width - inset.x || y < inset.top || y > viewport.height - inset.bottom) return false
  }
  return true
}

export function clampPose(pose: CameraPose): CameraPose {
  return {
    yaw: wrapAngle(pose.yaw),
    pitch: wrapAngle(pose.pitch),
    distance: Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, pose.distance)),
    target: pose.target
  }
}

export function applyOrbitDrag(pose: CameraPose, dx: number, dy: number) {
  return clampPose({
    ...pose,
    yaw: pose.yaw - dx * DRAG_YAW,
    pitch: pose.pitch + dy * DRAG_PITCH
  })
}

export function applyZoom(pose: CameraPose, deltaY: number) {
  return clampPose({
    ...pose,
    distance: pose.distance * Math.exp(deltaY * ZOOM_STEP)
  })
}

export function applyPan(pose: CameraPose, dx: number, dy: number, viewportHeight: number) {
  const eye = cameraEye(pose)
  const forward = normalize3(sub3(pose.target, eye))
  const right = normalize3(cross3(forward, cameraUp(pose)))
  const up = normalize3(cross3(right, forward))
  const unitsPerPixel = 2 * pose.distance * Math.tan(CAMERA_FOV_DEG * Math.PI / 360) / Math.max(1, viewportHeight)
  const horizontal = scale3(right, -dx * unitsPerPixel)
  const vertical = scale3(up, dy * unitsPerPixel)
  return { ...pose, target: add3(pose.target, add3(horizontal, vertical)) }
}

export function focusPose(id: SystemBodyId, current: CameraPose, dynamicPosition = bodyWorldPosition(id)): CameraPose {
  const scale = visualScale(id)
  const fitRadius = Math.max(scale.radius, scale.ringOuter ?? 0)
  const fit = Math.max(
    fitRadius * 1.25 / Math.tan(CAMERA_FOV_DEG * Math.PI / 360),
    scale.radius + 1.2
  )
  return clampPose({
    yaw: current.yaw,
    pitch: current.pitch,
    distance: fit,
    target: dynamicPosition
  })
}

export function cameraEye(pose: CameraPose): Vec3 {
  const cp = Math.cos(pose.pitch)
  return add3(pose.target, vec3(
    pose.distance * cp * Math.sin(pose.yaw),
    pose.distance * Math.sin(pose.pitch),
    pose.distance * cp * Math.cos(pose.yaw)
  ))
}

export function cameraUp(pose: CameraPose): Vec3 {
  return vec3(
    -Math.sin(pose.pitch) * Math.sin(pose.yaw),
    Math.cos(pose.pitch),
    -Math.sin(pose.pitch) * Math.cos(pose.yaw)
  )
}

export function startTransition(from: CameraPose, to: CameraPose, generation: number): CameraTransition {
  return { generation, from: clonePose(from), to: clonePose(to), elapsed: 0, duration: FOCUS_DURATION }
}

export function stepTransition(transition: CameraTransition, dt: number) {
  const elapsed = Math.min(transition.duration, transition.elapsed + dt)
  const t = smoothstep(elapsed / transition.duration)
  return {
    pose: mixPose(transition.from, transition.to, t),
    next: { ...transition, elapsed },
    done: elapsed >= transition.duration
  }
}

export function cameraFov() {
  return CAMERA_FOV_DEG
}

export function clonePose(pose: CameraPose): CameraPose {
  return { yaw: pose.yaw, pitch: pose.pitch, distance: pose.distance, target: { ...pose.target } }
}

function mixPose(a: CameraPose, b: CameraPose, t: number): CameraPose {
  return {
    yaw: a.yaw + (b.yaw - a.yaw) * t,
    pitch: a.pitch + (b.pitch - a.pitch) * t,
    distance: a.distance + (b.distance - a.distance) * t,
    target: lerp3(a.target, b.target, t)
  }
}

function smoothstep(t: number) {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

function wrapAngle(value: number) {
  return Math.atan2(Math.sin(value), Math.cos(value))
}
