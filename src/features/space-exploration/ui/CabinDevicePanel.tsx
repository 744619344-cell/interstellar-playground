import type { SystemMapSnapshot } from '../rendering/solar-system/systemMapEngine'
import type { ShipFlightAction } from '../rendering/spacecraft/shipFlightRuntime'
import { cabinDeviceContent } from './cabinDeviceContent'
import { isMicrogravityCabin } from '../rendering/spacecraft/microgravityCabinRuntime'
import CabinEquipmentUsePanel from './CabinEquipmentUsePanel'
import CabinEquipmentGrip from './CabinEquipmentGrip'
import CabinEvaPanel from './CabinEvaPanel'

type Flight=NonNullable<SystemMapSnapshot['shipFlight']>
export default function CabinDevicePanel({state,onAction}:{state:Flight;onAction:(action:ShipFlightAction)=>void}){
 const cabin=state.model.cabin,panel=cabin?.devicePanel
 if(!cabin||!panel||state.suspended||state.mode!=='cabin')return null
 return <section className='cabin-device-panel' aria-label='设备操作面板'>
  <div className='cabin-device-heading'><strong>{panel.title}</strong><button type='button' onClick={()=>onAction('interact')} aria-label='结束查看设备'>关闭 · F</button></div>
  {!isMicrogravityCabin(cabin)&&<p>{panel.description}</p>}
  {isMicrogravityCabin(cabin)&&<CabinEquipmentGrip cabin={cabin} paused={state.paused} onAction={onAction}/>}
  {panel.kind==='locker'&&<CabinEvaPanel state={state} onAction={onAction} embedded/>}
  {isMicrogravityCabin(cabin)&&cabin.nearbyEquipment.length>1&&<nav aria-label='切换附近设备'>{cabin.nearbyEquipment.filter(e=>e.id!==panel.id).map(e=><button type='button' key={e.id} disabled={state.paused} onClick={()=>onAction(`equipment:${e.id}:open`)}>{e.title}</button>)}</nav>}
  <dl>{cabinDeviceContent(panel,{...cabin,speed:state.speed}).filter(row=>!isMicrogravityCabin(cabin)||!['物品登记','维护任务','查看记录','装备查看'].includes(row.label)).map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
  {isMicrogravityCabin(cabin)&&<CabinEquipmentUsePanel id={panel.id} state={cabin.equipment} context={cabin.equipmentContext} paused={state.paused} onAction={onAction}/>}
  {!isMicrogravityCabin(cabin)&&<button type='button' disabled={panel.checked} onClick={()=>onAction('inspect')}>{panel.checked?'已记录查看':'标记已查看'}</button>}
  {panel.kind==='console'&&<button type='button' onClick={()=>onAction('cockpit')}>坐下驾驶</button>}
  <small>F / Esc 退出 · I 检查</small>
 </section>
}
