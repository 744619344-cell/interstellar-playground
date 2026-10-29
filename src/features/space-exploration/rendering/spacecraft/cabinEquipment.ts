import { Box3,Matrix4,Mesh,Raycaster,Vector3,type Group,type Object3D } from 'three'
import { horizontalDistance,type CabinPrompt,type CabinTargetId } from '../../domain/cabinProximity'
import type { Vec3 } from '../../domain/vec3'

type Kind=Exclude<CabinTargetId,'door'|'seat'|'grip'>
export interface CabinDevice {id:string;kind:Kind;title:string;verb:string;box:Box3;dock:Vec3;surfaceY?:number}
export interface CabinDevicePanel {id:string;kind:Kind;title:string;description:string;checked:boolean}
const kinds:Record<string,[Kind,string,string]>={
 'folding-berth':['bed','床铺','躺下休息'],'storage-cabinet':['storage','储物柜','查看储物'],
 'dual-suit-locker':['locker','宇航服柜','查看装备'],'rear-workbench':['workbench','维护工作台','检查工作台'],
 'main-console':['console','主控台','查看仪表']
}
const descriptions:Record<Kind,string>={bed:'休息床位',storage:'舱内物品收纳',locker:'宇航服与随身装备收纳',workbench:'工具整理与设备维护工位',console:'航行仪表与驾驶状态'}
const plain=(p:Vector3):Vec3=>({x:p.x,y:p.y,z:p.z})

/** Reads original equipment only. Owns no Three.js buffers or replacement geometry. */
export class CabinEquipment {
 readonly devices:CabinDevice[]=[]
 private panel?:CabinDevice
 private checked=new Set<string>()
 constructor(model:Group,support:(x:number,z:number)=>number|undefined){
  model.updateMatrixWorld(true);const inverse=new Matrix4().copy(model.matrixWorld).invert(),counts=new Map<string,number>()
  model.traverse(o=>{
   if(o.userData.partType!=='furniture')return
   const source=String(o.userData.partSource??Object.keys(kinds).find(key=>o.name.startsWith(`reused-${key}-`))),definition=kinds[source]
   if(!definition)return
   const [kind,title,verb]=definition,box=new Box3()
   o.traverse(child=>{if(child instanceof Mesh){child.geometry.computeBoundingBox();box.union(child.geometry.boundingBox!.clone().applyMatrix4(inverse.clone().multiply(child.matrixWorld)))}})
   const centre=box.getCenter(new Vector3()),side=centre.x<0?1:-1,index=(counts.get(source)??0)+1;counts.set(source,index)
   const x=side>0?box.max.x+.58:box.min.x-.58,z=centre.z,y=support(x,z)
   const device:CabinDevice={id:o.name,kind,title:kind==='bed'?`${index} 号床铺`:kind==='console'?`${centre.x<0?'左':'右'}主控台`:title,verb,box,dock:{x,y:y??-1.54,z}}
   if(kind==='bed')device.surfaceY=this.mattress(model,o,box)
   this.devices.push(device)
  })
 }
 private mattress(model:Group,object:Object3D,box:Box3){
  const centre=box.getCenter(new Vector3()),heights:number[]=[],down=new Vector3(0,-1,0).transformDirection(model.matrixWorld)
  for(const fraction of [.2,.35,.5,.65,.8]){
   const origin=model.localToWorld(new Vector3(box.min.x+(box.max.x-box.min.x)*fraction,box.max.y+.5,centre.z))
   const hit=new Raycaster(origin,down).intersectObject(object,true)[0]
   if(hit)heights.push(model.worldToLocal(hit.point.clone()).y)
  }
  heights.sort((a,b)=>a-b);return heights.length?heights[Math.floor(heights.length/2)]:undefined
 }
 prompts(feet:Vec3,clear:(point:Vec3)=>boolean):CabinPrompt[]{
  const result:CabinPrompt[]=[]
  for(const device of this.devices){
   const point=device.box.clampPoint(new Vector3(feet.x,feet.y+1.1,feet.z),new Vector3())
   const away=new Vector3(feet.x-point.x,0,feet.z-point.z).normalize();point.addScaledVector(away,.06)
   const distance=horizontalDistance(feet,plain(point));if(distance>1.4||!clear(plain(point)))continue
   result.push({id:device.kind,deviceId:device.id,title:device.title,verb:device.verb,key:'F',distance,point:plain(point)})
  }
  return result
 }
 get(id?:string){return this.devices.find(d=>d.id===id)}
 open(id:string){this.panel=this.get(id);return !!this.panel}
 close(){this.panel=undefined}
 inspect(){if(this.panel)this.checked.add(this.panel.id)}
 restoreChecked(ids:readonly string[]){for(const id of ids)if(this.get(id))this.checked.add(id)}
 save(){return [...this.checked]}
 snapshot():CabinDevicePanel|undefined {const d=this.panel;return d?{id:d.id,kind:d.kind,title:d.title,description:descriptions[d.kind],checked:this.checked.has(d.id)}:undefined}
}
