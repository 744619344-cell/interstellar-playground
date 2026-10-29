import { rotateShipVector, type ShipQuaternion } from '../domain/shipFlightMath'
import type { CabinControlInput } from '../domain/cabinControlAssist'

interface Nudge { forward: number; right: number; up: number; seconds: number }

/** View-relative assisted controls plus the retained support-only inertial mapping. */
export function microgravityInput(keys: ReadonlySet<string>, active: boolean, orientation: ShipQuaternion,
  yaw: number, nudge: Nudge, canPush: boolean, assisted = false): CabinControlInput {
  if (!active) return {}
  const value = (positive: string, negative: string) => Number(keys.has(positive)) - Number(keys.has(negative))
  const shift = keys.has('ShiftLeft') || keys.has('ShiftRight'), turning = shift && !assisted
  const forward = (turning ? 0 : value('ArrowUp', 'ArrowDown')) + (assisted ? value('KeyW', 'KeyS') + nudge.forward : 0)
  const right = (turning ? 0 : value('ArrowRight', 'ArrowLeft')) + (assisted ? value('KeyD', 'KeyA') + nudge.right : 0)
  const angle = Number.isFinite(yaw) ? yaw : 0
  const direction = { x: -Math.sin(angle) * forward + Math.cos(angle) * right, y: 0,
    z: -Math.cos(angle) * forward - Math.sin(angle) * right }
  const local = rotateShipVector({ x: -orientation.x, y: -orientation.y, z: -orientation.z, w: orientation.w }, direction)
  const up = value('KeyZ', 'KeyC') + (assisted ? Number(keys.has('Space')) : 0)
  return { forward: (assisted ? 0 : value('KeyW', 'KeyS') + nudge.forward) - local.z,
    right: (assisted ? 0 : value('KeyD', 'KeyA') + nudge.right) + local.x, up: up + local.y + nudge.up,
    push: canPush && !(assisted && keys.has('KeyB')) && (!assisted && keys.has('Space') || nudge.seconds > 0 || !!forward || !!right || assisted && !!up),
    brake: assisted && keys.has('KeyB'), fast: assisted && shift,
    followYaw: assisted && (forward || right) ? angle : undefined,
    pitch: turning ? assisted ? value('ArrowUp', 'ArrowDown') : value('ArrowDown', 'ArrowUp') : 0,
    yaw: turning ? value('ArrowLeft', 'ArrowRight') : assisted ? value('KeyQ', 'KeyE') : 0,
    roll: !assisted || turning ? value('KeyE', 'KeyQ') : 0 }
}
