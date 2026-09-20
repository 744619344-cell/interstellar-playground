import { AnimationMixer, LoopOnce, type AnimationAction, type AnimationClip, type Group } from 'three'
import type { ShipInteractionState } from '../../domain/shipInteraction'

const REQUIRED_CLIPS = ['ConsoleActive', 'InnerDoorOpen', 'InnerDoorClose', 'OuterDoorOpen', 'OuterDoorClose'] as const
type RequiredClip = typeof REQUIRED_CLIPS[number]

/** Samples existing GLB clips from pure interaction state; owns only its AnimationMixer. */
export class ShipMechanisms {
  private mixer: AnimationMixer
  private actions = new Map<RequiredClip, AnimationAction>()
  private destroyed = false

  constructor(private root: Group, clips: readonly AnimationClip[]) {
    const found = new Map(clips.map(clip => [clip.name, clip]))
    for (const name of REQUIRED_CLIPS) if (!found.has(name)) throw new Error(`Missing ship animation: ${name}`)
    this.mixer = new AnimationMixer(root)
    for (const name of REQUIRED_CLIPS) {
      const action = this.mixer.clipAction(found.get(name)!)
      action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play(); action.paused = true
      this.actions.set(name, action)
    }
  }

  apply(state: ShipInteractionState) {
    if (this.destroyed) return
    this.applyDoor('InnerDoor', state.doors.inner.progress, state.doors.inner.target === 1)
    this.applyDoor('OuterDoor', state.doors.outer.progress, state.doors.outer.target === 1)
    const console = this.actions.get('ConsoleActive')!
    this.seek(console, state.consoleTime % console.getClip().duration, state.consoleActive)
    this.mixer.update(0)
  }

  private applyDoor(prefix: 'InnerDoor' | 'OuterDoor', progress: number, opening: boolean) {
    const open = this.actions.get(`${prefix}Open` as RequiredClip)!
    const close = this.actions.get(`${prefix}Close` as RequiredClip)!
    this.seek(open, progress * open.getClip().duration, opening)
    this.seek(close, (1 - progress) * close.getClip().duration, !opening)
  }

  private seek(action: AnimationAction, time: number, enabled: boolean) {
    action.enabled = true; action.paused = true; action.time = time; action.setEffectiveWeight(enabled ? 1 : 0)
  }

  dispose() {
    if (this.destroyed) return
    this.destroyed = true
    this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root); this.actions.clear()
  }
}
