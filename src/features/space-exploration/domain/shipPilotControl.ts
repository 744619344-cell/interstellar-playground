import { cloneShipFlightState, SHIP_FLIGHT, type ShipFlightInput, type ShipFlightState } from './shipFlightModel'

/** Pilot stability damps only uncommanded rotation; forward coasting is unchanged. */
export function stabilizeReleasedAxes(state: ShipFlightState, input: ShipFlightInput) {
  const result = cloneShipFlightState(state)
  const damp = (rate: number) => {
    const next = rate * Math.exp(-8 * SHIP_FLIGHT.stepSeconds)
    return Math.abs(next) < 0.001 ? 0 : next
  }
  if (!input.pitch) result.angularVelocity.x = damp(state.angularVelocity.x)
  if (!input.yaw) result.angularVelocity.y = damp(state.angularVelocity.y)
  if (!input.roll) result.angularVelocity.z = damp(state.angularVelocity.z)
  return result
}
