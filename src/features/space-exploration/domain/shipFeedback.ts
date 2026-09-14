import { length3 } from './vec3'
import { sanitizeShipInput, type ShipFlightInput, type ShipFlightState } from './shipFlightModel'

export type ShipThrustLabel = '待机' | '前进推进' | '倒车推进' | '向左横移' | '向右横移' | '制动'
export type ShipAttitudeLabel = '姿态稳定' | '姿态调整中'

export interface ShipFeedback {
  forward: number
  reverse: number
  strafeLeft: number
  strafeRight: number
  braking: number
  audioLevel: number
  thrustLabel: ShipThrustLabel
  attitudeLabel: ShipAttitudeLabel
}

const IDLE: ShipFeedback = {
  forward: 0,
  reverse: 0,
  strafeLeft: 0,
  strafeRight: 0,
  braking: 0,
  audioLevel: 0,
  thrustLabel: '待机',
  attitudeLabel: '姿态稳定'
}

export function shipFeedback(
  command: Partial<ShipFlightInput>,
  state: ShipFlightState,
  active = true
): ShipFeedback {
  if (!active) return { ...IDLE }
  const input = sanitizeShipInput(command)
  const forward = Math.max(0, input.throttle)
  const reverse = Math.max(0, -input.throttle)
  const strafeLeft = Math.max(0, -input.strafe)
  const strafeRight = Math.max(0, input.strafe)
  const coastingBrake = !forward && !reverse && !strafeLeft && !strafeRight && length3(state.velocity) > 0.05
  const braking = Number(input.brake > 0 || input.stabilize || coastingBrake)
  const angularSpeed = length3(state.angularVelocity)
  const thrustLabel = labelFor({ forward, reverse, strafeLeft, strafeRight, braking })
  return {
    forward,
    reverse,
    strafeLeft,
    strafeRight,
    braking,
    audioLevel: Math.max(forward, reverse * 0.75, strafeLeft * 0.58, strafeRight * 0.58, braking * 0.42),
    thrustLabel,
    attitudeLabel: angularSpeed > 0.025 ? '姿态调整中' : '姿态稳定'
  }
}

function labelFor(values: Pick<ShipFeedback, 'forward' | 'reverse' | 'strafeLeft' | 'strafeRight' | 'braking'>): ShipThrustLabel {
  if (values.forward) return '前进推进'
  if (values.reverse) return '倒车推进'
  if (values.strafeLeft) return '向左横移'
  if (values.strafeRight) return '向右横移'
  if (values.braking) return '制动'
  return '待机'
}

