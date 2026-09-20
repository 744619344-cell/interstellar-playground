export const SHIP_INTERACTION_ANCHORS = [
  'cockpit', 'stand-up', 'console', 'inner-door', 'airlock', 'eva', 'tether'
] as const

export type ShipInteractionAnchor = typeof SHIP_INTERACTION_ANCHORS[number]
export type ShipDoorName = 'inner' | 'outer'
export interface ShipDoorMotion { progress: number; target: 0 | 1 }
export interface ShipInteractionState {
  activeAnchor: ShipInteractionAnchor
  seated: boolean
  consoleActive: boolean
  consoleTime: number
  doors: Record<ShipDoorName, ShipDoorMotion>
  notice?: string
}

export const SHIP_INTERACTION_LABEL: Record<ShipInteractionAnchor, string> = {
  cockpit: '驾驶座', 'stand-up': '站立点', console: '控制台', 'inner-door': '内舱门',
  airlock: '气闸', eva: 'EVA 出口', tether: '安全绳'
}

export const SHIP_INTERACTION_NODE: Record<ShipInteractionAnchor, string> = {
  cockpit: 'Anchor_CockpitCamera', 'stand-up': 'Anchor_StandUp', console: 'Anchor_Console',
  'inner-door': 'Anchor_DoorInner', airlock: 'Anchor_Airlock', eva: 'Anchor_EVA', tether: 'Anchor_Tether'
}

const DOOR_SECONDS = 1.3
const EPSILON = 1e-6
const door = (): ShipDoorMotion => ({ progress: 0, target: 0 })
const finiteStep = (seconds: number) => Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, .05) : 0

export function isShipInteractionAnchor(value: string): value is ShipInteractionAnchor {
  return (SHIP_INTERACTION_ANCHORS as readonly string[]).includes(value)
}

export function createShipInteraction(): ShipInteractionState {
  return { activeAnchor: 'cockpit', seated: false, consoleActive: false, consoleTime: 0,
    doors: { inner: door(), outer: door() } }
}

export function selectShipInteraction(state: ShipInteractionState, activeAnchor: ShipInteractionAnchor) {
  return { ...state, activeAnchor, notice: undefined }
}

export function setShipSeated(state: ShipInteractionState, seated: boolean): ShipInteractionState {
  if (state.seated === seated) return state
  return { ...state, seated, activeAnchor: seated ? 'cockpit' : 'stand-up',
    notice: seated ? '已进入驾驶座' : '已离开驾驶座' }
}

function commandDoor(state: ShipInteractionState, name: ShipDoorName): ShipInteractionState {
  const current = state.doors[name]
  const opening = current.target === 0
  const otherName = name === 'inner' ? 'outer' : 'inner'
  const other = state.doors[otherName]
  if (opening && (other.target === 1 || other.progress > EPSILON)) {
    return { ...state, notice: '机械互锁：请先完全关闭另一扇舱门' }
  }
  return { ...state, doors: { ...state.doors, [name]: { ...current, target: opening ? 1 : 0 } },
    notice: `${name === 'inner' ? '内舱门' : '外舱门'}${opening ? '正在开启' : '正在关闭'}` }
}

export function activateShipInteraction(state: ShipInteractionState): {
  state: ShipInteractionState
  view?: 'cockpit' | 'follow'
} {
  if (state.activeAnchor === 'cockpit') return { state: setShipSeated(state, true), view: 'cockpit' }
  if (state.activeAnchor === 'stand-up') return { state: setShipSeated(state, false), view: 'follow' }
  if (state.activeAnchor === 'console') {
    const consoleActive = !state.consoleActive
    return { state: { ...state, consoleActive, notice: `控制台已${consoleActive ? '启动' : '关闭'}` } }
  }
  if (state.activeAnchor === 'inner-door') return { state: commandDoor(state, 'inner') }
  if (state.activeAnchor === 'airlock') return { state: commandDoor(state, 'outer') }
  return { state: { ...state, notice: `${SHIP_INTERACTION_LABEL[state.activeAnchor]}将在 EVA 阶段启用` } }
}

export function stepShipInteraction(state: ShipInteractionState, seconds: number, running: boolean) {
  const dt = running ? finiteStep(seconds) : 0
  if (!dt) return state
  const stepDoor = ({ progress, target }: ShipDoorMotion): ShipDoorMotion => {
    const distance = target - progress
    if (!distance) return { progress, target }
    return { progress: progress + Math.sign(distance) * Math.min(Math.abs(distance), dt / DOOR_SECONDS), target }
  }
  return { ...state,
    consoleTime: state.consoleActive ? (state.consoleTime + dt) % 2 : state.consoleTime,
    doors: { inner: stepDoor(state.doors.inner), outer: stepDoor(state.doors.outer) } }
}

export function shipDoorLabel(door: ShipDoorMotion) {
  if (door.progress <= EPSILON && door.target === 0) return '已关闭'
  if (door.progress >= 1 - EPSILON && door.target === 1) return '已开启'
  return door.target ? '开启中' : '关闭中'
}
