import { Group, Matrix4, Mesh, Object3D, Raycaster, Vector2, Vector3, type Camera } from 'three'
import { commandEva, type EvaCommand, type EvaContext, type EvaProcedure } from '../../domain/evaProcedure'
import type { CabinDoorState } from '../../domain/cabinCrewMotion'
import type { CabinPrompt } from '../../domain/cabinProximity'
import type { Vec3 } from '../../domain/vec3'
import { CabinTriangleField } from './cabinTriangleField'
import { CurrentAftDoor } from './currentAftDoor'
import { MicrogravityInnerDoor } from './microgravityInnerDoor'
import type { MicrogravitySurfaces } from './microgravitySurfaces'

type ButtonId = 'inner-front' | 'inner-back' | 'outer'
interface Button { id: ButtonId; point: Vector3 }
export interface MicroDoorSaved { inner: CabinDoorState; outer: CabinDoorState }
const vector = (p: Vec3) => new Vector3(p.x, p.y, p.z)
const closed = (): CabinDoorState => ({ progress: 0, target: 0, blocked: false })
const under = (o: Object3D, predicate: (p: Object3D) => boolean) => { for (let p: Object3D | null = o; p; p = p.parent) if (predicate(p)) return true; return false }

/** Physical travel and actual source buttons. Pressure logic always sees the doors' real closure state. */
export class MicrogravityDoors {
  private inner: MicrogravityInnerDoor
  private outer: CurrentAftDoor
  private motion: MicroDoorSaved
  readonly buttons: Button[] = []
  notice = ''
  constructor(private model: Group, saved?: MicroDoorSaved) {
    this.inner = new MicrogravityInnerDoor(model); this.outer = new CurrentAftDoor(model)
    this.motion = saved ? structuredClone(saved) : { inner: closed(), outer: closed() }
    this.createButtons(); this.inner.apply(this.motion.inner.progress); this.outer.apply(this.motion.outer, 0)
  }
  private createButtons() {
    const original = this.outer.buttonPoint(), frame = this.model.getObjectByName('InnerDoorFrame')!, meshes: Mesh[] = []
    frame.traverse(o => { if (o instanceof Mesh) meshes.push(o) })
    const field = new CabinTriangleField(this.model, meshes), inverse = this.model.matrixWorld.clone().invert()
    for (const [id, from, to] of [['inner-front', 3.3, 4.7], ['inner-back', 5.1, 3.8]] as const) {
      let group = this.model.getObjectByName(`MicroButton:${id}`)
      if (!group) {
        const hit = field.cast(new Vector3(-.94, -.28, from), new Vector3(-.94, -.28, to))
        if (!hit) throw Error('No actual inner frame surface for the button')
        group = new Group(); group.name = `MicroButton:${id}`; group.userData.microDoorButton = id; group.position.copy(hit.point).addScaledVector(vector(hit.normal), .006)
        if (id === 'inner-back') group.rotation.y = Math.PI
        for (const name of ['AftDoorButtonBase', 'AftDoorButtonCap', 'AftDoorButtonIndicator']) {
          const source = this.model.getObjectByName(name); if (!source) throw Error('Missing existing source button parts')
          const clone = source.clone(true), matrix = new Matrix4().makeTranslation(-original.x, -original.y, -original.z).multiply(inverse.clone().multiply(source.matrixWorld))
          matrix.decompose(clone.position, clone.quaternion, clone.scale)
          clone.name = `${id}:${name}`; clone.traverse(o => { if (o instanceof Mesh) { o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone(); Object.assign(o.userData, { currentShipPart: 'equipment', masterInterior: true }) } })
          group.add(clone)
        }
        this.model.add(group)
      }
      group.updateWorldMatrix(true, true); this.buttons.push({ id, point: this.model.worldToLocal(group.getWorldPosition(new Vector3())) })
    }
    field.dispose(); this.buttons.push({ id: 'outer', point: original })
  }
  prompt(position: Vec3, surfaces: MicrogravitySurfaces): CabinPrompt | undefined {
    const button = this.buttons.filter(b => b.point.distanceTo(vector(position)) <= 1.1 && surfaces.clear(position, b.point))
      .sort((a, b) => a.point.distanceToSquared(vector(position)) - b.point.distanceToSquared(vector(position)))[0]
    if (!button) return undefined
    const door = button.id === 'outer' ? this.motion.outer : this.motion.inner
    return { id: 'door', deviceId: button.id, title: button.id === 'outer' ? '舱外门 · P 压力 / T 系留' : '气闸内门', verb: door.target ? '关闭舱门' : '开启舱门', key: 'F', distance: button.point.distanceTo(vector(position)), point: { ...button.point } }
  }
  context(position: Vec3, anchor: Vector3, stable: boolean, cordClear: boolean, outerBlocked: boolean): EvaContext {
    const p = vector(position)
    return { atLocker: false, atInnerDoor: this.buttons.some(b => b.id !== 'outer' && b.point.distanceTo(p) < 1.2), atOuterDoor: this.buttons[2].point.distanceTo(p) < 1.3,
      atAnchor: anchor.distanceTo(p) <= 1.1, shipStable: stable, lineClear: cordClear, outerBlocked }
  }
  operate(id: string, procedure: EvaProcedure, context: EvaContext) {
    const outer = id === 'outer', motion = outer ? this.motion.outer : this.motion.inner, desired = motion.target ? 0 : 1
    if (!outer && desired && procedure.tether) { this.notice = '先复压并收绳解挂，再开启内门'; return { ...this.sync(procedure), notice: this.notice } }
    const current = this.sync(procedure), base = { ...current, [outer ? 'outerOpen' : 'innerOpen']: !desired }
    const result = commandEva(base, outer ? 'outer' : 'inner', context)
    if (result[outer ? 'outerOpen' : 'innerOpen'] === !!desired) { motion.target = desired; motion.blocked = false; this.notice = desired ? '正在开启舱门' : '正在关闭舱门' }
    else this.notice = result.notice
    return { ...this.sync(procedure), notice: this.notice }
  }
  procedure(command: EvaCommand, procedure: EvaProcedure, context: EvaContext) { return commandEva(this.sync(procedure), command, context) }
  sync(procedure: EvaProcedure): EvaProcedure { return { ...procedure, innerOpen: this.motion.inner.progress > 1e-6 || this.motion.inner.target === 1, outerOpen: this.motion.outer.progress > 1e-6 || this.motion.outer.target === 1 } }
  step(dt: number, points: readonly Vector3[], surfaces: MicrogravitySurfaces, cord: readonly Vector3[] = []) {
    for (const id of ['inner', 'outer'] as const) {
      const state = this.motion[id]; if (state.progress === state.target) continue
      const next = state.progress + Math.sign(state.target - state.progress) * Math.min(Math.abs(state.target - state.progress), dt / (id === 'inner' ? 2.6 : 1.8))
      const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity)
      for (const p of points) { min.min(p); max.max(p) }
      const blocked = id === 'inner' ? this.inner.blocked(state.progress, next, points, surfaces, cord)
        : this.outer.blocks(state.progress, next, { x: (min.x + max.x) / 2, y: min.y, z: (min.z + max.z) / 2 }, Math.max(max.x - min.x, max.z - min.z) / 2, max.y - min.y) || cord.some(p => this.outer.sweep(state.progress, next).containsPoint(p))
      state.blocked = blocked
      if (blocked) { this.notice = '舱门活动范围有人或绳索，请让开后继续'; continue }
      state.progress = next
      if (id === 'inner') this.inner.apply(next); else this.outer.apply(state, 0)
      if (next === state.target) this.notice = state.target ? '舱门已开启' : '舱门已关闭并密合'
    }
  }
  crossed(procedure: EvaProcedure, points: readonly Vector3[], position: Vec3, context: EvaContext) {
    const min = Math.min(...points.map(p => p.z)), max = Math.max(...points.map(p => p.z))
    if (this.motion.inner.progress === 1 && this.motion.inner.target === 1) {
      if (procedure.location === 'cabin' && min > 4.55) return commandEva(procedure, 'enter', { ...context, atInnerDoor: Math.abs(position.z - 4.2) < 1.6 })
      if (procedure.location === 'lock' && max < 3.9) return commandEva(procedure, 'leave', { ...context, atInnerDoor: Math.abs(position.z - 4.2) < 1.6 })
    }
    if (this.motion.outer.progress === 1 && this.motion.outer.target === 1) {
      if (procedure.location === 'lock' && min > 6.95) return commandEva(procedure, 'exit', { ...context, atOuterDoor: position.z < 9 })
      if (procedure.location === 'outside' && max < 6.55) return commandEva(procedure, 'return', { ...context, atOuterDoor: position.z > 4.6 })
    }
    return procedure
  }
  hit(camera: Camera, x: number, y: number, width: number, height: number) {
    if (!(width > 0 && height > 0)) return undefined
    const ray = new Raycaster(); this.model.updateWorldMatrix(true, true); ray.setFromCamera(new Vector2(x / width * 2 - 1, 1 - y / height * 2), camera)
    const meshes: Mesh[] = []; this.model.traverse(o => { if (o instanceof Mesh && !under(o, p => !p.visible || p.userData.currentShipPart === 'crew')) meshes.push(o) })
    const first = ray.intersectObjects(meshes, false)[0]?.object
    if (first) for (let p: Object3D | null = first; p; p = p.parent) if (p.userData.microDoorButton) return String(p.userData.microDoorButton)
    return this.outer.hit(camera, x, y, width, height) ? 'outer' : undefined
  }
  snapshot() { return structuredClone(this.motion) }
  save() { return this.snapshot() }
  reset() { this.motion = { inner: closed(), outer: closed() }; this.inner.apply(0); this.outer.apply(this.motion.outer, 0) }
  dispose() { this.inner.dispose(); this.outer.dispose() }
}
