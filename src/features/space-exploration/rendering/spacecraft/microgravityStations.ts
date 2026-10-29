import { Box3, Group, Mesh, Object3D, Quaternion, Vector3 } from 'three'
import { CABIN_FLOAT, catchCabinFloat, fixCabinFloat, unfixCabinFloat, type CabinFloatFrame, type CabinFloatState } from '../../domain/cabinFloatMotion'
import type { CabinPrompt } from '../../domain/cabinProximity'
import type { Vec3 } from '../../domain/vec3'
import type { CabinDevicePanel } from './cabinEquipment'
import type { MicrogravityCrewRig } from '../astronaut/microgravityCrewRig'
import type { MicrogravitySurfaces } from './microgravitySurfaces'
import { CABIN_EQUIPMENT } from '../../domain/cabinEquipmentCatalog'

type Kind = 'seat' | 'bed' | 'workbench' | 'locker' | 'console' | 'storage'
interface Station { id: string; kind: Kind; title: string; object: Object3D; box: Box3; points: Float32Array }
interface Dock { id: string; from: Vec3; to: Vec3; orientation: number[]; startOrientation: number[]; progress: number; target: 0 | 1 }
export interface MicroStationSaved { dock?: Dock; fixed?: string; checked: string[]; panel?: string }
const vector = (p: Vec3) => new Vector3(p.x, p.y, p.z)
const plain = (p: Vector3): Vec3 => ({ x: p.x, y: p.y, z: p.z })
const ease = (t: number) => { const p = Math.max(0, Math.min(1, t)); return p * p * p * (10 + p * (-15 + 6 * p)) }
const belongs = (o: Object3D, root: Object3D) => { for (let p: Object3D | null = o; p; p = p.parent) if (p === root) return true; return false }
export const MICRO_REACH_SECONDS = .7

/** Source-derived proximity and authored restraint transitions. Cloth/pads are not rigid collision fixtures. */
export class MicrogravityStations {
  private stations: Station[] = []
  private dock?: Dock
  private fixed?: string
  private panel?: string
  private checked = new Set<string>()
  notice = ''
  constructor(private model: Group, private surfaces: MicrogravitySurfaces, saved?: MicroStationSaved) {
    const definitions = CABIN_EQUIPMENT.map(e => [e.id, e.kind, e.title] as const)
    model.updateWorldMatrix(true, true); const inverse = model.matrixWorld.clone().invert()
    for (const [id, kind, title] of definitions) {
      const object = model.getObjectByName(id); if (!object) continue
      const box = new Box3(), points: number[] = []
      object.traverse(o => { if (o instanceof Mesh && !o.userData.microSleepSidePanel) { const p = o.geometry.getAttribute('position'), matrix = inverse.clone().multiply(o.matrixWorld)
        for (let i = 0; i < p.count; i++) { const point = new Vector3().fromBufferAttribute(p, i).applyMatrix4(matrix); box.expandByPoint(point); points.push(point.x, point.y, point.z) } } })
      this.stations.push({ id, kind, title, object, box, points: new Float32Array(points) })
      if (kind === 'seat') {
        const to = box.getCenter(new Vector3()).setY(-.4), from = to.clone().setX(0), hit = surfaces.cast(from, to)
        if (hit && belongs(hit.owner, object)) surfaces.grips.push({ id: `${id}:armrest`, point: vector(hit.point), normal: vector(hit.normal), surfaceNormal: vector(hit.normal) })
      }
    }
    if (saved) { this.dock = saved.dock ? structuredClone(saved.dock) : undefined; this.fixed = saved.fixed; this.panel = saved.panel; this.checked = new Set(saved.checked) }
  }
  get busy() { return !!this.dock && this.dock.progress !== this.dock.target }
  get seated() { return !!this.fixed && this.get(this.fixed)?.kind === 'seat' && !this.busy }
  get resting() { return !!this.fixed && this.get(this.fixed)?.kind === 'bed' && !this.busy }
  cameraObject(pending?: string) { const station = this.get(pending ?? this.dock?.id ?? this.fixed); return station?.kind === 'bed' ? station.object : undefined }
  cameraInboard(pending?: string, position?: Vec3) {
    let station = this.get(pending ?? this.dock?.id ?? this.fixed)
    if (station?.kind !== 'bed' && position) station = this.stations.filter(s => s.kind === 'bed' && s.box.distanceToPoint(vector(position)) < .85)
      .sort((a, b) => a.box.distanceToPoint(vector(position)) - b.box.distanceToPoint(vector(position)))[0]
    return station?.kind === 'bed' ? -Math.sign(station.box.getCenter(new Vector3()).x) || 1 : 0
  }
  private get(id?: string) { return this.stations.find(s => s.id === id) }
  private panelPoint(station: Station, from: Vector3) {
    const point = station.box.clampPoint(from, new Vector3()), hit = this.surfaces.cast(from, point)
    if (!hit || hit.distance >= from.distanceTo(point) - .025) return point
    const doors = station.kind === 'locker' && this.model.getObjectByName('MicrogravityLockerDoorAssembly')
    return doors && belongs(hit.owner, doors) ? vector(hit.point) : undefined
  }
  near(id: string, position: Vec3) {
    const station = this.get(id); if (!station) return false
    const from = vector(position).add(new Vector3(0, .3, 0)), point = this.panelPoint(station, from)
    return !!point && point.distanceTo(vector(position)) <= 1.2
  }
  nearbyPanels(position: Vec3) { return this.stations.filter(s => !['seat', 'bed'].includes(s.kind) && this.near(s.id, position)).map(s => ({ id: s.id, title: s.title })) }
  openPanel(id: string, position: Vec3) {
    const station = this.get(id); if (!station || ['bed', 'seat'].includes(station.kind) || !this.near(id, position)) return false
    this.panel = id; this.notice = `正在查看${station.title}`; return true
  }
  private surface(station: Station, position: Vec3, rig?: MicrogravityCrewRig) {
    if (station.box.distanceToPoint(vector(position)) > 1.2) return undefined
    const origins = rig?.reachVolumes() ?? [{ shoulder: vector(position).add(new Vector3(0, .45, 0)), minimum: 0, maximum: 1.2 }], points = station.points
    const candidates: { offset: number; from: Vector3; distance: number }[] = []
    for (let i = 0; i < points.length; i += 3) {
      for (const origin of origins) {
        const p = origin.shoulder, d = (points[i] - p.x) ** 2 + (points[i + 1] - p.y) ** 2 + (points[i + 2] - p.z) ** 2
        if (d < origin.minimum ** 2 || d > origin.maximum ** 2) continue
        candidates.push({ offset: i, from: p, distance: d })
      }
    }
    candidates.sort((a, b) => a.distance - b.distance)
    const tried: Vector3[] = []
    // A source vertex on a silhouette edge can miss a ray; inspect nearby real surface points.
    for (const candidate of candidates) {
      const point = new Vector3().fromArray(points, candidate.offset)
      if (tried.some(p => p.distanceToSquared(point) < .0016)) continue
      tried.push(point.clone())
      const direction = point.clone().sub(candidate.from).normalize(), hit = this.surfaces.cast(candidate.from, point.addScaledVector(direction, .03))
      if (hit && belongs(hit.owner, station.object)) return hit
      if (tried.length >= 12) break
    }
    return undefined
  }
  contactFor(id: string, state: CabinFloatState, rig: MicrogravityCrewRig, attempts = 24) {
    const station = this.get(id); if (!station || station.kind !== 'seat' && station.kind !== 'bed') return undefined
    if (station.box.distanceToPoint(vector(state.position)) > 1.2 || vector(state.velocity).length() > CABIN_FLOAT.catchSpeed) return undefined
    const drift = vector(state.velocity).multiplyScalar(MICRO_REACH_SECONDS), position = vector(state.position)
    const candidates: { point: Vector3; from: Vector3; side: 'L' | 'R'; score: number }[] = []
    for (const origin of rig.reachVolumes()) for (let i = 0; i < station.points.length; i += 3) {
      const point = new Vector3().fromArray(station.points, i), d = point.distanceTo(origin.shoulder), end = point.distanceTo(origin.shoulder.clone().add(drift))
      if (d < origin.minimum || d > origin.maximum) continue
      if (end > origin.maximum + .025 || end < origin.minimum - .025) continue
      candidates.push({ point, from: origin.shoulder, side: origin.side, score: (Math.max(d, end) - origin.maximum * .68) ** 2 + point.distanceToSquared(position) * .06 })
    }
    candidates.sort((a, b) => a.score - b.score)
    const tried: { point: Vector3; side: 'L' | 'R' }[] = []
    for (const c of candidates) {
      if (tried.some(p => p.side === c.side && p.point.distanceTo(c.point) < .075)) continue
      tried.push(c); const hit = this.surfaces.cast(c.from, c.point.clone().addScaledVector(c.point.clone().sub(c.from).normalize(), .025))
      if (hit && belongs(hit.owner, station.object)) {
        const point = vector(hit.point), normal = vector(hit.normal), fractions = drift.lengthSq() > 1e-10 ? [0, .5, 1] : [0]
        // Translating the target oppositely is a read-only IK query at the predicted body position.
        const safe = fractions.every(t => {
          const offset = drift.clone().multiplyScalar(t)
          return point.distanceTo(position.clone().add(offset)) <= CABIN_FLOAT.bodyReach &&
            this.surfaces.clear(c.from.clone().add(offset), point) && rig.canReach(point.clone().sub(offset), normal, c.side)
        })
        if (safe) return { ...hit, side: c.side }
      }
      if (tried.length >= attempts) break
    }
    return undefined
  }
  prompt(state: CabinFloatState, rig?: MicrogravityCrewRig): CabinPrompt | undefined {
    const active = this.get(this.fixed ?? this.dock?.id), point = { ...state.position }
    if (this.busy) return undefined
    if (active) return { id: active.kind, deviceId: active.id, title: active.title, verb: active.kind === 'seat' ? '解开约束起身' : '离开睡袋', key: 'F', distance: 0, point }
    const panel = this.get(this.panel)
    if (panel) return { id: panel.kind, deviceId: panel.id, title: panel.title, verb: '结束查看', key: 'F', distance: 0, point }
    return this.stations.flatMap(station => {
      const from = vector(state.position).add(new Vector3(0, .3, 0)), physical = station.kind === 'seat' || station.kind === 'bed'
      const hit = physical ? rig ? this.contactFor(station.id, state, rig, 6) : this.surface(station, state.position) : undefined
      const point = physical ? hit?.point : this.panelPoint(station, from)
      if (!point) return []
      const distance = vector(point).distanceTo(vector(state.position)); if (distance > 1.2) return []
      // Reuse a proven real source contact for regrasping after leaving a restraint; no proxy geometry.
      const id = `station:${station.id}:contact`
      if (hit && state.contact?.id !== id) this.surfaces.rememberGrip({ id, point: vector(hit.point), normal: vector(hit.normal), surfaceNormal: vector(hit.normal), title: `${station.title}抓点` })
      return [{ id: station.kind, deviceId: station.id, title: station.title, verb: station.kind === 'seat' ? '坐下驾驶' : station.kind === 'bed' ? '进入睡袋休息' : station.kind === 'locker' ? '查看装备 · R 穿脱' : '查看设备', key: 'F' as const, distance, point }]
    }).sort((a, b) => a.distance - b.distance)[0]
  }
  interact(state: CabinFloatState, rig: MicrogravityCrewRig, suited: boolean, requested?: string, entry?: { point: Vec3; normal: Vec3; side?: 'L' | 'R' }) {
    if (this.busy) { this.notice = '正在对齐，Esc 可退出'; return state }
    if (this.fixed) { this.leave(); return state }
    if (this.panel && !requested) { this.panel = undefined; this.notice = '已结束查看'; return state }
    this.panel = undefined
    const prompt = this.prompt(state, rig), station = this.get(requested ?? prompt?.deviceId)
    if (!station) return state
    if (station.kind !== 'seat' && station.kind !== 'bed') { this.panel = station.id; this.notice = `正在查看${station.title}`; return state }
    if (station.kind === 'bed' && suited) { this.notice = '先把宇航服收回服舱，再进入睡袋'; return state }
    const hit = entry ?? this.contactFor(station.id, state, rig); if (!hit) return state
    const touch = rig.reach(vector(hit.point), hit.side, vector(hit.normal)), contact = catchCabinFloat(state, { id: `${station.id}:entry`, point: hit.point, normal: hit.normal }, touch.point)
    if (!touch.reachable || !contact.contact) { this.notice = '请再靠近一些，让手能够接触设备'; return state }
    const to = station.box.getCenter(new Vector3()), yaw = station.kind === 'bed' ? -Math.PI / 2 : 0
    if (station.kind === 'bed') { to.x = station.box.min.x + .175; to.y = station.box.max.y - .94 }
    else { to.x = station.box.getCenter(new Vector3()).x; to.z = -4.6; to.y = -.78 }
    const orientation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw)
    this.dock = { id: station.id, from: { ...state.position }, to: plain(to), orientation: orientation.toArray(), startOrientation: [state.orientation.x, state.orientation.y, state.orientation.z, state.orientation.w], progress: 0, target: 1 }
    this.notice = station.kind === 'bed' ? '正在对齐睡袋与约束带' : '正在进入驾驶座'
    return { ...contact, velocity: { x: 0, y: 0, z: 0 }, angularVelocity: { x: 0, y: 0, z: 0 } }
  }
  leave() { if (this.dock) { this.dock.target = 0; this.fixed = undefined; this.notice = '正在解除设备约束' } }
  cancel(leave = false, keepPanel = false) { if (!keepPanel) this.panel = undefined; if (leave && this.dock) this.leave() }
  get boardingSeat() { return !!this.dock && this.dock.target === 1 && this.get(this.dock.id)?.kind === 'seat' }
  nearestSeatId(position: Vec3) { return this.stations.filter(s => s.kind === 'seat' && s.box.distanceToPoint(vector(position)) < 1.2).sort((a, b) => a.box.distanceToPoint(vector(position)) - b.box.distanceToPoint(vector(position)))[0]?.id }
  inspect() { if (this.panel) { this.checked.add(this.panel); this.notice = '已记录本次查看' } }
  pose() { const station = this.get(this.dock?.id ?? this.fixed); return { mode: station?.kind === 'bed' ? 'sleep' as const : station?.kind === 'seat' ? 'seat' as const : 'float' as const, amount: this.dock ? ease(this.dock.progress) : 1 } }
  fabric() { const station = this.get(this.dock?.id ?? this.fixed); return { id: station?.kind === 'bed' ? station.id : undefined, amount: this.dock?.progress ?? Number(!!this.fixed) } }
  advance(state: CabinFloatState, seconds: number, rig: MicrogravityCrewRig, frame: CabinFloatFrame) {
    const dock = this.dock, station = this.get(dock?.id)
    if (!dock || !station || dock.progress === dock.target) return state
    const previous = dock.progress, direction = dock.target ? 1 : -1
    dock.progress = Math.max(0, Math.min(1, dock.progress + direction * seconds / (station.kind === 'bed' ? 2.8 : 2)))
    const t = ease(dock.progress), from = vector(dock.from), to = vector(dock.to), position = from.clone()
    // Align laterally above/away from hard edges before settling into the target pad or soft bag.
    if (station.kind === 'bed') { position.z += (to.z - from.z) * ease(t / .35); position.y += (to.y - from.y) * ease((t - .1) / .5); position.x += (to.x - from.x) * ease((t - .45) / .55) }
    else { position.x += (to.x - from.x) * ease(t / .65); position.z += (to.z - from.z) * ease(t / .65); position.y += (to.y - from.y) * ease((t - .55) / .45) }
    const delta = position.clone().sub(vector(state.position)), points = rig.bodyPoints()
    if (points.some(p => !this.surfaces.clear(p, p.clone().add(delta), .003, station.object))) { dock.progress = previous; dock.target = 0; this.notice = '路径被结构挡住，请靠近设备正面再操作'; return state }
    const q = new Quaternion().fromArray(dock.startOrientation).slerp(new Quaternion().fromArray(dock.orientation), t)
    let result: CabinFloatState = { ...state, position: plain(position), orientation: { x: q.x, y: q.y, z: q.z, w: q.w }, contact: undefined, fixed: undefined }
    if (dock.progress === 1) { result = fixCabinFloat(result, station.id, dock.to); this.fixed = station.id; this.notice = station.kind === 'seat' ? '已固定在驾驶座，F 起身' : '已进入睡袋，F 解除约束' }
    if (dock.progress === 0) { result = unfixCabinFloat(result, frame); this.dock = undefined; this.fixed = undefined; this.notice = '已解除约束，保持漂浮' }
    return result
  }
  panelSnapshot(): CabinDevicePanel | undefined {
    const station = this.get(this.panel); if (!station || station.kind === 'seat') return undefined
    return { id: station.id, kind: station.kind, title: station.title, description: station.kind === 'locker' ? '宇航服收纳与换装工位，R 穿脱；出舱前仍需装备检查' : station.kind === 'workbench' ? '领用检修工具包后，抓稳工位执行例行巡检' : station.kind === 'storage' ? '检修工具包领用归还、舱内照明与船载状态记录' : '当前航行与设备状态', checked: this.checked.has(station.id) }
  }
  save(): MicroStationSaved { return structuredClone({ dock: this.dock, fixed: this.fixed, panel: this.panel, checked: [...this.checked] }) }
  reset() { this.dock = undefined; this.fixed = undefined; this.panel = undefined; this.notice = '' }
  dispose() { this.stations = []; this.checked.clear() }
}
