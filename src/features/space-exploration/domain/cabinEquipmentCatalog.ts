export type CabinEquipmentKind = 'seat' | 'bed' | 'workbench' | 'locker' | 'console' | 'storage'
export interface CabinEquipmentDefinition {
  id: string; kind: CabinEquipmentKind; title: string; use: string; steps: string; exit: string
}
const item = (id: string, kind: CabinEquipmentKind, title: string, use: string, steps: string): CabinEquipmentDefinition =>
  ({ id, kind, title, use, steps, exit: 'F 结束查看，Esc 取消；暂停冻结，恢复后继续。' })

/** Only registered source objects are actionable. Full specifications and acceptance remain in P3-R01. */
export const CABIN_EQUIPMENT: readonly CabinEquipmentDefinition[] = [
  ...[1, 2, 3].map(i => item(`micro-sleep-${i}`, 'bed', `${i} 号睡眠舱`, '微重力休息与身体约束', '靠近后 F 进入睡袋；脱下宇航服，形成实际手部接触后对齐；F 离开。')),
  ...[-1, 1].map(i => item(`reused-seat-${i}`, 'seat', `${i < 0 ? '左' : '右'}驾驶座`, '固定身体并接管驾驶', '靠近后 F 坐下；约束到位后驾驶；F 解开约束起立。')),
  ...[-1, 1].map(i => item(`reused-main-console-${i}`, 'console', `${i < 0 ? '左' : '右'}仪表台`, '查看航行与舱门状态，照明和船载记录', 'F 查看；X 抓稳后切换照明或记录状态；驾驶需靠近座位入座。')),
  item('micro-locker', 'locker', '宇航服收纳舱', '宇航服存取与出舱装备检查', 'X 抓稳，打开柜门并等其完全展开；R 穿脱，I 检查。返舱复压解挂后才能脱服。'),
  item('micro-starboard-liner', 'storage', '舱壁服务与储物面板', '工具包领用归还、照明及状态查看', 'F 查看，X 抓稳后领用或归还工具包；随身清单显示当前保管位置。'),
  item('micro-work', 'workbench', '固定维护工位', '工位例行巡检与漂移观测登记', 'F 查看并 X 抓稳；领用工具包后可巡检。漂移观测无需工具包：登记后选安全方向推离，松键记录三秒；记录期间碰撞或抓回会使本次数据失效。完成后在原扶手抓稳，再推回工位。')
]
export const cabinEquipmentById = (id?: string) => CABIN_EQUIPMENT.find(e => e.id === id)
export const CABIN_EQUIPMENT_ACTIONS = ['open', 'grip', 'take-kit', 'return-kit', 'inspect-start', 'inspect-cancel', 'study-arm', 'study-cancel', 'light-normal', 'light-rest', 'record-status'] as const
export type CabinEquipmentAction = typeof CABIN_EQUIPMENT_ACTIONS[number]
export function parseCabinEquipmentAction(value: string) {
  const [prefix, id, action, extra] = value.split(':')
  return prefix === 'equipment' && !extra && cabinEquipmentById(id) && (CABIN_EQUIPMENT_ACTIONS as readonly string[]).includes(action)
    ? { id, action: action as CabinEquipmentAction } : undefined
}
