import { cloneShipFlightState, SHIP_FLIGHT, stepShipFlight, type ShipFlightInput, type ShipFlightState, type ShipMovementBasis } from './shipFlightModel'
import { assistedShipInput, SHIP_PROTECTION, validNavigationBodies, type ShipNavigationBody } from './shipNavigation'
import { add3, dot3, length3, normalize3, scale3, sub3 } from './vec3'
import { stabilizeReleasedAxes } from './shipPilotControl'

const safeRadius = (body: ShipNavigationBody) => body.radius + SHIP_PROTECTION.radius + SHIP_PROTECTION.margin

function resolveOverlaps(state: ShipFlightState, bodies: readonly ShipNavigationBody[]) {
  const arrivals = bodies.map((b) => ({ ...b, center: add3(b.center, scale3(b.velocity, SHIP_FLIGHT.stepSeconds)) }))
  for (let pass = 0; pass < 16; pass++) {
    let corrected = false
    for (const body of arrivals) {
      const delta = sub3(state.position, body.center)
      if (length3(delta) >= safeRadius(body)) continue
      const normal = length3(delta) > 1e-9 ? normalize3(delta) : { x: 0, y: 1, z: 0 }
      state.position = add3(body.center, scale3(normal, safeRadius(body) + 0.001))
      state.velocity = sub3(state.velocity, scale3(normal, Math.min(0, dot3(sub3(state.velocity, body.velocity), normal))))
      corrected = true
    }
    if (!corrected) return
  }
  // Overlapping conservative envelopes may have opposing normals. Recover above the envelope union.
  if (arrivals.some((b) => length3(sub3(state.position, b.center)) < safeRadius(b))) {
    state.position.y = Math.max(...arrivals.map((b) => b.center.y + safeRadius(b))) + 0.001
    state.velocity = { x: 0, y: 0, z: 0 }
  }
}

export function shipBrakingRisk(state: ShipFlightState, bodies: readonly ShipNavigationBody[]) {
  let risk: { id: string; clearance: number; stoppingDistance: number } | undefined
  for (const body of validNavigationBodies(bodies)) {
    const delta = sub3(body.center, state.position)
    const relative = sub3(state.velocity, body.velocity)
    const speed = length3(relative)
    const direction = normalize3(relative)
    const along = dot3(delta, direction)
    const radius = safeRadius(body)
    const sideSquared = Math.max(0, dot3(delta, delta) - along * along)
    const clearance = length3(delta) - radius
    const stoppingDistance = speed * speed / (2 * SHIP_FLIGHT.braking) + speed * 0.25
    if (clearance > 0 && (speed < 1e-9 || along <= 0 || sideSquared > radius * radius)) continue
    const entry = Math.max(0, along - Math.sqrt(Math.max(0, radius * radius - sideSquared)))
    if (clearance <= 0 || entry <= stoppingDistance) {
      if (!risk || clearance < risk.clearance) risk = { id: body.id, clearance, stoppingDistance }
    }
  }
  return risk
}

/** Relative swept spheres stop even a full high-speed crossing between two simulation steps. */
export function constrainShipFlight(previous: ShipFlightState, desired: ShipFlightState,
  bodies: readonly ShipNavigationBody[]) {
  const state = cloneShipFlightState(desired)
  let hit: { body: ShipNavigationBody; t: number } | undefined
  for (const body of bodies) {
    const start = sub3(previous.position, body.center)
    const relativeMove = sub3(sub3(desired.position, previous.position), scale3(body.velocity, SHIP_FLIGHT.stepSeconds))
    const radius = safeRadius(body)
    const c = dot3(start, start) - radius * radius
    const a = dot3(relativeMove, relativeMove)
    const b = dot3(start, relativeMove)
    const d = b * b - a * c
    const t = c <= 0 ? 0 : a > 1e-15 && b < 0 && d >= 0 ? (-b - Math.sqrt(d)) / a : Infinity
    if (t >= 0 && t <= 1 && (!hit || t < hit.t)) hit = { body, t }
  }
  if (!hit) return { state, contact: undefined as string | undefined }
  const body = hit.body
  const relativeStart = sub3(previous.position, body.center)
  const relativeEnd = sub3(desired.position, add3(body.center, scale3(body.velocity, SHIP_FLIGHT.stepSeconds)))
  let normal = normalize3(add3(relativeStart, scale3(sub3(relativeEnd, relativeStart), hit.t)))
  if (length3(normal) < 1e-9) normal = { x: 0, y: 1, z: 0 }
  state.position = add3(add3(body.center, scale3(body.velocity, SHIP_FLIGHT.stepSeconds)), scale3(normal, safeRadius(body) + 0.001))
  const relativeVelocity = sub3(state.velocity, body.velocity)
  state.velocity = sub3(state.velocity, scale3(normal, Math.min(0, dot3(relativeVelocity, normal))))
  resolveOverlaps(state, bodies)
  return { state, contact: body.id }
}

export function stepNavigatedShip(state: ShipFlightState, command: Partial<ShipFlightInput>,
  supplied: readonly ShipNavigationBody[], targetId: string | undefined, assist: boolean, basis?: ShipMovementBasis) {
  const bodies = validNavigationBodies(supplied)
  const input = assistedShipInput(state, command, bodies.find((b) => b.id === targetId), assist)
  const risk = shipBrakingRisk(state, bodies)
  if (risk) { input.throttle = 0; input.brake = 1 }
  const safe = constrainShipFlight(state, stepShipFlight(stabilizeReleasedAxes(state, input), input, basis), bodies)
  return { ...safe, risk }
}
