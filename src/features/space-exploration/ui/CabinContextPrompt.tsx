import type { SystemMapSnapshot } from '../rendering/solar-system/systemMapEngine'
import type { ShipFlightAction } from '../rendering/spacecraft/shipFlightRuntime'
import { isMicrogravityCabin } from '../rendering/spacecraft/microgravityCabinRuntime'
import CabinControlHint from './CabinControlHint'
import { useCabinNotice } from './useCabinMenu'
import { cabinMotionNotice } from './cabinHudInput'

type Flight=NonNullable<SystemMapSnapshot['shipFlight']>
export default function CabinContextPrompt({state,onAction,compact=false}:{state:Flight;onAction:(action:ShipFlightAction)=>void;compact?:boolean}){
 const cabin=state.model.cabin
 const notice=useCabinNotice(cabin?.notice ?? '')
 if(!cabin||state.suspended||!['cabin','cockpit'].includes(state.mode))return null
 const prompt=cabin.prompt
 const micro = isMicrogravityCabin(cabin)
 const visibleNotice = compact && micro ? cabinMotionNotice(cabin.notice, notice, cabin.blocked) : compact ? notice : cabin.notice
 const extras = compact && micro && !cabin.devicePanel && !cabin.busy ? cabin.evaControls.controls.filter(c=>c.enabled&&c.key&&c.key!=='F'&&c.key!=='R').slice(0,2) : []
 return <aside className={`cabin-context-hud${compact?' is-minimal':''}`} aria-label='附近设备交互'>
  {prompt&&(!compact||!cabin.busy&&!cabin.devicePanel)&&<button className='cabin-context-use' type='button' onClick={()=>onAction('interact')} aria-label={`${prompt.key} ${prompt.verb}`}>
   <kbd>{prompt.key}</kbd><span><strong>{prompt.verb}</strong><small>{prompt.title}{prompt.distance>0?` · ${prompt.distance.toFixed(1)} m`:''}</small></span>
  </button>}
  {cabin.busy&&<div className='cabin-context-busy'><span className='cabin-context-pulse'/><strong>{cabin.action}</strong><small>{cabin.posture==='reaching'?'Esc 取消伸手':['standing-up','rising'].includes(cabin.posture)?'完成后即可移动':'移动或 Esc 取消操作'}</small></div>}
  {visibleNotice&&<output className='cabin-context-notice' aria-live='polite'>{visibleNotice}</output>}
  {extras.length>0&&<div className='cabin-eva-shortcuts'>{extras.map(c=><button type='button' key={c.id} disabled={state.paused} onClick={()=>onAction(`eva:${c.id}`)}><kbd>{c.key}</kbd> {c.label}</button>)}</div>}
  {!compact&&micro&&<CabinControlHint cabin={cabin} paused={state.paused} onAction={onAction}/>}
  {!compact&&micro&&cabin.atSuitLocker&&<small>R {cabin.eva.suit==='ready'?'脱下宇航服并收纳':cabin.eva.suit==='stowed'?'穿戴宇航服':'穿脱进行中'}</small>}
 </aside>
}
