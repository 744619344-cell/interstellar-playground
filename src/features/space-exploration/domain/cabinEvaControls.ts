import { evaChecked, type EvaContext, type EvaProcedure } from './evaProcedure'

export const CABIN_EVA_ACTIONS = ['locker', 'wear', 'inspect', 'tether', 'pressure', 'inner', 'outer', 'brake', 'reel'] as const
export type CabinEvaAction = typeof CABIN_EVA_ACTIONS[number]
export const isCabinEvaAction = (value: string): value is CabinEvaAction => (CABIN_EVA_ACTIONS as readonly string[]).includes(value)
export interface EvaControl { id: CabinEvaAction; label: string; key?: string; enabled: boolean; reason?: string }
export interface EvaControlsContext extends EvaContext {
  held: boolean; busy: boolean; lockerReady: boolean; lockerAvailable: boolean; brake: boolean; reel: boolean
}
export interface CabinEvaControls { visible: boolean; stage: string; hint: string; pressure: string; controls: EvaControl[] }

/** Describes the same physical procedure used by keyboard and pointer actions. */
export function cabinEvaControls(s: EvaProcedure, c: EvaControlsContext): CabinEvaControls {
  const controls: EvaControl[] = [], checked = evaChecked(s), changing = s.suit === 'donning' || s.suit === 'doffing'
  const add = (id: CabinEvaAction, label: string, condition: boolean, reason: string, key?: string) => controls.push({
    id, label, key, enabled: condition && !c.busy, reason: c.busy ? '等待当前动作完成，Esc 可取消' : condition ? undefined : reason
  })
  let stage = '穿戴准备', hint = '靠近宇航服舱，抓稳扶手后操作柜门与装备。'
  if (c.atLocker) {
    add('locker', s.lockerOpen ? '关闭宇航服舱' : '打开宇航服舱', c.lockerAvailable && c.held && !changing && !s.tether, !c.lockerAvailable ? '柜门待制作，当前为敞开柜体' : !c.held ? '先按 X 抓稳扶手' : '穿脱或系留期间不能关柜')
    add('wear', s.suit === 'ready' ? '脱下并收纳宇航服' : changing ? '穿脱进行中' : '穿上宇航服', c.held && s.lockerOpen && c.lockerReady && !changing && !s.tether && s.pressure === 'cabin', !c.held ? '先按 X 抓稳扶手' : !s.lockerOpen || !c.lockerReady ? '先打开宇航服舱并等门完全打开' : '先返回增压区并解除系留', 'R')
    if (s.suit === 'ready') add('inspect', checked ? '重新检查装备' : '检查出舱装备', s.pressure === 'cabin', '需在增压区检查', 'I')
  }
  if (s.suit === 'ready' && s.location === 'cabin') { stage = '前往气闸'; hint = s.tether ? '安全绳仍连接气闸锚点。返回锚点解挂后，才可脱下宇航服。' : checked ? '装备检查通过。靠近内门按钮可申请开启；门框穿行仍在复验。' : '先在服舱完成装备检查，再进入气闸。' }
  if (c.atInnerDoor || s.location === 'lock') add('inner', s.innerOpen ? '关闭气闸内门' : '开启气闸内门', c.atInnerDoor && !s.outerOpen && s.pressure === 'cabin' && (s.innerOpen || !s.tether), !c.atInnerDoor ? '靠近内门按钮' : '先关外门、完成复压；开启前解挂安全绳', 'F')
  if (s.location === 'lock') {
    stage = '气闸准备'; hint = s.innerOpen ? '进入气闸后关闭内门，再到结构锚点连接安全绳。' : !s.tether ? '靠近外门旁结构锚点，连接安全绳。' : '双门关闭、系留与装备检查就绪后，可进行游戏化减压。'
    add('tether', s.tether ? '解挂安全绳' : '连接安全绳', c.atAnchor && c.held && s.pressure === 'cabin' && !s.outerOpen && checked, !c.atAnchor ? '靠近结构锚点' : !c.held ? '先按 X 抓稳锚点旁扶手' : '需已复压、外门关闭并通过装备检查', 'T')
    add('pressure', s.pressure === 'vacuum' ? '复压气闸' : '减压气闸', !s.innerOpen && !s.outerOpen && c.shipStable && (s.pressure === 'vacuum' || s.pressure === 'cabin' && checked && s.tether), '需双门关闭、飞船稳定；减压前须装备检查和系留', 'P')
    add('outer', s.outerOpen ? '关闭舱外门' : '开启舱外门', c.atOuterDoor && (s.outerOpen ? !c.outerBlocked && c.lineClear : !s.innerOpen && s.pressure === 'vacuum' && checked && s.tether && c.shipStable), !c.atOuterDoor ? '靠近外门按钮' : '检查门互锁、装备、安全绳及门缝净空', 'F')
    if (s.pressure === 'vacuum') hint = s.outerOpen ? '扶稳选方向后推离，穿过外门进入舱外；安全绳保持连接。' : '减压完成。靠近外门按钮，开启后推离出舱。'
  }
  if (s.location === 'outside') {
    stage = '系留探索'; hint = 'WASD / ZC 控制方向，松键保留惯性。B 减速辅助；K/L 收放绳。沿安全绳返回外门。'
    add('brake', c.brake ? '关闭减速辅助' : '启动减速辅助', s.suit === 'ready' && s.tether, '保持穿戴与系留', 'B')
    add('reel', c.reel ? '停止卷收辅助' : '卷收辅助返回', s.tether && c.lineClear, '安全绳未连接或路径受阻', 'K')
  }
  const pressure = { cabin: '已增压', depressurizing: '减压中', vacuum: '已减压', repressurizing: '复压中' }[s.pressure]
  return { visible: c.atLocker || c.atInnerDoor || s.location !== 'cabin' || s.suit !== 'stowed', stage, hint, pressure, controls }
}
