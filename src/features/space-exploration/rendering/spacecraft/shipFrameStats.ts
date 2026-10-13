/** Measures real render cadence independently of the capped simulation timestep. */
export class ShipFrameStats {
  private previous?: number
  private intervals: number[] = []
  reset() { this.previous = undefined; this.intervals = [] }
  frame(time: number) {
    if (!Number.isFinite(time)) return
    if (this.previous !== undefined && time <= this.previous) return
    if (this.previous !== undefined && time > this.previous) {
      this.intervals.push(time - this.previous)
      if (this.intervals.length > 300) this.intervals.shift()
    }
    this.previous = time
  }
  snapshot() {
    const samples = this.intervals.length
    if (!samples) return { samples, fps: 0, lowFps: 0 }
    const slowest = [...this.intervals].sort((a, b) => b - a).slice(0, Math.ceil(samples * .01))
    return { samples, fps: 1000 * samples / this.intervals.reduce((sum, dt) => sum + dt, 0),
      lowFps: 1000 * slowest.length / slowest.reduce((sum, dt) => sum + dt, 0) }
  }
}
