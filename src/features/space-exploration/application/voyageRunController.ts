export interface VoyageRunner {
  start(): void
  stop(): void
  clearInput(): void
  setInputEnabled(enabled: boolean): void
}

export interface VoyageRunSnapshot {
  running: boolean
  hidden: boolean
  userPaused: boolean
  overlayPaused: boolean
  destroyed: boolean
}

export class VoyageRunController {
  private hidden = false
  private userPaused = false
  private overlayPaused = false
  private destroyed = false
  private mounted = false
  private running = false

  constructor(private readonly runner: VoyageRunner) {}

  mount(initialHidden: boolean) {
    if (this.mounted || this.destroyed) return
    this.mounted = true
    this.hidden = initialHidden
    this.sync()
  }

  setHidden(hidden: boolean) {
    if (this.destroyed || this.hidden === hidden) return
    if (hidden) this.runner.clearInput()
    this.hidden = hidden
    this.sync()
  }

  setUserPaused(paused: boolean) {
    if (this.destroyed || this.userPaused === paused) return this.userPaused
    this.userPaused = paused
    this.sync()
    return this.userPaused
  }

  toggleUserPaused() {
    return this.setUserPaused(!this.userPaused)
  }

  setOverlayPaused(paused: boolean) {
    if (this.destroyed || this.overlayPaused === paused) return
    if (paused) this.runner.clearInput()
    this.overlayPaused = paused
    this.sync()
  }

  clearInput() {
    if (!this.destroyed) this.runner.clearInput()
  }

  getSnapshot(): VoyageRunSnapshot {
    return {
      running: this.running,
      hidden: this.hidden,
      userPaused: this.userPaused,
      overlayPaused: this.overlayPaused,
      destroyed: this.destroyed
    }
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.running = false
    this.runner.setInputEnabled(false)
    this.runner.stop()
    this.runner.clearInput()
  }

  private sync() {
    const shouldRun = this.mounted && !this.destroyed && !this.hidden && !this.userPaused && !this.overlayPaused
    this.runner.setInputEnabled(shouldRun)
    if (shouldRun === this.running) return
    this.running = shouldRun
    if (shouldRun) this.runner.start()
    else this.runner.stop()
  }
}
