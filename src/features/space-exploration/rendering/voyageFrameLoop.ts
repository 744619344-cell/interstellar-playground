export interface FrameClock {
  requestAnimationFrame(callback: (time: number) => void): number
  cancelAnimationFrame(handle: number): void
}

export class VoyageFrameLoop {
  private id = 0
  private destroyed = false
  private generation = 0

  constructor(private readonly clock: FrameClock = globalThis) {}

  get running() {
    return this.id !== 0
  }

  start(tick: (time: number) => void) {
    if (this.destroyed || this.id) return
    const generation = ++this.generation
    const step = (time: number) => {
      if (this.destroyed || !this.id || generation !== this.generation) return
      tick(time)
      if (this.destroyed || !this.id || generation !== this.generation) return
      this.id = this.clock.requestAnimationFrame(step)
    }
    this.id = this.clock.requestAnimationFrame(step)
  }

  stop() {
    if (!this.id) return
    this.clock.cancelAnimationFrame(this.id)
    this.id = 0
    this.generation += 1
  }

  destroy() {
    this.destroyed = true
    this.stop()
  }
}
