import type { Vec3 } from './vec3'

export type CabinTargetId='door'|'seat'|'bed'|'storage'|'locker'|'workbench'|'console'|'grip'
export interface CabinPrompt {id:CabinTargetId;deviceId?:string;title:string;verb:string;key:'F';distance:number;point:Vec3}
export const horizontalDistance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.z-b.z)

/** Only existing usable equipment receives prompts; distance is measured in ship metres. */
export function cabinProximity(feet:Vec3,button:Vec3,seat:Vec3,doorOpen:boolean,seated:boolean,enabled:boolean):CabinPrompt|undefined {
 if(!enabled)return undefined
 if(seated)return {id:'seat',title:'驾驶座',verb:'起立',key:'F',distance:0,point:{...seat}}
 const candidates:CabinPrompt[]=[]
 const doorDistance=horizontalDistance(feet,button),seatDistance=horizontalDistance(feet,seat)
 if(doorDistance<=1.45)candidates.push({id:'door',title:'舱外密封门 · 门控按钮',verb:doorOpen?'关闭舱门':'开启舱门',key:'F',distance:doorDistance,point:{...button}})
 if(seatDistance<=1.75)candidates.push({id:'seat',title:'驾驶座',verb:'坐下驾驶',key:'F',distance:seatDistance,point:{...seat}})
 return candidates.sort((a,b)=>a.distance-b.distance)[0]
}

export const smoothCabin=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t)}
export const dampCabin=(current:number,target:number,dt:number,rate=12)=>current+(target-current)*(1-Math.exp(-Math.max(0,dt)*rate))
