import { Box3, Group, Mesh, Quaternion, Vector3 } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import type { EvaProcedure } from '../../domain/evaProcedure'
import { EVA_PREVIEW_TIMES } from '../../domain/evaProcedure'
import { MicrogravityCrewRig } from './microgravityCrewRig'

/** Reuses the original credited suit and authorized indoor skin; no clothing mesh is fabricated. */
export class MicrogravityOutfit {
  private indoor: Group
  private suited: Group
  private stowed: Group
  private indoorRig: MicrogravityCrewRig
  private suitedRig: MicrogravityCrewRig
  private stowedRig: MicrogravityCrewRig
  private wearing = false
  readonly lockerBounds: Box3

  constructor(private model: Group) {
    const indoor = model.getObjectByName('MicrogravityCrew'), suited = model.getObjectByName('MicrogravitySuit'), locker = model.getObjectByName('micro-locker')
    if (!(indoor instanceof Group) || !(suited instanceof Group) || !locker) throw Error('Missing outfit sources or suit locker')
    this.indoor = indoor; this.suited = suited
    this.indoorRig = new MicrogravityCrewRig(indoor, model, true); this.suitedRig = new MicrogravityCrewRig(suited, model)
    this.lockerBounds = new Box3(); const inverse = model.matrixWorld.clone().invert()
    locker.traverse(o => { if (o instanceof Mesh) { const p = o.geometry.getAttribute('position'), matrix = inverse.clone().multiply(o.matrixWorld)
      for (let i = 0; i < p.count; i++) this.lockerBounds.expandByPoint(new Vector3().fromBufferAttribute(p, i).applyMatrix4(matrix)) } })
    const existing = model.getObjectByName('MicrogravityStowedSuit')
    const stowed = existing instanceof Group ? existing : clone(suited)
    if (!(stowed instanceof Group)) throw Error('Invalid cloned suit root')
    this.stowed = stowed
    this.stowed.name = 'MicrogravityStowedSuit'; this.stowed.userData.currentShipPart = 'crew'
    this.stowed.position.copy(this.lockerBounds.getCenter(new Vector3())); this.stowed.rotation.set(0, -Math.PI / 2, 0)
    if (!existing) model.add(this.stowed)
    this.stowedRig = new MicrogravityCrewRig(this.stowed, model)
    this.stowedRig.pose(0, 'sleep')
    this.stowed.position.add(this.lockerBounds.getCenter(new Vector3()).sub(this.stowedRig.bounds().getCenter(new Vector3())))
    this.stowedRig.update(); this.indoorRig.pose(0); this.suitedRig.pose(0)
    this.suited.visible = false; this.stowed.visible = true
  }
  get actor() { return this.wearing ? this.suited : this.indoor }
  get rig() { return this.wearing ? this.suitedRig : this.indoorRig }
  get worn() { return this.wearing }
  body(position: Vector3, orientation: Quaternion) {
    for (const actor of [this.indoor, this.suited]) { actor.position.copy(position); actor.quaternion.copy(orientation) }
    this.rig.update()
  }
  nearLocker(position: Vector3) { return this.lockerBounds.distanceToPoint(position) <= 1.05 }
  apply(procedure: EvaProcedure) {
    const middle = EVA_PREVIEW_TIMES.wear / 2, dressed = procedure.suit === 'ready' || procedure.suit === 'donning' && procedure.elapsed >= middle || procedure.suit === 'doffing' && procedure.elapsed < middle
    if (dressed !== this.wearing) { this.wearing = dressed; this.rig.pose(0) }
    this.indoor.visible = !dressed; this.suited.visible = dressed; this.stowed.visible = !dressed
  }
  step(seconds: number, procedure: EvaProcedure, mode: 'float' | 'seat' | 'sleep' = 'float', amount = 1, support?: Vector3) {
    this.apply(procedure); this.rig.pose(seconds, mode, amount)
    if (procedure.suit === 'donning' || procedure.suit === 'doffing') this.rig.dressing(procedure.elapsed / EVA_PREVIEW_TIMES.wear, support)
  }
  /** Exact posed source bounds, for cabinet fit and wearer-clearance checks. */
  bounds() { return { stowed: this.stowedRig.bounds(), locker: this.lockerBounds.clone(), wearer: this.suitedRig.bounds() } }
  wearPoints() { this.suitedRig.pose(0); return this.suitedRig.bodyPoints() }
  dispose() { this.indoorRig.dispose(); this.suitedRig.dispose(); this.stowedRig.dispose() }
}
