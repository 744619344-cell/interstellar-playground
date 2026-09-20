import { SYSTEM_BODIES, getSystemBody, isSystemBodyId } from '../domain/registry'
import { SHIP_ROUTE_IDS, SHIP_ROUTE_NAME, SHIP_ROUTE_PHASE_LABEL, shipRouteHint } from '../domain/shipRoute'
import type { SystemMapSnapshot } from '../rendering/solar-system/systemMapEngine'
import type { ShipPreviewAction } from '../rendering/spacecraft/shipCameraPreview'
import './ShipNavigationPanel.css'

type NavigationState = NonNullable<SystemMapSnapshot['cameraPreview']>['navigation']
const bodyName = (id: string) => isSystemBodyId(id) ? getSystemBody(id).displayName : '试验障碍'
export default function ShipNavigationPanel({ state, onAction }: {
  state: NavigationState; onAction: (action: ShipPreviewAction) => void
}) {
  const target = state.target
  const route = state.route
  const correction = !target ? '先选择目标' : target.angleDegrees < 3 ? '航向已对准'
    : `${Math.abs(target.yaw) > 0.05 ? target.yaw > 0 ? '向左转' : '向右转' : ''} ${Math.abs(target.pitch) > 0.05 ? target.pitch > 0 ? '抬头' : '低头' : ''}`
  return <section className='ship-navigation-panel' aria-label='航行导航'>
    <strong>航行导航</strong>
    <div className='ship-navigation-routes' role='group' aria-label='标杆航线'>
      {SHIP_ROUTE_IDS.map((id) => (
        <button type='button' key={id} className='ship-camera-button' aria-pressed={route?.id === id}
          onClick={() => onAction(`route:${id}`)}>{SHIP_ROUTE_NAME[id]}航线</button>
      ))}
    </div>
    <output className='ship-navigation-output' aria-label='航线阶段'>
      {route ? `${SHIP_ROUTE_NAME[route.id]} · ${SHIP_ROUTE_PHASE_LABEL[route.phase]}` : `未选择航线 · ${SHIP_ROUTE_PHASE_LABEL.idle}`}
    </output>
    <output className='ship-navigation-output' aria-label='航线提示'>{shipRouteHint(route)}</output>
    <label className='ship-navigation-label'>锁定目标
      <select className='ship-navigation-select' aria-label='锁定目标' value={state.targetId ?? ''}
        onChange={(event) => onAction(isSystemBodyId(event.target.value) ? `target:${event.target.value}` : 'clearTarget')}>
        <option value=''>未锁定</option>
        {SYSTEM_BODIES.map((body) => <option key={body.id} value={body.id}>{body.displayName}</option>)}
      </select>
    </label>
    <div className='ship-navigation-actions'>
      <button type='button' className='ship-camera-button' disabled={!state.targetId} aria-pressed={state.assist} onClick={() => onAction('assist')}>航向辅助</button>
      <button type='button' className='ship-camera-button' disabled={!state.targetId} onClick={() => onAction('clearTarget')}>取消锁定</button>
    </div>
    <output className='ship-navigation-output' aria-label='目标导航状态'>
      {target
        ? `${bodyName(target.id)} · 距离 ${target.distance.toFixed(1)} m · 净距 ${target.clearance.toFixed(1)} m · 偏角 ${target.angleDegrees.toFixed(1)}°`
        : '尚未锁定目标'}
    </output>
    <output className='ship-navigation-output' aria-label='航向修正'>{correction}</output>
    <output className='ship-navigation-output' aria-label='防撞状态'>
      {state.contact ? `保护介入 · ${bodyName(state.contact)}` : state.risk
        ? `自动制动 · ${bodyName(state.risk.id)} · 制动距离 ${state.risk.stoppingDistance.toFixed(1)} m` : '防撞保护就绪'}
    </output>
    <p className='ship-navigation-note'>航程需手动完成。辅助只修正船体朝向，不接管移动；空格会退出辅助并制动。W/S 前后、A/D 横移，方向随当前视线。抵达需停在安全净空并保持低相对速度。</p>
    <button type='button' className='ship-camera-button' aria-pressed={state.safetyObstacle} onClick={() => onAction('safety')}>前方防撞试验</button>
  </section>
}
