import { Bone,Quaternion,Vector3,type Group } from 'three'
import { cabinGait } from '../../domain/cabinMotionProfile'

type Contact={point:Vector3;rotation:Quaternion;cycle:number;heading:number}
/** Keeps a stance ankle on the cabin floor in ship coordinates; reuses source leg joints. */
export class CabinFootPlant {
 private contacts:Partial<Record<'L'|'R',Contact>>={}
 constructor(private model:Group,private host:Group,private bones:Map<string,Bone>){}
 clear(){this.contacts={}}
 apply(phase:number,strength:number,heading:number){
  if(strength<.16){this.clear();return}
  this.model.updateWorldMatrix(true,true)
  for(const side of ['L','R'] as const){
   const gait=cabinGait(phase,side),foot=this.bones.get(`foot_${side}`)
   if(!foot||!gait.stance){delete this.contacts[side];continue}
   let contact=this.contacts[side]
   const turned=contact?Math.abs(Math.atan2(Math.sin(heading-contact.heading),Math.cos(heading-contact.heading))):0
   if(!contact||gait.cycle<contact.cycle||turned>.3){
    contact={point:this.host.worldToLocal(foot.getWorldPosition(new Vector3())),rotation:this.host.getWorldQuaternion(new Quaternion()).invert().multiply(foot.getWorldQuaternion(new Quaternion())),cycle:gait.cycle,heading};this.contacts[side]=contact
   }
   contact.cycle=gait.cycle
   if(this.solve(side,this.host.localToWorld(contact.point.clone()))){foot.quaternion.copy(foot.parent!.getWorldQuaternion(new Quaternion()).invert()).multiply(this.host.getWorldQuaternion(new Quaternion())).multiply(contact.rotation);this.model.updateWorldMatrix(true,true)}
  }
 }
 private solve(side:'L'|'R',target:Vector3){
  const hip=this.bones.get(`thigh_${side}`)!,shin=this.bones.get(`shin_${side}`)!,foot=this.bones.get(`foot_${side}`)!
  const a=hip.getWorldPosition(new Vector3()),b=shin.getWorldPosition(new Vector3()),c=foot.getWorldPosition(new Vector3())
  const l1=a.distanceTo(b),l2=b.distanceTo(c),reach=l1+l2-.008,horizontal=Math.hypot(target.x-a.x,target.z-a.z)
  if(horizontal>=reach)return false
  // Lock floor coordinates; let the ankle height follow leg reach before the suit sole correction.
  target.y=Math.max(target.y,a.y-Math.sqrt(reach*reach-horizontal*horizontal))
  const direction=target.clone().sub(a),d=direction.length()
  if(d>=l1+l2-.002||d<Math.abs(l1-l2)+.002)return false
  direction.divideScalar(d)
  const pole=b.clone().sub(a);pole.addScaledVector(direction,-pole.dot(direction))
  if(pole.lengthSq()<1e-7){pole.set(1,0,0).transformDirection(this.model.matrixWorld);pole.addScaledVector(direction,-pole.dot(direction))}
  pole.normalize();const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along))
  const knee=a.clone().addScaledVector(direction,along).addScaledVector(pole,height)
  hip.quaternion.setFromUnitVectors(shin.position.clone().normalize(),hip.parent!.worldToLocal(knee).sub(hip.position).normalize())
  this.model.updateWorldMatrix(true,true)
  shin.quaternion.setFromUnitVectors(foot.position.clone().normalize(),shin.parent!.worldToLocal(target.clone()).sub(shin.position).normalize())
  this.model.updateWorldMatrix(true,true)
  return true
 }
}
