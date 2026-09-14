import { SHIP_PROTECTION, shipTargetInfo, type ShipNavigationBody } from './shipNavigation'
import type { ShipFlightState } from './shipFlightModel'
import { length3, sub3 } from './vec3'

export const SHIP_ROUTE_IDS = ['earth', 'moon', 'saturn'] as const
export type ShipRouteId = typeof SHIP_ROUTE_IDS[number]
export type ShipRoutePhase = 'idle' | 'cruise' | 'approach' | 'arrived'

export interface ShipRouteState { id: ShipRouteId; phase: ShipRoutePhase }
export interface ShipRouteSample {
  clearance: number; closingSpeed: number; relativeSpeed: number; shipSpeed: number
}

/** Arrival sits outside the collision envelope; assist never feeds this machine. */
export const SHIP_ROUTE = Object.freeze({
  approachClearance: 40,
  arrivalMinClearance: SHIP_PROTECTION.margin + 1,
  arrivalMaxClearance: 18,
  maxArrivalRelativeSpeed: 6,
  departSpeed: 0.35
})

export const SHIP_ROUTE_PHASE_LABEL: Record<ShipRoutePhase, string> = {
  idle: '未开始', cruise: '巡航', approach: '接近', arrived: '已抵达'
}
export const SHIP_ROUTE_NAME: Record<ShipRouteId, string> = {
  earth: '地球', moon: '月球', saturn: '土星'
}
const HINT: Record<ShipRoutePhase, string> = {
  idle: '手动起航飞向目标，航向辅助只修正朝向',
  cruise: '保持驾驶，接近前开始减速',
  approach: '减速进入安全净空，勿高速掠过或进入保护区',
  arrived: '已到达安全观测位置，可选择另一条航线'
}

export function isShipRouteId(value: unknown): value is ShipRouteId {
  return value === 'earth' || value === 'moon' || value === 'saturn'
}
export function createShipRoute(id: ShipRouteId): ShipRouteState {
  return { id, phase: 'idle' }
}
export function shipRouteHint(route?: ShipRouteState) {
  return route ? HINT[route.phase] : '可选择地球、月球或土星航线'
}

export function observeShipRoute(state: ShipFlightState, body?: ShipNavigationBody): ShipRouteSample | undefined {
  if (!body) return undefined
  const info = shipTargetInfo(state, body)
  if (!info) return undefined
  const sample = {
    clearance: info.clearance,
    closingSpeed: info.closingSpeed,
    relativeSpeed: length3(sub3(state.velocity, body.velocity)),
    shipSpeed: length3(state.velocity)
  }
  return usable(sample) ? sample : undefined
}

export function stepShipRoute(
  route: ShipRouteState, sample: ShipRouteSample | undefined, advanced: boolean
): ShipRouteState {
  if (route.phase === 'arrived' || !advanced || !usable(sample)) return route
  if (route.phase === 'idle') {
    return sample.shipSpeed >= SHIP_ROUTE.departSpeed ? { id: route.id, phase: 'cruise' } : route
  }
  if (route.phase === 'cruise') {
    return inApproach(sample) ? { id: route.id, phase: 'approach' } : route
  }
  if (hasArrived(sample)) return { id: route.id, phase: 'arrived' }
  return inApproach(sample) ? route : { id: route.id, phase: 'cruise' }
}

function usable(sample?: ShipRouteSample): sample is ShipRouteSample {
  return !!sample && [sample.clearance, sample.closingSpeed, sample.relativeSpeed, sample.shipSpeed]
    .every(Number.isFinite)
}
function inApproach(sample: ShipRouteSample) {
  return sample.clearance <= SHIP_ROUTE.approachClearance
}
function hasArrived(sample: ShipRouteSample) {
  return sample.clearance >= SHIP_ROUTE.arrivalMinClearance
    && sample.clearance <= SHIP_ROUTE.arrivalMaxClearance
    && sample.relativeSpeed <= SHIP_ROUTE.maxArrivalRelativeSpeed
    && sample.closingSpeed <= SHIP_ROUTE.maxArrivalRelativeSpeed
}
