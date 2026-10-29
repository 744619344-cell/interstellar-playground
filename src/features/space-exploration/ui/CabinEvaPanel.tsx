import type { SystemMapSnapshot } from '../rendering/solar-system/systemMapEngine'
import type { ShipFlightAction } from '../rendering/spacecraft/shipFlightRuntime'
import { isMicrogravityCabin } from '../rendering/spacecraft/microgravityCabinRuntime'

type Flight = NonNullable<SystemMapSnapshot['shipFlight']>
export default function CabinEvaPanel({ state, onAction, embedded = false }: { state: Flight; onAction: (action: ShipFlightAction) => void; embedded?: boolean }) {
  const cabin = state.model.cabin
  if (!isMicrogravityCabin(cabin) || state.suspended || state.mode !== 'cabin' || !cabin.evaControls.visible) return null
  if (!embedded && cabin.devicePanel?.kind === 'locker') return null
  const { stage, hint, pressure, controls } = cabin.evaControls, ready = cabin.eva.suit === 'ready'
  return <section className={`cabin-eva-panel${embedded ? ' is-embedded' : ''}`} aria-label='宇航服与舱外探索'>
    {!embedded&&<div className='cabin-eva-heading'><strong>{stage}</strong></div>}
    <p>{ready ? '宇航服已穿戴' : cabin.eva.suit === 'stowed' ? '舱内服' : '穿脱进行中'} · {pressure} · {cabin.eva.tether ? '安全绳已连接' : '尚未系留'}</p>
    <>
      {!embedded&&<p>{hint}</p>}
      <div className='cabin-eva-actions'>{controls.map((control, index) => <div key={control.id}>
        <button type='button' title={control.reason} disabled={!control.enabled || state.paused} onClick={() => onAction(`eva:${control.id}`)}>{control.label}{control.key && <kbd>{control.key}</kbd>}</button>
        {!control.enabled && !controls.slice(0,index).some(c=>!c.enabled&&c.reason===control.reason) && <small>{control.reason}</small>}
      </div>)}</div>
      {cabin.eva.tether && <p>安全绳 {cabin.tether.deployed.toFixed(1)} / {cabin.tether.lineLength.toFixed(1)} m · {cabin.tether.clear ? cabin.tether.taut ? '已拉紧' : '路径畅通' : '路径受阻'}</p>}
      {cabin.eva.location === 'outside' && <p>机动余量 {Math.round(cabin.tether.fuel * 100)}% · 减速与卷收为游戏辅助</p>}
      {!embedded&&<small>减压/复压采用游戏时长。门遇人物或安全绳会暂停，清空后继续。</small>}
    </>
  </section>
}
