import type { ShipFeedback } from '../domain/shipFeedback'

export interface ShipEffectsAudioContext {
  readonly currentTime: number
  readonly destination: AudioNode
  readonly state: string
  createOscillator(): OscillatorNode
  createGain(): GainNode
  resume(): Promise<void>
  suspend(): Promise<void>
  close(): Promise<void>
}

type ContextFactory = () => ShipEffectsAudioContext

export class ShipEffectsAudio {
  private context?: ShipEffectsAudioContext
  private oscillator?: OscillatorNode
  private gain?: GainNode
  private suspended = false
  private destroyed = false

  constructor(private readonly createContext: ContextFactory = defaultContext) {}

  async unlock() {
    if (this.destroyed) return false
    try {
      if (!this.context) this.createGraph()
      this.suspended = false
      if (this.context?.state === 'suspended') await this.context.resume()
      return this.context?.state === 'running'
    } catch {
      return false
    }
  }

  setFeedback(feedback: ShipFeedback | undefined, active: boolean) {
    if (!this.context || !this.gain || !this.oscillator || this.destroyed) return
    const enabled = active && !this.suspended && this.context.state === 'running'
    const level = enabled ? Math.max(0, Math.min(1, feedback?.audioLevel ?? 0)) : 0
    const now = this.context.currentTime
    this.gain.gain.cancelScheduledValues(now)
    this.gain.gain.setTargetAtTime(level * 0.006, now, 0.08)
    this.oscillator.frequency.setTargetAtTime(46 + level * 18, now, 0.1)
  }

  setSuspended(suspended: boolean) {
    this.suspended = suspended
    if (!suspended || !this.context || this.context.state !== 'running') return
    this.setFeedback(undefined, false)
    void this.context.suspend().catch(() => undefined)
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    const context = this.context
    this.context = undefined
    try { this.oscillator?.stop() } catch { /* already stopped */ }
    this.oscillator?.disconnect()
    this.gain?.disconnect()
    this.oscillator = undefined
    this.gain = undefined
    if (context && context.state !== 'closed') void context.close().catch(() => undefined)
  }

  private createGraph() {
    const context = this.createContext()
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 46
    gain.gain.value = 0
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    this.context = context
    this.oscillator = oscillator
    this.gain = gain
  }
}

function defaultContext(): ShipEffectsAudioContext {
  return new AudioContext()
}
