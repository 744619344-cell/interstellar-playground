export type EvaLocation = 'cabin' | 'lock' | 'outside'
export interface EvaChecks { helmet: boolean; seal: boolean; oxygen: boolean; battery: boolean; lifeSupport: boolean }
export interface EvaProcedure {
  location: EvaLocation; suit: 'stowed' | 'donning' | 'ready' | 'doffing'; lockerOpen: boolean
  innerOpen: boolean; outerOpen: boolean; pressure: 'cabin' | 'depressurizing' | 'vacuum' | 'repressurizing'
  tether: boolean; checks: EvaChecks; elapsed: number; notice: string
}
export interface EvaContext {
  atLocker: boolean; atInnerDoor: boolean; atOuterDoor: boolean; atAnchor: boolean
  shipStable: boolean; outerBlocked: boolean; lineClear: boolean
}
export type EvaCommand = 'locker' | 'wear' | 'doff' | 'inner' | 'enter' | 'leave' | 'attach' | 'detach'
  | 'depress' | 'repress' | 'outer' | 'exit' | 'return'
const unchecked = (): EvaChecks => ({ helmet: false, seal: false, oxygen: false, battery: false, lifeSupport: false })
export const evaChecked = (s: EvaProcedure) => s.suit === 'ready' && Object.values(s.checks).every(Boolean)
const deny = (s: EvaProcedure, notice: string) => ({ ...s, notice })
/** Shortened preview durations; never use these as real pressure or medical procedures. */
export const EVA_PREVIEW_TIMES = Object.freeze({ wear: 3, pressure: 4 })

export function createEvaProcedure(): EvaProcedure {
  return { location: 'cabin', suit: 'stowed', lockerOpen: false, innerOpen: false, outerOpen: false,
    pressure: 'cabin', tether: false, checks: unchecked(), elapsed: 0, notice: '靠近宇航服舱，R 穿戴' }
}

/** Production callers must supply actual inspection results; the preview labels its mock results. */
export function inspectEvaSuit(s: EvaProcedure, checks: EvaChecks): EvaProcedure {
  if (s.suit !== 'ready' || s.location === 'outside' || s.pressure !== 'cabin') return deny(s, '只能在增压区检查已穿戴的宇航服')
  return { ...s, checks: { ...checks }, notice: Object.values(checks).every(Boolean) ? '装备检查通过' : '装备检查未通过' }
}

function equipment(s: EvaProcedure, command: EvaCommand, c: EvaContext): EvaProcedure | undefined {
  if (command === 'locker' || command === 'wear' || command === 'doff') {
    if (!c.atLocker || s.location !== 'cabin' || s.pressure !== 'cabin' || s.outerOpen) return deny(s, '需返回增压生活舱的宇航服舱旁')
    if (s.suit === 'donning' || s.suit === 'doffing') return deny(s, '穿脱进行中')
    if (command === 'locker') return s.tether ? deny(s, '先返回气闸锚点解挂，再操作服舱柜门') : { ...s, lockerOpen: !s.lockerOpen, notice: '宇航服舱门已操作' }
    if (command === 'wear' && s.suit === 'stowed') return { ...s, suit: 'donning', lockerOpen: true, elapsed: 0, checks: unchecked(), notice: '正在穿戴；之后仍需装备检查' }
    if (command === 'doff' && s.suit === 'ready' && !s.tether) return { ...s, suit: 'doffing', lockerOpen: true, elapsed: 0, checks: unchecked(), notice: '正在脱下宇航服' }
    return deny(s, '当前不能执行穿脱；脱下前须已返舱并解除系留')
  }
  if (command === 'attach' || command === 'detach') {
    if (!c.atAnchor || s.location !== 'lock' || s.pressure !== 'cabin' || s.outerOpen) return deny(s, '只能在增压气闸的结构锚点连接或解挂')
    if (command === 'attach' && !evaChecked(s)) return deny(s, '先完成宇航服检查')
    return { ...s, tether: command === 'attach', notice: command === 'attach' ? '安全绳已连接结构锚点' : '安全绳已解挂' }
  }
}

function doors(s: EvaProcedure, command: EvaCommand, c: EvaContext): EvaProcedure | undefined {
  if (command === 'inner') {
    if (!c.atInnerDoor || s.outerOpen || s.pressure !== 'cabin' || s.location === 'outside') return deny(s, '内门互锁：外门须关闭，气闸须已复压')
    return { ...s, innerOpen: !s.innerOpen, notice: '内舱门已操作' }
  }
  if (command === 'outer') {
    if (s.outerOpen) {
      if (s.location !== 'lock' || !c.atOuterDoor || c.outerBlocked || !c.lineClear) return deny(s, '不能关外门：先返舱并让人物和绳索离开门缝')
      return { ...s, outerOpen: false, notice: '外门已关闭' }
    }
    if (!c.atOuterDoor || !c.shipStable || s.location !== 'lock' || s.innerOpen || s.pressure !== 'vacuum' || !evaChecked(s) || !s.tether)
      return deny(s, '外门互锁：需隔离、泄压、装备检查和安全绳连接')
    return { ...s, outerOpen: true, notice: '外门已开启' }
  }
  if (command === 'depress' || command === 'repress') {
    if (s.location !== 'lock' || s.innerOpen || s.outerOpen || !c.shipStable) return deny(s, '压力流程要求人在气闸内、双门关闭、飞船稳定')
    if (command === 'depress' && s.pressure === 'cabin' && evaChecked(s) && s.tether)
      return { ...s, pressure: 'depressurizing', elapsed: 0, notice: '正在泄压（演示缩短时间）' }
    if (command === 'repress' && s.pressure === 'vacuum') return { ...s, pressure: 'repressurizing', elapsed: 0, notice: '正在复压（演示缩短时间）' }
    return deny(s, '当前压力状态或出舱装备不满足要求')
  }
}

export function commandEva(s: EvaProcedure, command: EvaCommand, c: EvaContext): EvaProcedure {
  const handled = equipment(s, command, c) ?? doors(s, command, c)
  if (handled) return handled
  if (command === 'enter' && s.location === 'cabin' && c.atInnerDoor && s.innerOpen && s.pressure === 'cabin')
    return { ...s, location: 'lock', notice: '已进入气闸' }
  if (command === 'leave' && s.location === 'lock' && c.atInnerDoor && s.innerOpen && s.pressure === 'cabin')
    return { ...s, location: 'cabin', notice: s.tether ? '已返回生活舱，安全绳仍连接；请返回锚点解挂' : '已返回生活舱' }
  if (command === 'exit' && s.location === 'lock' && c.atOuterDoor && c.shipStable && s.outerOpen && !s.innerOpen && s.pressure === 'vacuum' && evaChecked(s) && s.tether)
    return { ...s, location: 'outside', notice: '已出舱，安全绳保持连接' }
  if (command === 'return' && s.location === 'outside' && c.atOuterDoor && s.outerOpen && s.pressure === 'vacuum')
    return { ...s, location: 'lock', notice: '已返舱；收好绳索后关闭外门' }
  return deny(s, '当前距离或状态不允许通行')
}

export function stepEvaProcedure(s: EvaProcedure, seconds: number, running = true): EvaProcedure {
  if (!running || !Number.isFinite(seconds) || seconds <= 0) return s
  const wearing = s.suit === 'donning' || s.suit === 'doffing', pressure = s.pressure === 'depressurizing' || s.pressure === 'repressurizing'
  if (!wearing && !pressure) return s
  const elapsed = s.elapsed + Math.min(seconds, .1), duration = wearing ? EVA_PREVIEW_TIMES.wear : EVA_PREVIEW_TIMES.pressure
  if (elapsed + 1e-8 < duration) return { ...s, elapsed }
  if (wearing) return { ...s, suit: s.suit === 'donning' ? 'ready' : 'stowed', elapsed: 0, notice: s.suit === 'donning' ? '穿戴完成，请检查装备' : '宇航服已归舱' }
  return { ...s, pressure: s.pressure === 'depressurizing' ? 'vacuum' : 'cabin', elapsed: 0,
    notice: s.pressure === 'depressurizing' ? '泄压完成，外门可申请开启' : '复压完成，内门可申请开启' }
}

/** Explicit player cancellation returns to the last stable equipment/pressure state. Pause never calls this. */
export function cancelEvaProcedure(s: EvaProcedure): EvaProcedure {
  if (s.suit === 'donning' || s.suit === 'doffing') return { ...s, suit: s.suit === 'donning' ? 'stowed' : 'ready', elapsed: 0, notice: '已取消穿脱，恢复原装备状态' }
  if (s.pressure === 'depressurizing' || s.pressure === 'repressurizing') return { ...s, pressure: s.pressure === 'depressurizing' ? 'cabin' : 'vacuum', elapsed: 0, notice: '已取消压力过渡，恢复原稳定压力' }
  return s
}
