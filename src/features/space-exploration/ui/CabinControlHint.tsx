import type { MicrogravityCabinRuntime } from '../rendering/spacecraft/microgravityCabinRuntime'
import type { ShipFlightAction } from '../rendering/spacecraft/shipFlightRuntime'
import { motionStudyActive } from '../domain/cabinMotionStudy'

export default function CabinControlHint({ cabin, paused, onAction }: {
  cabin: ReturnType<MicrogravityCabinRuntime['snapshot']>; paused: boolean; onAction: (action: ShipFlightAction) => void
}) {
  if (cabin.eva.location === 'outside' || cabin.eva.tether) return <small className='cabin-context-controls'>系留推进 · 方向键选向 · Shift+方向键调姿态 · Q/E翻滚</small>
  const assisted = cabin.controlMode === 'assisted'
  const locked = cabin.busy || !!cabin.float.fixed || !!cabin.equipment.inspection || motionStudyActive(cabin.equipment.study)
    || ['donning', 'doffing'].includes(cabin.eva.suit) || ['depressurizing', 'repressurizing'].includes(cabin.eva.pressure)
  return <div className='cabin-context-controls'>
    <button type='button' disabled={paused || locked} onClick={() => onAction('cabinControls')}>
      {assisted ? '端游辅助 · M 切换真实惯性' : '真实惯性 · M 切换端游辅助'}
    </button>
    <small>{cabin.float.fixed ? '设备约束中，F 解除约束' : assisted ? 'WASD/方向键移动 · 右键拖拽环视 · 松键缓停' : '扶稳后方向键推离 · 空中保持惯性'}<br/>
      {assisted ? 'Space 上浮 · C 下潜 · Shift 加速 · F 操作' : 'Shift+方向键调姿态 · Space 推离 · X 抓握'}</small>
  </div>
}
