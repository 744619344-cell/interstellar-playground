import type { Vec3 } from './vec3'

export const CABIN_CREW = Object.freeze({ radius: .45, height: 1.91, speed: 1.15, step: .025 })
export interface CabinMove { forward: number; right: number }
export interface CabinDoorState { progress: number; target: 0 | 1; blocked: boolean }

/** Ground motion uses the installed model's support/clearance callback, never a new collider mesh. */
export function moveCabinCrew(position: Vec3, input: CabinMove, yaw: number, seconds: number,
  support: (x: number, z: number) => number | undefined) {
  if (![input.forward,input.right,yaw,seconds].every(Number.isFinite) || seconds <= 0)
    return { position: { ...position }, distance: 0, blocked: false, heading: yaw }
  const dt = Math.min(seconds,.05), length = Math.max(1,Math.hypot(input.forward,input.right))
  const forward = input.forward/length, right = input.right/length
  const dx = (-Math.sin(yaw)*forward+Math.cos(yaw)*right)*CABIN_CREW.speed*dt
  const dz = (-Math.cos(yaw)*forward-Math.sin(yaw)*right)*CABIN_CREW.speed*dt
  const count = Math.max(1,Math.ceil(Math.hypot(dx,dz)/CABIN_CREW.step)), next = { ...position }
  let blocked = false
  for (let i=0;i<count;i++) for (const axis of ['x','z'] as const) {
    const delta = (axis==='x'?dx:dz)/count
    if (!delta) continue
    const x = next.x+(axis==='x'?delta:0), z = next.z+(axis==='z'?delta:0), floor = support(x,z)
    if (floor!==undefined && Number.isFinite(floor) && Math.abs(floor-position.y)<.08) Object.assign(next,{x,y:floor,z})
    else blocked = true
  }
  const distance = Math.hypot(next.x-position.x,next.z-position.z)
  return { position: next, distance, blocked, heading: distance>1e-7?Math.atan2(-(next.x-position.x),-(next.z-position.z)):yaw }
}

export function stepCabinDoor(state: CabinDoorState, seconds: number, running: boolean,
  blocks: (from: number,to: number) => boolean): CabinDoorState {
  if (!running || !Number.isFinite(seconds) || seconds<=0) return state
  const distance = state.target-state.progress
  const next = state.progress+Math.sign(distance)*Math.min(Math.abs(distance),Math.min(seconds,.05)/1.3)
  if (distance<0 && blocks(state.progress,next)) return { ...state,target:1,blocked:true }
  if (distance>0 && blocks(state.progress,next)) return { ...state,blocked:true }
  return { ...state,progress:next,blocked:state.blocked&&next<1-1e-6 }
}

export const cabinDoorAngle = (progress: number) => {
  const t = Math.max(0,Math.min(1,Number.isFinite(progress)?(progress-.2)/.8:0))
  return -Math.PI/2*t*t*(3-2*t)
}
export const cabinDoorPull = (progress: number) => {
  const t = Math.max(0,Math.min(1,Number.isFinite(progress)?progress/.2:0))
  return t*t*(3-2*t)
}
export const cabinDoorLabel = ({progress,target}: CabinDoorState) =>
  progress<1e-6&&!target?'已关闭':progress>1-1e-6&&target?'已开启':target?'开启中':'关闭中'
