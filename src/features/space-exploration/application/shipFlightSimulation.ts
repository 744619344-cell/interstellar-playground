import {
  cloneShipFlightState, createShipFlightState, neutralShipInput, sanitizeShipInput,
  SHIP_FLIGHT, stepShipFlight, type ShipFlightInput
} from '../domain/shipFlightModel'
import { interpolateShipRotation } from '../domain/shipFlightMath'
import { lerp3 } from '../domain/vec3'

export type ShipPauseReason = 'user' | 'hidden' | 'blur' | 'overlay'

/** Clock-free simulation. The future host must forward visibility/focus events and elapsed seconds. */
export class ShipFlightSimulation {
  private current = createShipFlightState()
  private previous = cloneShipFlightState(this.current)
  private input = neutralShipInput()
  private accumulator = 0
  private steps = 0
  private droppedSeconds = 0
  private destroyed = false
  private pauses = new Set<ShipPauseReason>()

  setInput(input: Partial<ShipFlightInput>) {
    if (!this.destroyed && !this.pauses.size) this.input = sanitizeShipInput(input)
  }

  setPaused(reason: ShipPauseReason, paused: boolean) {
    if (this.destroyed) return
    if (paused) {
      this.pauses.add(reason)
      this.clearPending()
    } else this.pauses.delete(reason)
  }

  advance(elapsedSeconds: number, step: typeof stepShipFlight = stepShipFlight) {
    if (this.destroyed || this.pauses.size || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) {
      return this.snapshot()
    }
    const accepted = Math.min(elapsedSeconds, SHIP_FLIGHT.maxFrameSeconds)
    this.droppedSeconds += elapsedSeconds - accepted
    this.accumulator += accepted
    const count = Math.min(30, Math.floor((this.accumulator + 1e-12) / SHIP_FLIGHT.stepSeconds))
    for (let i = 0; i < count; i++) {
      this.previous = this.current
      this.current = step(this.current, this.input)
    }
    this.steps += count
    this.accumulator = Math.max(0, this.accumulator - count * SHIP_FLIGHT.stepSeconds)
    return this.snapshot()
  }

  snapshot() {
    const alpha = Math.min(1, this.accumulator / SHIP_FLIGHT.stepSeconds)
    return {
      state: cloneShipFlightState(this.current), previous: cloneShipFlightState(this.previous),
      renderPose: {
        position: lerp3(this.previous.position, this.current.position, alpha),
        orientation: interpolateShipRotation(this.previous.orientation, this.current.orientation, alpha)
      },
      alpha, steps: this.steps, simulatedSeconds: this.steps * SHIP_FLIGHT.stepSeconds,
      droppedSeconds: this.droppedSeconds, paused: this.pauses.size > 0, destroyed: this.destroyed
    }
  }

  destroy() {
    this.destroyed = true
    this.clearPending()
  }

  private clearPending() {
    this.input = neutralShipInput()
    this.accumulator = 0
    this.previous = cloneShipFlightState(this.current)
  }
}
