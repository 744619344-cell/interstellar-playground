import { cabinEquipmentById, type CabinEquipmentAction } from './cabinEquipmentCatalog'
import { armCabinMotionStudy, cancelCabinMotionStudy, motionStudyActive, stepCabinMotionStudy, type CabinMotionStudy, type MotionStudyInput } from './cabinMotionStudy'

export interface CabinEquipmentLog { sequence: number; seconds: number; title: string; detail: string }
export interface CabinEquipmentUse {
  version: 1; kit: 'storage' | 'carried'; light: 'normal' | 'rest'; elapsed: number; sequence: number
  inspection?: { id: string; elapsed: number }; study?: CabinMotionStudy; inspections: number; log: CabinEquipmentLog[]; notice: string
}
export interface CabinEquipmentContext {
  id?: string; near: boolean; held: boolean; ready: boolean
  pressure: string; doorsClosed: boolean; suit: string; oxygen: number; battery: number; tether: boolean; motion?: MotionStudyInput
}
export const EQUIPMENT_INSPECTION_SECONDS = 4
export function createCabinEquipmentUse(saved?: CabinEquipmentUse): CabinEquipmentUse {
  return saved ? structuredClone(saved) : { version: 1, kit: 'storage', light: 'normal', elapsed: 0, sequence: 0, inspections: 0, log: [], notice: '抓稳后可操作设备' }
}
function record(s: CabinEquipmentUse, title: string, detail: string): CabinEquipmentUse {
  const sequence = s.sequence + 1
  return { ...s, sequence, log: [...s.log, { sequence, seconds: s.elapsed, title, detail }].slice(-24), notice: title }
}
function readings(c: CabinEquipmentContext) {
  const pressure = { cabin: '已增压', vacuum: '已减压', depressurizing: '减压中', repressurizing: '复压中' }[c.pressure] ?? '未知'
  return `气闸${pressure}；双门${c.doorsClosed ? '关闭' : '未全关'}；${c.suit === 'ready' ? `宇航服氧余量${Math.round(c.oxygen * 100)}%、电余量${Math.round(c.battery * 100)}%` : '宇航服未穿戴'}；安全绳${c.tether ? '已连接' : '未连接'}`
}
export function cabinEquipmentDenied(id: string, c: CabinEquipmentContext) {
  if (c.id !== id || !c.near) return '请靠近并打开这台设备的操作面板'
  if (!c.ready) return '先完成或取消当前动作，并返回增压生活舱'
  if (!c.held) return '先按 X 抓稳设备附近的实际抓点'
  return undefined
}
export function commandCabinEquipment(s: CabinEquipmentUse, id: string, action: CabinEquipmentAction, c: CabinEquipmentContext): CabinEquipmentUse {
  const denied = cabinEquipmentDenied(id, c), kind = cabinEquipmentById(id)?.kind
  if (action === 'study-cancel' && id === 'micro-work' && s.study && motionStudyActive(s.study)) return { ...s, study: cancelCabinMotionStudy(s.study), notice: '已停止运动观测' }
  if (action === 'inspect-cancel' && s.inspection?.id === id && c.id === id) return { ...s, inspection: undefined, notice: '已取消巡检，工具包仍在随身清单' }
  if (denied) return { ...s, notice: denied }
  if (s.inspection) return { ...s, notice: '巡检正在进行，先完成或取消' }
  if (motionStudyActive(s.study)) return { ...s, notice: '运动观测已登记，先完成或停止记录' }
  if (action === 'study-arm' && kind === 'workbench') return c.motion?.stable && !c.tether
    ? { ...s, study: armCabinMotionStudy(), notice: '漂移观测已登记；选安全方向推离，松键后记录' } : { ...s, notice: '观测要求飞船稳定且未连接受力绳索' }
  if (action === 'take-kit' && kind === 'storage') return s.kit === 'storage'
    ? record({ ...s, kit: 'carried' }, '已领用检修工具包', '工具包已登记到随身清单；储物处余量0') : { ...s, notice: '唯一工具包已在随身清单，无需重复领用' }
  if (action === 'return-kit' && kind === 'storage') return s.kit === 'carried'
    ? record({ ...s, kit: 'storage' }, '已归还检修工具包', '工具包已登记回储物处；随身余量0') : { ...s, notice: '随身没有待归还的工具包' }
  if (action === 'inspect-start' && kind === 'workbench') return s.kit === 'carried'
    ? { ...s, inspection: { id, elapsed: 0 }, notice: '工位巡检进行中，保持抓握；F / Esc 可取消' } : { ...s, notice: '先到储物面板领用检修工具包' }
  if (kind === 'storage' || kind === 'console') {
    if (action === 'light-normal' || action === 'light-rest') return record({ ...s, light: action === 'light-normal' ? 'normal' : 'rest' }, action === 'light-normal' ? '舱内照明已调至工作模式' : '舱内照明已调至休息模式', '现有舱内照明强度已切换')
    if (action === 'record-status') return record(s, '设备状态已记入船载日志', readings(c))
  }
  return { ...s, notice: '当前设备不提供这项操作' }
}
export function stepCabinEquipment(s: CabinEquipmentUse, c: CabinEquipmentContext, dt: number, running = true): CabinEquipmentUse {
  if (!running || !Number.isFinite(dt) || dt <= 0) return s
  const next = { ...s, elapsed: s.elapsed + Math.min(dt, .1) }, job = s.inspection
  if (s.study && motionStudyActive(s.study)) {
    const input = c.motion, valid = c.pressure === 'cabin' && !c.tether
    const study = input ? stepCabinMotionStudy(s.study, { ...input, stable: input.stable && valid }, dt) : { ...s.study, phase: 'invalid' as const, notice: '观测中止：缺少实际运动数据' }
    const observed = { ...next, study, notice: study.notice }
    return study.phase === 'complete' ? record(observed, '舱内漂移观测已归档', `时长${study.seconds.toFixed(2)}秒；位移${study.result!.displacement.toFixed(3)}米；匀速预测残差${study.result!.residual.toFixed(4)}米（模拟数据）`) : observed
  }
  if (!job) return next
  if (cabinEquipmentDenied(job.id, c) || s.kit !== 'carried') return { ...next, inspection: undefined, notice: '巡检已中止：离开工位、失去抓握或状态改变；工具包保留' }
  const elapsed = job.elapsed + Math.min(dt, .1)
  return elapsed + 1e-8 < EQUIPMENT_INSPECTION_SECONDS ? { ...next, inspection: { ...job, elapsed } }
    : record({ ...next, inspection: undefined, inspections: s.inspections + 1 }, '工位例行巡检完成', readings(c))
}
