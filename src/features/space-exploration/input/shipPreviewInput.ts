import type { ShipFlightInput } from '../domain/shipFlightModel'

const KEYS = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'])
export class ShipPreviewInput {
  private keys = new Set<string>()
  key(code: string, down: boolean) {
    if (!KEYS.has(code)) return false
    if (down) this.keys.add(code)
    else this.keys.delete(code)
    return true
  }
  clear() { this.keys.clear() }
  snapshot(): ShipFlightInput {
    const value = (code: string) => Number(this.keys.has(code))
    return { throttle: value('KeyW') + value('ArrowUp') - value('KeyS') - value('ArrowDown'),
      strafe: value('KeyD') + value('ArrowRight') - value('KeyA') - value('ArrowLeft'),
      brake: 0, yaw: 0, pitch: 0, roll: 0,
      stabilize: this.keys.has('Space') }
  }
}
