import type { CabinDevicePanel } from '../rendering/spacecraft/cabinEquipment'

export function cabinDeviceContent(panel:CabinDevicePanel,state:{pilotReady:boolean;doorLabel:string;speed?:number}){
 const rows:{label:string;value:string}[]=[]
 if(panel.kind==='console'){
  rows.push({label:'驾驶控制',value:state.pilotReady?'已接管':'靠近驾驶座按 F 入座'},
   {label:'舱外密封门',value:state.doorLabel})
  if(state.speed!==undefined)rows.push({label:'当前速度',value:`${state.speed.toFixed(2)} m/s`})
 }else if(panel.kind==='storage')rows.push({label:'物品登记',value:'暂无已登记物品'})
 else if(panel.kind==='locker')rows.push({label:'装备查看',value:'头盔 · 手套 · 背包'})
 else if(panel.kind==='workbench')rows.push({label:'维护任务',value:'暂无已登记任务'})
 rows.push({label:'查看记录',value:panel.checked?'已标记查看':'尚未标记'})
 return rows
}
