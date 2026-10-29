import type { MicrogravityCabinRuntime } from '../rendering/spacecraft/microgravityCabinRuntime'
import type { ShipFlightAction } from '../rendering/spacecraft/shipFlightRuntime'
import { motionStudyActive } from '../domain/cabinMotionStudy'

export default function CabinEquipmentGrip({ cabin, paused, onAction }: {
  cabin: ReturnType<MicrogravityCabinRuntime['snapshot']>; paused: boolean; onAction: (action: ShipFlightAction) => void
}) {
  const id = cabin.devicePanel?.id
  if (!id || cabin.float.fixed) return null
  if (cabin.equipmentContext.held) return <small>已抓稳设备 · X 松手</small>
  const locked = paused || cabin.busy || !!cabin.equipment.inspection || motionStudyActive(cabin.equipment.study)
    || ['donning', 'doffing'].includes(cabin.eva.suit) || ['depressurizing', 'repressurizing'].includes(cabin.eva.pressure)
  return <div className='cabin-equipment-grip'>
    <button type='button' disabled={locked} onClick={() => onAction(`equipment:${id}:grip`)}>抓稳这台设备</button>
  </div>
}
