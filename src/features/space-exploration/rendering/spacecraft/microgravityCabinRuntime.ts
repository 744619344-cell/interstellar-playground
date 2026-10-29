import { Group, Quaternion, Vector3, type Camera } from 'three'
import { catchCabinFloat, createCabinFloat, releaseCabinFloat, stepCabinFloat, type CabinFloatFrame, type CabinFloatState, type FloatContact } from '../../domain/cabinFloatMotion'
import type { CabinMove } from '../../domain/cabinCrewMotion'
import type { CabinPrompt } from '../../domain/cabinProximity'
import type { Vec3 } from '../../domain/vec3'
import { cabinEvaControls, type CabinEvaAction } from '../../domain/cabinEvaControls'
import type { CabinEquipmentAction } from '../../domain/cabinEquipmentCatalog'
import { createCabinEquipmentUse, commandCabinEquipment, stepCabinEquipment, type CabinEquipmentUse, type CabinEquipmentContext } from '../../domain/cabinEquipmentUse'
import { motionStudyActive } from '../../domain/cabinMotionStudy'
import { MicrogravityOutfit } from '../astronaut/microgravityOutfit'
import { cancelEvaProcedure, commandEva, createEvaProcedure, inspectEvaSuit, stepEvaProcedure, type EvaProcedure } from '../../domain/evaProcedure'
import { MicrogravitySurfaces, type CabinGrip, type CabinCollisionProbe } from './microgravitySurfaces'
import type { CabinHandAction, CurrentCabinRuntime } from './currentCabinRuntime'
import { MicrogravityStations, MICRO_REACH_SECONDS, type MicroStationSaved } from './microgravityStations'
import { MicrogravitySleepFabric } from './microgravitySleepFabric'
import { MicrogravityTether } from './microgravityTether'
import { MicrogravityDoors, type MicroDoorSaved } from './microgravityDoors'
import { MicrogravityEvaMotion, type MicroEvaSaved } from './microgravityEvaMotion'
import { MicrogravityLockerDoors, type LockerDoorSaved } from './microgravityLockerDoors'
import { microgravityInput } from '../../input/microgravityInput'
import { cabinKeyBinding } from '../../input/cabinKeyBindings'
import { assistCabinControls, type CabinControlMode } from '../../domain/cabinControlAssist'
import { SeatEscapeAssist, seatSlideCandidate } from './seatEscapeAssist'

const vector = (p: Vec3) => new Vector3(p.x, p.y, p.z)
const plain = (p: Vector3): Vec3 => ({ x: p.x, y: p.y, z: p.z })
const front = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI)
export interface MicrogravitySaved { float: CabinFloatState; controlMode?: CabinControlMode; departing?: FloatContact; eva?: EvaProcedure; stations?: MicroStationSaved; equipment?: CabinEquipmentUse; doors?: MicroDoorSaved; lockerDoor?: LockerDoorSaved; evaMotion?: MicroEvaSaved; suitResources?: { oxygen: number; battery: number } }
export function isMicrogravityCabin(cabin: ReturnType<CurrentCabinRuntime['snapshot']> | undefined): cabin is ReturnType<MicrogravityCabinRuntime['snapshot']> {
  return !!cabin && 'microgravity' in cabin && cabin.microgravity === true
}
/** Candidate runtime: real source contacts, inertial cabin motion and actual skin sweeps. */
export class MicrogravityCabinRuntime {
  private outfit: MicrogravityOutfit
  private get actor() { return this.outfit.actor }
  private get rig() { return this.outfit.rig }
  private eva: EvaProcedure
  private equipment: CabinEquipmentUse
  private stations: MicrogravityStations
  private fabric: MicrogravitySleepFabric
  private tether: MicrogravityTether
  private doors: MicrogravityDoors
  private evaMotion: MicrogravityEvaMotion
  private lockerDoor: MicrogravityLockerDoors
  private stable = true
  private suitResources: { oxygen: number; battery: number }
  private surfaces: MicrogravitySurfaces
  private state: CabinFloatState
  private keys = new Set<string>()
  private active = false
  private seatedView = false
  private running = false
  private blocked = false
  private seatEscape = new SeatEscapeAssist()
  private prompt?: CabinPrompt
  private departing?: FloatContact
  private nudge = { forward: 0, right: 0, up: 0, seconds: 0 }
  private restView = 0
  private controlMode: CabinControlMode = 'assisted'
  private brakeAssist = false
  private reelAssist = false
  private reaching?: { point: Vector3; normal: Vector3; grip?: CabinGrip; station?: string; button?: string; seat?: boolean; elapsed: number; side?: 'L' | 'R' }
  private withdrawing?: { point: Vector3; normal: Vector3; elapsed: number; side: 'L' | 'R'; wave?: boolean }
  private notice = '微重力候选：扶稳后选方向，Space 推离；松键保留惯性'

  constructor(private model: Group, saved?: MicrogravitySaved, private seatSlide = seatSlideCandidate()) {
    this.outfit = new MicrogravityOutfit(model); this.eva = saved?.eva ? structuredClone(saved.eva) : createEvaProcedure()
    this.equipment = createCabinEquipmentUse(saved?.equipment)
    this.outfit.apply(this.eva); this.rig.pose(0)
    this.fabric = new MicrogravitySleepFabric(model)
    this.tether = new MicrogravityTether(model)
    this.doors = new MicrogravityDoors(model, saved?.doors)
    this.lockerDoor = new MicrogravityLockerDoors(model, saved?.lockerDoor)
    this.suitResources = { ...(saved?.suitResources ?? { oxygen: 1, battery: 1 }) }
    this.surfaces = new MicrogravitySurfaces(model)
    this.evaMotion = new MicrogravityEvaMotion(model, this.surfaces, this.tether, saved?.evaMotion)
    this.stations = new MicrogravityStations(model, this.surfaces, saved?.stations)
    this.state = saved?.float ? structuredClone(saved.float) : createCabinFloat({ x: -1.5, y: -.2, z: -.3 })
    this.controlMode = saved?.controlMode === 'inertial' || motionStudyActive(this.equipment.study) ? 'inertial' : 'assisted'
    this.eva.lockerOpen = !this.lockerDoor.available || this.lockerDoor.snapshot().target === 1
    this.departing = saved?.departing
    if (!saved) this.spawnAtRail()
    this.applyBody(); const stationPose = this.stations.pose(), fabric = this.stations.fabric(); this.fabric.apply(fabric.id, fabric.amount); this.rig.pose(0, stationPose.mode, stationPose.amount); this.hold(); this.resolvePrompt()
    if (this.departing && !this.state.contact) this.startWithdrawal(this.departing)
    this.evaMotion.sync(this.rig, this.eva.tether)
  }
  private spawnAtRail() {
    const grip = this.surfaces.grips.find(g => g.id.startsWith('micro-port-liner') && g.point.y > 0)
    if (!grip) throw Error('Missing source rail for microgravity spawn')
    this.state = createCabinFloat(plain(grip.point.clone().addScaledVector(grip.normal, .52).add(new Vector3(0, -.22, 0))))
    this.applyBody(); this.rig.pose(0)
    const touch = this.rig.reach(grip.point, undefined, grip.surfaceNormal)
    if (touch.reachable && touch.error <= .012) this.state = catchCabinFloat(this.state, grip, touch.point)
    this.notice = this.controlMode === 'assisted' ? '端游辅助：WASD移动、鼠标环视，松键缓停；F操作' : this.state.contact ? '已扶稳；方向键推离，或 WASD 选向后 Space 推离' : '靠近扶手并按 F / X 抓稳'
  }
  private applyBody() { this.outfit.body(vector(this.state.position), new Quaternion().copy(this.state.orientation).multiply(front)) }
  private hold() {
    if (this.stations.busy || this.state.fixed) return
    if (!this.state.contact) return
    const normal = this.surfaces.grips.find(g => g.id === this.state.contact!.id)?.surfaceNormal ?? vector(this.state.contact.normal)
    const touch = this.rig.reach(vector(this.state.contact.point), undefined, normal)
    if (!touch.reachable || touch.error > .012) { this.releaseGrip(); this.notice = '手部接触已解除，保持惯性' }
    else this.rig.grasp(touch.side)
  }
  private releaseGrip() { if (this.state.contact) this.startWithdrawal(this.state.contact); this.departing = this.state.contact ?? this.departing; this.state = releaseCabinFloat(this.state) }
  private startWithdrawal(contact: FloatContact) { const point = vector(contact.point); this.withdrawing = { point, normal: vector(contact.normal), elapsed: 0, side: this.rig.handFor(point) } }
  private advanceWithdrawal(dt: number) {
    const intent = this.withdrawing; if (!intent || this.reaching || this.state.contact) return
    intent.elapsed += dt
    const t = Math.min(1, intent.elapsed / .5), amount = t * t * (3 - 2 * t), touch = this.rig.reach(intent.point.clone().addScaledVector(intent.normal, amount * .14), intent.side, intent.normal)
    if (!touch.reachable) this.rig.restoreArm(intent.side)
    if (t === 1) { this.withdrawing = undefined; if (intent.wave) this.rig.wave() }
  }
  private resolvePrompt() {
    if (this.reaching) { this.prompt = undefined; return }
    if (this.stations.panelSnapshot()) { this.prompt = this.stations.prompt(this.state, this.rig); return }
    const door = this.doors.prompt(this.state.position, this.surfaces)
    if (door && !this.state.fixed && !this.stations.busy) { this.prompt = door; return }
    const station = this.stations.prompt(this.state, this.rig)
    if (station || this.stations.busy) { this.prompt = station; return }
    const grip = this.state.contact ?? this.nearestGrip(), title = grip && this.surfaces.grips.find(g => g.id === grip.id)?.title
    this.prompt = grip ? { id: 'grip', title: title ?? '结构扶手', verb: this.state.contact ? '松手' : title ? '抓握设备' : '抓握扶手', key: 'F', distance: vector(grip.point).distanceTo(vector(this.state.position)), point: { ...grip.point } } : undefined
  }
  private nearestGrip() { return this.surfaces.nearestGrip(this.state.position, grip => this.rig.canReach(grip.point, grip.surfaceNormal)) }
  private grip() {
    if (this.reaching) { this.reaching = undefined; this.notice = '已取消伸手，保持惯性'; return }
    if (this.state.fixed || this.stations.busy) { this.notice = '先按 F 解除设备约束'; return }
    if (this.state.contact) { this.releaseGrip(); this.notice = this.controlMode === 'assisted' ? '已松手；WASD移动，松键缓停' : this.state.notice; return }
    const grip = this.nearestGrip()
    if (!grip) { this.notice = '尚无可达扶手；漂浮时不会产生空气推进'; return }
    this.reaching = { point: grip.point.clone(), normal: grip.surfaceNormal.clone(), grip, elapsed: 0 }; this.notice = '正在伸手抓稳扶手'
  }
  private approachStation(id: string, seat: boolean) {
    const hit = this.stations.contactFor(id, this.state, this.rig)
    if (!hit) { this.notice = '请靠近设备的可抓握表面'; return false }
    this.releaseGrip()
    this.reaching = { point: vector(hit.point), normal: vector(hit.normal), side: hit.side, station: id, seat, elapsed: 0 }; this.notice = '正在伸手接触设备'; return true
  }
  private advanceReach(dt: number) {
    const intent = this.reaching; if (!intent) return
    intent.elapsed += dt
    const t = Math.min(1, intent.elapsed / MICRO_REACH_SECONDS), amount = t * t * t * (10 + t * (-15 + t * 6))
    const touch = this.rig.reach(intent.point, intent.side, intent.normal, amount); intent.side = touch.side
    if (!touch.reachable || intent.point.distanceTo(vector(this.state.position)) > 1.05 || vector(this.state.velocity).length() > .65) {
      this.reaching = undefined; this.notice = '无法保持可达接触，继续漂浮；靠近后再试'; return
    }
    if (t < 1) return
    if (touch.error > .012) { this.reaching = undefined; this.notice = '手部未形成实际接触，继续漂浮'; return }
    this.reaching = undefined
    // A completed new contact replaces any withdrawal from the previous grip.
    this.withdrawing = undefined
    if (intent.button) { this.eva = this.doors.operate(intent.button, this.eva, this.doorContext()); this.notice = this.eva.notice }
    else if (intent.station) { this.state = this.stations.interact(this.state, this.rig, this.outfit.worn, intent.station, { point: plain(intent.point), normal: plain(intent.normal), side: intent.side }); this.notice = this.stations.notice }
    else if (intent.grip) { this.state = catchCabinFloat(this.state, intent.grip, touch.point); this.notice = this.state.notice }
  }
  private boardingSeat() { return this.stations.boardingSeat || !!this.reaching?.seat }
  private canPressDoor(button: { id: string; point: Vector3 }) {
    const drift = vector(this.state.velocity).multiplyScalar(MICRO_REACH_SECONDS), normal = new Vector3(0, 0, button.id === 'inner-back' ? 1 : -1), side = this.rig.handFor(button.point)
    return vector(this.state.velocity).length() <= .65 && [0, .5, 1].every(t => {
      const offset = drift.clone().multiplyScalar(t)
      return button.point.distanceTo(vector(this.state.position).add(offset)) <= 1.05 && this.surfaces.clear(vector(this.state.position).add(offset), button.point) && this.rig.canReach(button.point.clone().sub(offset), normal, side)
    })
  }
  private doorContext() {
    const context = this.doors.context(this.state.position, this.tether.anchor, this.stable, !this.eva.tether || this.evaMotion.clear, this.doors.snapshot().outer.blocked)
    return { ...context, atInnerDoor: context.atInnerDoor && this.doors.buttons.some(b => b.id !== 'outer' && this.canPressDoor(b)), atOuterDoor: context.atOuterDoor && this.canPressDoor(this.doors.buttons[2]) }
  }
  private pressDoor(id: string) {
    if (['donning', 'doffing'].includes(this.eva.suit) || ['depressurizing', 'repressurizing'].includes(this.eva.pressure)) { this.notice = '先完成或取消当前穿脱与压力过渡'; return }
    const button = this.doors.buttons.find(b => b.id === id)
    if (!button || !this.canPressDoor(button)) { this.notice = '请靠近门旁按钮并减慢漂移，让手保持可达'; return }
    this.reaching = { button: id, point: button.point.clone(), normal: new Vector3(0, 0, id === 'inner-back' ? 1 : -1), elapsed: 0 }; this.notice = '正在伸手操作门控按钮'
  }
  key(code: string, down: boolean) {
    return cabinKeyBinding(this.keys, code, down, this.running, { grip: () => this.grip(), mode: () => this.toggleControls(), eva: a => this.evaAction(a), hand: a => this.action(a) })
  }
  clearInput() { this.keys.clear(); this.nudge = { forward: 0, right: 0, up: 0, seconds: 0 }; this.seatEscape.stop(this.rig) }
  private wear() {
    if (!this.state.contact) { this.notice = '先抓稳服舱附近的扶手，再穿脱宇航服'; return }
    if (!this.eva.lockerOpen || !this.lockerDoor.ready) { this.notice = '先打开宇航服柜门，等待完全展开'; return }
    if (!this.outfit.worn && !this.outfit.wearPoints().every(p => this.surfaces.clear(this.state.position, p))) { this.notice = '宇航服与背包的净空不足，请先离设备稍远一些'; return }
    this.eva = commandEva(this.eva, this.eva.suit === 'ready' ? 'doff' : 'wear', {
      atLocker: this.outfit.nearLocker(vector(this.state.position)), atInnerDoor: false, atOuterDoor: false, atAnchor: false,
      shipStable: true, outerBlocked: true, lineClear: false })
    this.notice = this.eva.notice
  }
  evaAction(action: CabinEvaAction) {
    if (!this.running) return false
    if (this.equipment.inspection || motionStudyActive(this.equipment.study)) { this.notice = '先完成或取消工位巡检与运动观测'; return true }
    if (['donning', 'doffing'].includes(this.eva.suit) || ['depressurizing', 'repressurizing'].includes(this.eva.pressure)) { this.notice = '先完成当前穿脱或压力过渡，Esc 可取消'; return true }
    if (this.reaching || this.stations.busy || this.state.fixed) { this.notice = '先完成或取消当前设备动作'; return true }
    if (action === 'wear') { this.wear(); return true }
    if (action === 'inspect') return this.action('inspect')
    if (action === 'inner' || action === 'outer') {
      const button = this.doors.buttons.filter(b => action === 'outer' ? b.id === 'outer' : b.id !== 'outer')
        .sort((a, b) => a.point.distanceTo(vector(this.state.position)) - b.point.distanceTo(vector(this.state.position)))[0]
      this.pressDoor(button.id); return true
    }
    if (action === 'brake' || action === 'reel') {
      if (this.eva.location !== 'outside' || !this.eva.tether) { this.notice = '仅在已系留的舱外探索中使用'; return true }
      if (action === 'brake') this.brakeAssist = !this.brakeAssist; else this.reelAssist = !this.reelAssist
      return true
    }
    const context = { ...this.doorContext(), atLocker: this.outfit.nearLocker(vector(this.state.position)) }
    if (action === 'locker' && !this.model.getObjectByName('MicrogravityLockerDoorAssembly')) { this.notice = '当前服舱为敞开柜体，可抓稳后穿戴'; return true }
    if (action === 'locker' && !this.state.contact) { this.notice = '先按 X 抓稳服舱旁扶手'; return true }
    if (action === 'tether' && !this.state.contact) { this.notice = '先按 X 抓稳锚点旁扶手'; return true }
    const command = action === 'tether' ? this.eva.tether ? 'detach' : 'attach' : action === 'pressure' ? this.eva.pressure === 'vacuum' ? 'repress' : 'depress' : 'locker'
    const previous = this.eva
    this.eva = this.doors.procedure(command, this.eva, context); this.notice = this.eva.notice
    if (command === 'locker' && this.eva.lockerOpen !== previous.lockerOpen) this.lockerDoor.request(this.eva.lockerOpen)
    if (!this.evaMotion.sync(this.rig, this.eva.tether) && command === 'attach') { this.eva = { ...previous, notice: this.evaMotion.notice }; this.notice = this.eva.notice; this.evaMotion.sync(this.rig, false) }
    return true
  }
  private equipmentContext(): CabinEquipmentContext {
    const id = this.stations.panelSnapshot()?.id
    return { id, near: !!id && this.stations.near(id, this.state.position), held: !!this.state.contact,
      ready: this.running && this.active && !this.reaching && !this.stations.busy && !this.state.fixed && this.eva.location === 'cabin' && this.eva.pressure === 'cabin' && !['donning', 'doffing'].includes(this.eva.suit),
      pressure: this.eva.pressure, doorsClosed: !this.eva.innerOpen && !this.eva.outerOpen, suit: this.eva.suit,
      oxygen: this.suitResources.oxygen, battery: this.suitResources.battery, tether: this.eva.tether,
      motion: { position: { ...this.state.position }, velocity: { ...this.state.velocity }, free: !this.state.contact && !this.state.fixed && !this.stations.busy && !this.reaching, stable: this.stable, blocked: this.blocked } }
  }
  equipmentAction(id: string, action: CabinEquipmentAction) {
    if (!this.running || !this.active) return false
    if (action === 'grip') {
      if (!this.equipmentContext().ready || this.equipment.inspection || motionStudyActive(this.equipment.study)) { this.notice = '请先完成或取消当前动作，并返回增压生活舱'; return true }
      if (this.stations.panelSnapshot()?.id !== id || !this.stations.near(id, this.state.position)) { this.notice = '先靠近并查看这台设备'; return true }
      const rail = this.surfaces.nearestGrip(this.state.position, g => g.id.startsWith(`${id}:`) && this.rig.canReach(g.point, g.surfaceNormal))
      const hit = rail ? { point: plain(rail.point), normal: plain(rail.surfaceNormal), side: this.rig.handFor(rail.point) } : this.stations.contactFor(id, this.state, this.rig)
      if (!hit) { this.notice = '当前姿态没有可达抓点，请靠近设备正面'; return true }
      const grip = { id: `station:${id}:contact`, point: vector(hit.point), normal: vector(hit.normal), surfaceNormal: vector(hit.normal), title: '设备实际抓点' }
      this.surfaces.rememberGrip(grip); this.releaseGrip(); this.reaching = { point: grip.point, normal: grip.normal, side: hit.side, grip, elapsed: 0 }; this.notice = '正在伸手抓稳设备'; return true
    }
    if (action === 'open') {
      if (this.reaching || this.stations.busy || this.state.fixed || !this.stations.openPanel(id, this.state.position)) { this.notice = '请靠近设备无遮挡的操作面'; return true }
      this.notice = this.stations.notice; this.resolvePrompt(); return true
    }
    const study = this.equipment.study
    this.equipment = commandCabinEquipment(this.equipment, id, action, this.equipmentContext()); this.notice = this.equipment.notice
    if (action === 'study-arm' && this.equipment.study !== study && this.equipment.study?.phase === 'armed') { this.controlMode = 'inertial'; this.keys.clear(); this.notice = '观测已登记，已切换真实惯性模式；请选择安全方向推离' }
    return true
  }
  get cabinLight() { return this.equipment.light }
  toggleControls() {
    if (!this.running || !this.active) return false
    if (this.reaching || this.stations.busy || this.state.fixed || motionStudyActive(this.equipment.study) || this.equipment.inspection || ['donning', 'doffing'].includes(this.eva.suit) || ['depressurizing', 'repressurizing'].includes(this.eva.pressure)) { this.notice = '先完成或取消当前设备、穿脱或观测动作'; return true }
    this.controlMode = this.controlMode === 'assisted' ? 'inertial' : 'assisted'; this.keys.clear()
    this.notice = this.controlMode === 'assisted' ? '端游辅助：WASD移动、Space上浮、C下潜，松键缓停' : '真实惯性：扶稳后选择方向推离，无支撑时保持惯性'
    return true
  }
  private evaControls() {
    const context = { ...this.doorContext(), atLocker: this.outfit.nearLocker(vector(this.state.position)) }
    return cabinEvaControls(this.eva, { ...context, held: !!this.state.contact, busy: !!this.reaching || this.stations.busy || !!this.equipment.inspection || motionStudyActive(this.equipment.study) || ['donning', 'doffing'].includes(this.eva.suit) || ['depressurizing', 'repressurizing'].includes(this.eva.pressure),
      lockerAvailable: this.lockerDoor.available, lockerReady: this.lockerDoor.ready, brake: this.brakeAssist, reel: this.reelAssist })
  }
  update(seconds: number, _input: CabinMove, yaw: number, walking: boolean, seated: boolean, running: boolean, frame: CabinFloatFrame = {}) {
    this.active = walking; this.seatedView = seated; this.running = running
    if (!running || !Number.isFinite(seconds) || seconds <= 0) { this.clearInput(); return }
    const dt = Math.min(.05, seconds), beforePose = this.rig.bodyPoints(), previous = this.state
    const assisted = this.controlMode === 'assisted' && !this.eva.tether && this.eva.location !== 'outside'
    if (this.seatEscape.tracking) this.seatEscape.sync(dt, microgravityInput(this.keys, walking, this.state.orientation, yaw, this.nudge, true, assisted), this.state, this.rig, assisted && walking && !this.state.contact && !this.state.fixed && !this.stations.busy && !this.reaching && !this.equipment.inspection && !['donning', 'doffing'].includes(this.eva.suit) && !['depressurizing', 'repressurizing'].includes(this.eva.pressure))
    const lockerNotice = this.lockerDoor.notice; this.lockerDoor.step(dt, beforePose, this.surfaces)
    if (lockerNotice !== this.lockerDoor.notice) this.notice = this.lockerDoor.notice
    this.stable = vector(frame.angularVelocity ?? { x: 0, y: 0, z: 0 }).length() < .02 && vector(frame.acceleration ?? { x: 0, y: 0, z: 0 }).length() < .02
    const doorNotice = this.doors.notice
    this.doors.step(dt, beforePose, this.surfaces, this.eva.tether ? this.evaMotion.cord() : []); this.eva = this.doors.sync(this.eva)
    if (this.doors.notice !== doorNotice) this.notice = this.doors.notice
    const previousSuit = this.eva.suit, previousPressure = this.eva.pressure
    if (['donning', 'doffing'].includes(this.eva.suit) && (!this.state.contact || !this.outfit.nearLocker(vector(this.state.position)))) {
      this.eva = cancelEvaProcedure(this.eva); this.notice = '已失去服舱支撑，穿脱已取消'
    }
    const stationPose = this.stations.pose()
    this.restView += ((stationPose.mode === 'sleep' ? stationPose.amount : 0) - this.restView) * (1 - Math.exp(-dt * 5))
    this.rig.locomotion(vector(this.state.velocity), this.state.angularVelocity.y, assisted && !this.state.contact && !this.stations.busy && !this.state.fixed && !this.reaching && !this.withdrawing)
    this.eva = stepEvaProcedure(this.eva, dt); this.outfit.step(dt, this.eva, stationPose.mode, stationPose.amount, this.state.contact ? vector(this.state.contact.point) : undefined)
    if (this.eva.suit === 'ready') { this.suitResources.oxygen = Math.max(0, this.suitResources.oxygen - dt / 1800); this.suitResources.battery = Math.max(0, this.suitResources.battery - dt / 2700) }
    if (this.eva.suit !== previousSuit || this.eva.pressure !== previousPressure) this.notice = this.eva.notice
    this.advanceWithdrawal(dt)
    this.hold()
    if (!this.stations.busy && !this.state.fixed && !this.surfaces.poseClear(beforePose, this.rig.bodyPoints(), this.departing, assisted ? 0 : .003)) this.rig.rollbackPose()
    this.hold()
    const value = (positive: string, negative: string) => walking ? Number(this.keys.has(positive)) - Number(this.keys.has(negative)) : 0
    const ready = !['donning', 'doffing'].includes(this.eva.suit) && (!assisted || !this.reaching && !this.stations.busy && !this.state.fixed && !this.equipment.inspection && !['depressurizing', 'repressurizing'].includes(this.eva.pressure))
    const input = microgravityInput(this.keys, walking, this.state.orientation, yaw, this.nudge,
      ready, assisted)
    if (assisted && !ready) input.pitch = input.yaw = input.roll = 0
    this.blocked = false
    const stationNotice = this.stations.notice, docking = this.stations.busy
    if (docking && (input.forward || input.right || input.up)) this.stations.cancel(true)
    this.state = this.stations.advance(this.state, dt, this.rig, frame)
    const fabric = this.stations.fabric(); this.fabric.apply(fabric.id, fabric.amount)
    if (this.stations.notice !== stationNotice) this.notice = this.stations.notice
    const outside = this.eva.location === 'outside' && this.eva.tether
    if (assisted && ready && walking && !docking) this.state = assistCabinControls(this.seatEscape.prepare(input, this.state, this.rig), input, frame, dt)
    if (this.eva.tether && !this.state.contact) this.state = this.evaMotion.step(this.state, this.rig, { ...input, thrusters: outside, brake: outside && (this.brakeAssist || this.keys.has('KeyB')), stabilize: outside && (this.brakeAssist || this.keys.has('KeyB')), reel: outside ? value('KeyK', 'KeyL') || Number(this.reelAssist) : 0 }, frame, dt)
    else if (!docking) this.state = stepCabinFloat(this.state, input, frame, dt, (from, to, velocity) => {
      if (vector(to).distanceToSquared(vector(from)) < 1e-16) return { position: to, velocity }
      const points = this.rig.bodyPoints().map(p => p.add(vector(from).sub(this.actor.position))), result = this.surfaces.translate(points, from, to, velocity, previous.contact ?? this.departing, this.seatSlide && assisted && !outside)
      if (this.seatEscape.available && result.contact && assisted && ready && !previous.contact && !docking) this.seatEscape.begin(result.contact.owner, this.rig.sampleIdentity(result.contact.sample)?.bone, input, this.state, this.rig)
      if (this.surfaces.lastCollision && !this.surfaces.lastCollision.pose) Object.assign(this.surfaces.lastCollision, { identity: this.rig.sampleIdentity(this.surfaces.lastCollision.sample), pose: { rootRotation: this.actor.quaternion.toArray(), bones: this.rig.poseRotations() } })
      this.blocked ||= vector(result.position).distanceTo(vector(to)) > .0001; return result
    })
    const oldPoints = this.rig.bodyPoints(); this.applyBody()
    if (!docking && !this.state.fixed && !this.surfaces.poseClear(oldPoints, this.rig.bodyPoints(), this.departing, assisted ? 0 : .003)) { this.state = { ...this.state, orientation: previous.orientation, angularVelocity: { x: 0, y: 0, z: 0 } }; this.applyBody() }
    this.advanceReach(dt); this.hold(); this.resolvePrompt()
    if (!this.evaMotion.sync(this.rig, this.eva.tether, dt)) { this.state = { ...previous, velocity: { x: 0, y: 0, z: 0 } }; this.applyBody(); this.notice = this.evaMotion.notice }
    this.evaMotion.reconcile(this.state, this.rig, frame, this.eva.tether)
    const location = this.eva.location; this.eva = this.doors.crossed(this.eva, this.rig.bodyPoints(), this.state.position, this.doorContext()); if (this.eva.location !== location) this.notice = this.eva.notice
    if (previous.contact && !this.state.contact) { this.notice = assisted ? '已离开支撑；WASD移动，松键缓停' : this.state.notice; this.departing = previous.contact; this.startWithdrawal(previous.contact) }
    if (input.push && this.state.contact && !docking) this.notice = this.state.contactSeconds < .25 ? '正在扶稳，随后即可推离' : this.state.notice
    if (this.blocked) this.notice = assisted ? '前方有结构；换方向退出，松键缓停，B制动' : '移动被实际结构挡住；换个方向，靠近扶手按 X 抓稳'
    if (assisted && ready && !this.blocked && !docking && !this.state.fixed && (input.forward || input.right || input.up || input.yaw || input.pitch || input.roll || input.brake)) this.notice = input.brake ? vector(this.state.velocity).length() < .01 ? '辅助制动：已停稳，可直接移动或转身' : '正在辅助减速' : '端游辅助：移动时跟随视线，松键缓停，F操作'
    if (this.departing && this.rig.bodyPoints().every(p => p.distanceTo(vector(this.departing!.point)) > .18)) this.departing = undefined
    const equipmentNotice = this.equipment.notice; this.equipment = stepCabinEquipment(this.equipment, this.equipmentContext(), dt)
    if (this.equipment.notice !== equipmentNotice) this.notice = this.equipment.notice
    if (this.nudge.seconds > 0) this.nudge.seconds -= dt; else this.nudge.forward = this.nudge.right = this.nudge.up = 0
  }
  camera(yaw: number, pitch: number, observer = false) {
    this.outfit.apply(this.eva)
    if (observer) { this.actor.visible = true; return undefined }
    if (this.stations.seated && this.seatedView) {
      const head = this.rig.head().add(new Vector3(0, .015, -.06)), p = pitch - .22
      this.actor.visible = false
      return { position: plain(head), target: plain(head.clone().add(new Vector3(-Math.sin(yaw) * Math.cos(p), Math.sin(p), -Math.cos(yaw) * Math.cos(p)))), feet: { ...this.state.position }, blocked: false }
    }
    if (!this.active) return undefined
    const angle = Math.max(-1.2, Math.min(1.2, pitch)), pending = this.reaching?.station, inboard = this.stations.cameraInboard(pending), blend = Math.min(1, this.restView * 3)
    const target = this.actor.position.clone().add(new Vector3(0, .35, 0)).lerp(this.actor.position.clone().add(new Vector3(0, .05, 0)), blend)
    const offset = new Vector3(Math.sin(yaw) * 2.1 * Math.cos(angle), .35 + Math.sin(angle), Math.cos(yaw) * 2.1 * Math.cos(angle))
      .lerp(new Vector3(inboard * 1.9, .2 + Math.sin(angle) * .45, Math.sin(yaw) * .42), blend)
    if (inboard) offset.x = inboard * Math.max(.9, offset.x * inboard)
    const wanted = target.clone().add(offset), hit = this.surfaces.cast(target, wanted, inboard ? this.stations.cameraObject(pending) : undefined)
    const position = hit ? target.clone().lerp(wanted, Math.max(0, (hit.distance - .1) / target.distanceTo(wanted))) : wanted
    this.actor.visible = position.distanceTo(target) > .65
    return { position: plain(position), target: plain(target), feet: { ...this.state.position }, blocked: false }
  }
  action(action: CabinHandAction) {
    if (!this.running) return false
    if (this.eva.suit === 'donning' || this.eva.suit === 'doffing') { this.notice = '先完成或取消穿脱动作'; return false }
    if (action === 'inspect') {
      if (this.outfit.worn && this.outfit.nearLocker(vector(this.state.position))) {
        const ready = this.eva.suit === 'ready' && this.actor.getObjectByName('head') !== undefined
        this.eva = inspectEvaSuit(this.eva, { helmet: ready, seal: ready, oxygen: this.suitResources.oxygen > .2, battery: this.suitResources.battery > .2, lifeSupport: ready && this.suitResources.battery > 0 }); this.notice = this.eva.notice
      } else { this.stations.inspect(); this.notice = this.stations.notice || '穿戴后靠近服舱，I 检查装备' }
      return true
    }
    if (this.state.fixed || this.stations.busy) { this.notice = '先解除设备约束再做手部动作'; return false }
    if (action === 'wave') { if (this.state.contact) { this.notice = '先松手，再挥手'; return false } this.reaching = undefined; if (this.withdrawing?.side === 'R') this.withdrawing.wave = true; else this.rig.wave(); this.notice = '挥手'; return true }
    if (action === 'curl' || action === 'relax') { this.rig.fingers(action === 'curl'); return true }
    return false
  }
  interact(): 'cabin' | 'cockpit' | undefined {
    if (!this.running) return
    if (['donning', 'doffing'].includes(this.eva.suit) || ['depressurizing', 'repressurizing'].includes(this.eva.pressure)) { this.notice = '先完成当前穿脱或压力过渡，Esc 可取消'; return }
    if (this.reaching) { this.reaching = undefined; this.notice = '已取消伸手，保持惯性'; return }
    if (this.stations.panelSnapshot()) { this.state = this.stations.interact(this.state, this.rig, this.outfit.worn); this.notice = this.stations.notice; this.resolvePrompt(); return }
    const wasSeated = this.stations.seated
    const door = this.doors.prompt(this.state.position, this.surfaces)
    if (door?.deviceId && !this.state.fixed && !this.stations.busy) { this.pressDoor(door.deviceId); return }
    const prompt = this.stations.prompt(this.state, this.rig)
    if (prompt?.deviceId && !this.state.fixed && !this.stations.busy && (prompt.id === 'seat' || prompt.id === 'bed')) {
      if (prompt.id === 'bed' && this.outfit.worn) { this.notice = '先把宇航服收回服舱，再进入睡袋'; return }
      this.approachStation(prompt.deviceId, prompt.id === 'seat')
    }
    else if (prompt) { this.state = this.stations.interact(this.state, this.rig, this.outfit.worn); this.notice = this.stations.notice }
    else this.grip()
    this.resolvePrompt(); return wasSeated ? 'cabin' : this.boardingSeat() ? 'cockpit' : undefined
  }
  requestSeat(seated: boolean) {
    if (seated && (this.equipment.inspection || motionStudyActive(this.equipment.study))) { this.notice = '先完成或取消工位巡检与运动观测'; return false }
    if (!seated) { if (this.reaching?.seat) this.reaching = undefined; if (this.stations.seated || this.stations.boardingSeat) this.stations.leave(); return true }
    if (this.stations.seated || this.stations.boardingSeat || this.reaching?.seat) return true
    const id = this.stations.nearestSeatId(this.state.position)
    if (!id) { this.notice = '请靠近驾驶座再坐下'; return false }
    return this.approachStation(id, true)
  }
  nudgeMove(forward: number, right: number, up = 0) { if (!this.state.contact && this.controlMode === 'inertial') { this.notice = '先抓稳扶手再推离'; return } this.nudge = { forward, right, up, seconds: .2 } }
  hitButton(camera: Camera, x: number, y: number, width: number, height: number) { const id = this.running ? this.doors.hit(camera, x, y, width, height) : undefined; if (id) this.pressDoor(id); return !!id }
  cancel(stand = false) {
    const reaching = !!this.reaching
    if (stand && motionStudyActive(this.equipment.study)) { this.equipment = commandCabinEquipment(this.equipment, 'micro-work', 'study-cancel', this.equipmentContext()); this.notice = this.equipment.notice }
    if (stand && this.equipment.inspection) { this.equipment = commandCabinEquipment(this.equipment, this.equipment.inspection.id, 'inspect-cancel', this.equipmentContext()); this.notice = this.equipment.notice }
    this.clearInput(); this.reaching = undefined; this.rig.cancel(); this.stations.cancel(stand, !stand && !!this.equipment.inspection)
    this.brakeAssist = this.reelAssist = false
    if (stand) { const previous = this.eva; this.eva = cancelEvaProcedure(this.eva); if (previous !== this.eva) { this.outfit.apply(this.eva); this.notice = this.eva.notice } }
    if (reaching) this.notice = '已取消伸手，保持惯性'
    else if (stand && this.stations.busy) this.notice = this.stations.notice
    this.resolvePrompt()
  }
  reset() { this.cancel(); this.equipment = createCabinEquipmentUse(); this.withdrawing = undefined; this.stations.reset(); this.fabric.apply(); this.doors.reset(); this.lockerDoor.reset(); this.evaMotion.reset(); this.eva = createEvaProcedure(); this.eva.lockerOpen = !this.lockerDoor.available; this.suitResources = { oxygen: 1, battery: 1 }; this.outfit.apply(this.eva); this.spawnAtRail() }
  save(): MicrogravitySaved { return { float: structuredClone(this.state), controlMode: this.controlMode, departing: this.departing ? structuredClone(this.departing) : undefined, eva: structuredClone(this.eva), stations: this.stations.save(), equipment: structuredClone(this.equipment), doors: this.doors.save(), lockerDoor: this.lockerDoor.snapshot(), evaMotion: this.evaMotion.save(), suitResources: { ...this.suitResources } } }
  snapshot(): Omit<ReturnType<CurrentCabinRuntime['snapshot']>, 'posture'> & { posture: string; microgravity: true; controlMode: CabinControlMode; float: CabinFloatState; eva: EvaProcedure; evaControls: ReturnType<typeof cabinEvaControls>; equipment: CabinEquipmentUse; equipmentContext: CabinEquipmentContext; nearbyEquipment: { id: string; title: string }[]; atSuitLocker: boolean; tether: ReturnType<MicrogravityEvaMotion['snapshot']>; collisionProbe?: CabinCollisionProbe } {
    return { active: this.active, seated: this.stations.seated, pilotReady: this.stations.seated, posture: this.stations.seated ? 'seated' : this.stations.resting ? 'resting' : this.stations.busy ? 'docking' : this.reaching ? 'reaching' : this.state.contact ? 'gripped' : 'floating', seatProgress: this.stations.seated ? 1 : 0, position: { ...this.state.position }, heading: 0, blocked: this.blocked,
      action: this.stations.seated ? '已入座' : this.stations.resting ? '睡袋休息' : this.stations.busy ? '对齐设备' : this.reaching ? '伸手接触' : this.state.contact ? '抓握' : '漂浮', resting: undefined, devicePanel: this.stations.panelSnapshot(), prompt: this.prompt, busy: this.stations.busy || !!this.reaching,
      door: this.doors.snapshot().inner, doorLabel: this.eva.pressure === 'cabin' ? this.doors.snapshot().inner.progress === 0 ? '气闸内门已密合' : '气闸内门活动中' : '气闸压力隔离中', notice: this.notice, minimumSoleY: this.rig.bodyPoints().reduce((y, p) => Math.min(y, p.y), Infinity),
      buttonPosition: { x: 0, y: 0, z: 4.85 }, rigPrototype: true, microgravity: true, controlMode: this.controlMode, float: structuredClone(this.state), eva: structuredClone(this.eva), evaControls: this.evaControls(), equipment: structuredClone(this.equipment), equipmentContext: this.equipmentContext(), nearbyEquipment: this.stations.panelSnapshot() ? this.stations.nearbyPanels(this.state.position) : [], atSuitLocker: this.outfit.nearLocker(vector(this.state.position)), tether: this.evaMotion.snapshot(), collisionProbe: this.surfaces.lastCollision && { ...this.surfaces.lastCollision, escape: this.seatEscape.snapshot() } }
  }
  dispose() { this.cancel(); this.evaMotion.dispose(); this.outfit.dispose(); this.stations.dispose(); this.fabric.dispose(); this.tether.dispose(); this.doors.dispose(); this.lockerDoor.dispose(); this.surfaces.dispose() }
}
