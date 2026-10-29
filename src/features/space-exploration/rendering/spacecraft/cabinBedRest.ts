import { Quaternion,Vector3,type Group } from 'three'
import { CABIN_ANIMATION,cabinRestStages } from '../../domain/cabinMotionProfile'
import type { Vec3 } from '../../domain/vec3'
import type { CabinCrewPose } from '../astronaut/cabinCrewPose'
import type { CabinDevice } from './cabinEquipment'

export interface CabinRestState {deviceId:string;progress:number;target:0|1;dock:Vec3;heading:number}
const lying=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI/2)

/** Transforms the existing actor and source bones only; mattress and suit geometry are untouched. */
export class CabinBedRest {
 private state?:CabinRestState
 private bed?:CabinDevice
 private destination=new Vector3()
 private standing=new Quaternion()
 private startHips=new Vector3()
 private seatHips=new Vector3()
 private endHips=new Vector3()
 constructor(private actor:Group,private pose:CabinCrewPose){}
 get active(){return !!this.state}
 get busy(){return !!this.state&&this.state.progress!==this.state.target}
 get resting(){return this.state?.progress===1&&this.state.target===1}
 get title(){return this.bed?.title??'床铺'}
 begin(bed:CabinDevice,dock:Vec3,heading:number,saved?:CabinRestState){
  if(bed.surfaceY===undefined)return false
  const position=this.actor.position.clone(),rotation=this.actor.quaternion.clone()
  const startHips=this.pose.hips()
  this.pose.beginFrame();this.pose.lying();this.actor.position.set(0,0,0);this.actor.quaternion.copy(lying)
  const bounds=this.pose.samples.bounds(),size=bounds.getSize(new Vector3()),centre=bounds.getCenter(new Vector3())
  const endOffset=this.pose.hips()
  this.actor.position.copy(position);this.actor.quaternion.copy(rotation);this.pose.finishFrame(0)
  if(size.x>bed.box.max.x-bed.box.min.x||size.z>bed.box.max.z-bed.box.min.z)return false
  this.destination.set((bed.box.min.x+bed.box.max.x)/2-centre.x,bed.surfaceY+.018-bounds.min.y,(bed.box.min.z+bed.box.max.z)/2-centre.z)
  this.startHips.copy(startHips);this.seatHips.set(bed.box.max.x-.22,bed.surfaceY+.07,(bed.box.min.z+bed.box.max.z)/2);this.endHips.copy(this.destination).add(endOffset)
  this.bed=bed;this.state=saved?{...saved,dock:{...saved.dock}}:{deviceId:bed.id,progress:0,target:1,dock:{...dock},heading}
  this.standing.setFromAxisAngle(new Vector3(0,1,0),Math.PI/2+this.state.heading)
  return true
 }
 rise(){if(this.state)this.state.target=0}
 step(dt:number,curl:number){
  const s=this.state;if(!s)return undefined
  s.progress+=Math.sign(s.target-s.progress)*Math.min(Math.abs(s.target-s.progress),Math.max(0,dt)/CABIN_ANIMATION.bed)
  const stage=cabinRestStages(s.progress)
  this.pose.bed(s.progress,curl);this.actor.position.set(0,0,0);this.actor.quaternion.copy(this.standing).slerp(lying,stage.tilt)
  const offset=this.pose.hips(),hips=this.startHips.clone().lerp(this.seatHips,stage.sit).lerp(this.endHips,stage.recline)
  this.actor.position.copy(hips.sub(offset))
  if(s.progress===0&&s.target===0){const exit={position:{...s.dock},heading:s.heading};this.state=undefined;this.bed=undefined;return exit}
 }
 focus(){return this.actor.position.clone().add(new Vector3(0,.95,0).applyQuaternion(this.actor.quaternion))}
 prompt(){const s=this.state;return s&&this.resting?{id:'bed' as const,deviceId:s.deviceId,title:this.title,verb:'起身',key:'F' as const,distance:0,point:{...s.dock}}:undefined}
 snapshot(){const s=this.state;return s?{...s,dock:{...s.dock},title:this.title,posture:s.target===1?s.progress===1?'lying':'lying-down':'rising'}:undefined}
 save():CabinRestState|undefined {const s=this.state;return s?{...s,dock:{...s.dock}}:undefined}
 clear(){this.state=undefined;this.bed=undefined}
}
