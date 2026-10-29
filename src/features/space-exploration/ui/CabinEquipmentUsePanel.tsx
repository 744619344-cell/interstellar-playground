import { cabinEquipmentById, type CabinEquipmentAction } from '../domain/cabinEquipmentCatalog'
import { cabinEquipmentDenied, EQUIPMENT_INSPECTION_SECONDS, type CabinEquipmentUse, type CabinEquipmentContext } from '../domain/cabinEquipmentUse'
import type { ShipFlightAction } from '../rendering/spacecraft/shipFlightRuntime'
import { motionStudyActive } from '../domain/cabinMotionStudy'

export default function CabinEquipmentUsePanel({ id, state, context, paused, onAction }: {
  id: string; state: CabinEquipmentUse; context: CabinEquipmentContext; paused: boolean; onAction: (action: ShipFlightAction) => void
}) {
  const device = cabinEquipmentById(id); if (!device) return null
  const denied = paused ? '已暂停，恢复后继续操作' : cabinEquipmentDenied(id, context), working = !!state.inspection || motionStudyActive(state.study)
  const control = (action: CabinEquipmentAction, label: string, unavailable = false) => <button type='button' key={action}
    disabled={!!denied || working && action !== 'inspect-cancel' || unavailable} onClick={() => onAction(`equipment:${id}:${action}`)}>{label}</button>
  return <div className='cabin-equipment-use'>
    {['storage', 'workbench', 'console'].includes(device.kind) && <>
      <p>检修工具包：{state.kit === 'carried' ? '随身清单 1 · 储物处 0' : '随身清单 0 · 储物处 1'}</p>
      {denied && <small role='status'>{denied}</small>}
      <div className='cabin-equipment-controls'>
        {device.kind === 'storage' && (state.kit === 'storage' ? control('take-kit', '领用工具包') : control('return-kit', '归还工具包'))}
        {device.kind === 'workbench' && (state.inspection ? control('inspect-cancel', '取消本次巡检') : control('inspect-start', '开始工位巡检', state.kit !== 'carried'))}
        {device.kind === 'workbench' && control('study-arm', '登记漂移惯性观测')}
        {(device.kind === 'storage' || device.kind === 'console') && <>
          {state.light === 'normal' ? control('light-rest', '切换休息照明') : control('light-normal', '切回工作照明')}
          {control('record-status', '记录当前设备状态')}
        </>}
      </div>
      {device.kind === 'workbench' && <>
        {state.kit !== 'carried' && <small>巡检需先在储物面板领用工具包；漂移观测无需工具包。</small>}
        {state.inspection && <label>巡检进度 <progress max={EQUIPMENT_INSPECTION_SECONDS} value={state.inspection.elapsed}/>{Math.floor(state.inspection.elapsed / EQUIPMENT_INSPECTION_SECONDS * 100)}%</label>}
        <p>已完成例行巡检 {state.inspections} 次</p>
      </>}
      <p>照明：{state.light === 'normal' ? '工作模式' : '休息模式'}</p>
    </>}
  </div>
}
