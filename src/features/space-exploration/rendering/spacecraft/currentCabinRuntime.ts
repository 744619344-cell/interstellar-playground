import { Group,Vector3,type Camera } from 'three'
import { CABIN_CREW,cabinDoorLabel,moveCabinCrew,stepCabinDoor,type CabinDoorState,type CabinMove } from '../../domain/cabinCrewMotion'
import { cabinProximity,dampCabin,horizontalDistance,smoothCabin,type CabinPrompt } from '../../domain/cabinProximity'
import { CabinCrewPose } from '../astronaut/cabinCrewPose'
import { CabinWalkSurface } from './cabinWalkSurface'
import { CurrentAftDoor } from './currentAftDoor'
import { cabinApproachPath } from './cabinApproach'
import { CabinDoorFinish } from './cabinDoorFinish'
import { CabinEquipment } from './cabinEquipment'
import { CabinBedRest,type CabinRestState } from './cabinBedRest'
import { CABIN_ANIMATION,cabinPressAmount,motionStage } from '../../domain/cabinMotionProfile'
import type { Vec3 } from '../../domain/vec3'

export type CabinHandAction='door'|'wave'|'curl'|'relax'|'inspect'
export interface CabinSavedState {
 position:Vec3;heading:number;door:CabinDoorState;seated:boolean;everWalked:boolean;curl:boolean
 seatProgress?:number;seatTarget?:0|1;seatIndex?:number;seatDock?:Vec3
 rest?:CabinRestState;equipmentChecked?:string[]
}
const plain=(v:Vector3):Vec3=>({x:v.x,y:v.y,z:v.z})
const angleDelta=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b))

/** Controls source bones and CPU queries; the assembly remains the loaded-asset owner. */
export class CurrentCabinRuntime {
 private actor:Group
 private pose:CabinCrewPose
 private surface:CabinWalkSurface
 private door:CurrentAftDoor
 private finish:CabinDoorFinish
 private equipment:CabinEquipment
 private rest:CabinBedRest
 private original:{position:Vector3;rotation:number}
 private feet:Vec3={x:0,y:-1.54,z:-3.2}
 private spawn:Vec3
 private seats:Vec3[]=[]
 private seatIndex=0
 private seatDock:Vec3
 private seatProgress=1
 private seatTarget:0|1=1
 private active=false
 private seatView=false
 private running=false
 private everWalked=false
 private heading=0
 private aim=0
 private velocity={x:0,z:0}
 private strength=0
 private phase=0
 private time=0
 private curl=false
 private curlAmount=0
 private waveTime?:number
 private pressTime?:number
 private touched=false
 private route?:Vec3[]
 private pending?:'door'|'seat'|'bed'
 private pendingBed?:string
 private blocked=false
 private notice='靠近床铺、设备、驾驶座或舱门时按 F 交互'
 private nudge={forward:0,right:0,seconds:0}
 private motion:CabinDoorState={progress:0,target:0,blocked:false}
 private soleY=-1.54
 private context?:CabinPrompt
 private restCameraBlend=0
 private restCameraFocus=new Vector3()

 constructor(private model:Group,saved?:CabinSavedState){
  const actor=model.getObjectByName('ExistingAstronautInPilotSeat')
  if(!(actor instanceof Group)||!actor.children[0])throw new Error('Missing existing cabin crew')
  this.actor=actor;this.original={position:actor.position.clone(),rotation:actor.rotation.y}
  this.pose=new CabinCrewPose(actor.children[0] as Group,model);this.pose.seat()
  if(saved)this.motion={...saved.door}
  this.finish=new CabinDoorFinish(model);this.door=new CurrentAftDoor(model);this.door.apply(this.motion,0)
  this.surface=new CabinWalkSurface(model,()=>this.door.bounds(this.motion.progress),
   (feet,radius,height)=>this.door.intersects(this.motion.progress,feet,radius,height),ray=>this.door.rayDistance(this.motion.progress,ray))
  this.equipment=new CabinEquipment(model,(x,z)=>this.surface.support(x,z));this.rest=new CabinBedRest(this.actor,this.pose)
  let found=false
  for(const z of [-3.2,-2.8,-2.4,.4,1.2,4.8]){const y=this.surface.support(0,z);if(y!==undefined){this.feet={x:0,y,z};found=true;break}}
  if(!found)throw new Error('No supported standing location in the actual cabin')
  this.spawn={...this.feet};this.seatDock={...this.feet}
  for(const name of ['reused-seat--1','reused-seat-1']){
   const chair=model.getObjectByName(name)
   if(chair){const p=model.worldToLocal(chair.getWorldPosition(new Vector3()));this.seats.push({x:p.x,y:this.original.position.y,z:this.original.position.z})}
  }
  if(!this.seats.length)this.seats.push(plain(this.original.position))
  if(saved)this.restore(saved)
 }
 private restore(saved:CabinSavedState){
  const y=this.surface.support(saved.position.x,saved.position.z)
  if(y!==undefined)this.feet={...saved.position,y}
  this.heading=saved.heading;this.aim=this.heading;this.curl=saved.curl;this.curlAmount=Number(saved.curl);this.everWalked=saved.everWalked
  this.seatProgress=saved.seatProgress??(saved.seated?1:0);this.seatTarget=saved.seatTarget??(saved.seated?1:0)
  this.seatIndex=Math.min(this.seats.length-1,saved.seatIndex??0);this.seatDock=saved.seatDock??{...this.spawn}
  if(this.seatProgress>0||this.seatTarget===1)this.advanceSeat(0)
  else {
   this.actor.position.set(this.feet.x,this.feet.y,this.feet.z);this.actor.rotation.y=Math.PI/2+this.heading
   this.pose.walk(0,0,this.curlAmount);this.soleY=this.pose.samples.ground(this.feet.y,this.actor).minimumSoleY
  }
  this.equipment.restoreChecked(saved.equipmentChecked??[])
  const bed=this.equipment.get(saved.rest?.deviceId)
  if(bed&&saved.rest&&this.rest.begin(bed,saved.rest.dock,saved.rest.heading,saved.rest)){this.seatProgress=this.seatTarget=0;this.rest.step(0,this.curlAmount);this.pose.samples.update();this.restCameraBlend=1;this.restCameraFocus.copy(this.rest.focus())}
 }
 setMode(walking:boolean,seatedView:boolean){
  if(this.active&&!walking&&!(seatedView&&this.pending==='seat'))this.cancel()
  if(walking&&!this.active&&this.seatTarget===1)this.requestSeat(false)
  this.active=walking;this.seatView=seatedView;this.actor.visible=true
  if(walking)this.everWalked=true
 }
 cancel(stand=false){this.pressTime=undefined;this.waveTime=undefined;this.route=undefined;this.pending=undefined;this.pendingBed=undefined;if(this.equipment.snapshot())this.notice='已结束查看';this.equipment.close();this.nudge.seconds=0;this.velocity={x:0,z:0};if(stand&&this.rest.active){this.rest.rise();this.notice='正在从床铺起身'}if(stand&&this.seatProgress>0&&this.seatProgress<1){this.seatTarget=0;this.notice='已取消坐下，正在起立'}this.door.apply(this.motion,0)}
 private nearestSeat(){if(horizontalDistance(this.feet,this.seatDock)<.35)return this.seatIndex;let index=0;for(let i=1;i<this.seats.length;i++)if(horizontalDistance(this.feet,this.seats[i])<horizontalDistance(this.feet,this.seats[index]))index=i;return index}
 private resolvePrompt():CabinPrompt|undefined {
  if(!this.running||!this.active&&!this.seatView)return undefined
  if(this.rest.active)return this.rest.prompt()
  if(this.pending||this.pressTime!==undefined||this.seatProgress!==this.seatTarget)return undefined
  const panel=this.equipment.snapshot(),device=this.equipment.get(panel?.id)
  if(device)return {id:device.kind,deviceId:device.id,title:device.title,verb:'结束查看',key:'F',distance:0,point:{...this.feet}}
  const prompt=cabinProximity(this.feet,plain(this.door.buttonPoint()),this.seats[this.nearestSeat()],this.motion.target===1,
   this.seatProgress===1&&this.seatTarget===1,this.running&&(this.active||this.seatView))
  if(this.seatProgress===1)return prompt
  if(prompt?.id==='seat'&&horizontalDistance(this.feet,this.seatDock)<.35)return prompt
  const clear=(point:Vec3)=>this.surface.lineClear(new Vector3(this.feet.x,this.feet.y+1.25,this.feet.z),new Vector3(point.x,point.y,point.z))
  const candidates=this.equipment.prompts(this.feet,clear)
  if(prompt&&(prompt.id!=='door'||clear(prompt.point)))candidates.push(prompt)
  return candidates.sort((a,b)=>a.distance-b.distance)[0]
 }
 interact():'cockpit'|'cabin'|undefined {
  if(!this.running)return
  if(this.rest.active){if(this.rest.resting){this.rest.rise();this.notice='正在从床铺起身'}return}
  if(this.pending||this.pressTime!==undefined||this.seatProgress>0&&this.seatProgress<1){this.notice='正在操作，请稍候或按 Esc 取消';return}
  const prompt=this.resolvePrompt()
  if(!prompt){this.notice='靠近床铺、设备、驾驶座或门旁按钮后按 F';return}
  if(prompt.id==='door'){this.action('door');return}
  if(prompt.deviceId){
   if(this.equipment.snapshot()){this.equipment.close();this.notice='已结束查看';return}
   const device=this.equipment.get(prompt.deviceId)!
   if(device.kind==='bed'){if(this.approach(device.dock,'bed'))this.pendingBed=device.id}
   else {this.equipment.open(device.id);this.notice=`正在查看${device.title} · F 或 Esc 结束`}
   return
  }
  const sit=this.seatProgress<1
  if(this.requestSeat(sit))return sit?'cockpit':'cabin'
 }
 requestSeat(sit:boolean){
  if(this.rest.active){if(!sit){this.rest.rise();return true}this.notice='请先从床铺起身';return false}
  if(!sit){this.cancel();this.seatTarget=0;this.notice='正在起立';return true}
  if(this.seatProgress===1)return true
  const index=this.nearestSeat()
  if(horizontalDistance(this.feet,this.seats[index])>1.75){this.notice='请靠近驾驶座，按 F 坐下';return false}
  const dock={...this.spawn,z:-4.45},y=this.surface.support(dock.x,dock.z)
  if(y===undefined)return false
  this.seatIndex=index
  return this.approach({...dock,y},'seat')
 }
 private approach(goal:Vec3,action:'door'|'seat'|'bed'){
  const route=cabinApproachPath(this.feet,goal,(x,z)=>this.surface.support(x,z))
  if(!route){this.notice='通道受阻，请稍退一步再交互';return false}
  this.cancel();this.route=route;this.pending=action;this.notice=action==='door'?'正在靠近门控按钮 · 移动可取消':action==='bed'?'正在走向床边 · 移动可取消':'正在对齐驾驶座 · 移动可取消';return true
 }
 action(action:CabinHandAction){
  if(this.rest.active){this.notice='按 F 从床铺起身后再操作';return false}
  if(!this.active||!this.running||this.seatProgress>0){this.notice='请先起立并进入舱内行动';return false}
  if(action==='inspect'){this.equipment.inspect();this.notice='已记录本次查看';return true}
  if(action==='curl'||action==='relax'){this.curl=action==='curl';this.notice=this.curl?'手指轻屈':'手掌展开';return true}
  if(this.pending||this.pressTime!==undefined){this.notice='正在操作 · 移动或 Esc 可取消';return false}
  if(action==='wave'){
   if(this.surface.support(this.feet.x,this.feet.z,.62)===undefined){this.notice='请到较空的过道挥手';return false}
   this.waveTime=0;this.notice='正在挥手';return true
  }
  const button=this.door.buttonPoint()
  if(horizontalDistance(this.feet,button)>1.45||!this.surface.lineClear(new Vector3(this.feet.x,this.feet.y+1.25,this.feet.z),button)){
   this.notice='靠近门旁按钮后按 F';return false
  }
  return this.approach({...plain(this.door.standPoint()),y:this.feet.y},'door')
 }
 nudgeMove(forward:number,right:number){if(this.active&&!this.rest.active)this.nudge={forward,right,seconds:.24}}
 hitButton(camera:Camera,x:number,y:number,width:number,height:number){
  if(!this.active||!this.door.hit(camera,x,y,width,height))return false
  this.action('door');return true
 }
 private inputVelocity(input:CabinMove,yaw:number,dt:number){
  let move=input
  if((move.forward||move.right)&&this.equipment.snapshot()){this.equipment.close();this.notice='已离开设备'}
  if(!input.forward&&!input.right&&this.nudge.seconds>0){move=this.nudge;this.nudge.seconds=Math.max(0,this.nudge.seconds-dt)}
  if((move.forward||move.right)&&(this.pending||this.pressTime!==undefined||this.waveTime!==undefined)){this.cancel();this.notice='已取消操作'}
  const length=Math.max(1,Math.hypot(move.forward,move.right))
  let x=(-Math.sin(yaw)*move.forward+Math.cos(yaw)*move.right)/length,z=(-Math.cos(yaw)*move.forward-Math.sin(yaw)*move.right)/length
  if(this.route?.length){
   const next=this.route[0],distance=horizontalDistance(this.feet,next)
   if(distance<.025)this.route.shift()
   else {const speed=Math.min(1,distance/Math.max(.001,CABIN_CREW.speed*dt));x=(next.x-this.feet.x)/distance*speed;z=(next.z-this.feet.z)/distance*speed}
  }
  if(this.pressTime!==undefined||this.waveTime!==undefined||this.pending&&!this.route?.length)x=z=0
  if(x||z){this.aim=Math.atan2(-x,-z);const alignment=Math.max(0,Math.cos(angleDelta(this.aim,this.heading)));x*=alignment;z*=alignment}
  this.velocity.x=dampCabin(this.velocity.x,x,dt,x||z?9:16);this.velocity.z=dampCabin(this.velocity.z,z,dt,x||z?9:16)
 }
 private advanceBody(input:CabinMove,yaw:number,dt:number){
  this.inputVelocity(input,yaw,dt)
  const result=moveCabinCrew(this.feet,{forward:-this.velocity.z,right:this.velocity.x},0,dt,(x,z)=>this.surface.support(x,z))
  this.feet=result.position;this.blocked=result.blocked;this.phase+=result.distance*Math.PI*2/.62
  const speed=dt>0?Math.min(1,result.distance/dt/CABIN_CREW.speed):0
  this.strength=dampCabin(this.strength,speed,dt,12)
  this.advanceApproach()
  const error=angleDelta(this.aim,this.heading),turn=Math.sign(error)*Math.min(Math.abs(error),CABIN_ANIMATION.turnRate*dt)
  this.heading+=turn
  this.actor.position.set(this.feet.x,this.feet.y,this.feet.z);this.actor.rotation.y=Math.PI/2+this.heading
  this.pose.walk(this.phase,this.strength,this.curlAmount,this.time,dt>0?turn/dt/CABIN_ANIMATION.turnRate:0)
 }
 private advanceApproach(){
  if(!this.pending||this.route?.length)return
  if(this.pending==='door'){
   this.aim=this.door.facingAngle()
   if(Math.abs(angleDelta(this.aim,this.heading))<.05){this.pending=undefined;this.pressTime=0;this.touched=false;this.notice='正在按门控按钮'}
  }else if(this.pending==='bed'){
   this.aim=-Math.PI/2
   if(Math.abs(angleDelta(this.aim,this.heading))<.05){
    const bed=this.equipment.get(this.pendingBed);this.pending=undefined;this.pendingBed=undefined
    this.notice=bed&&this.rest.begin(bed,this.feet,this.heading)?'正在躺下休息':'床位暂不可用，请换一个位置'
   }
  }else{
   this.aim=0
   if(Math.abs(angleDelta(0,this.heading))<.05){this.pending=undefined;this.seatDock={...this.feet};this.seatTarget=1;this.notice='正在坐下'}
  }
 }
 private advanceSeat(dt:number){
  this.seatProgress+=Math.sign(this.seatTarget-this.seatProgress)*Math.min(Math.abs(this.seatTarget-this.seatProgress),dt/CABIN_ANIMATION.seat)
  const blend=motionStage(this.seatProgress,.06,.94),seat=this.seats[this.seatIndex]
  this.actor.position.set(this.seatDock.x+(seat.x-this.seatDock.x)*blend,this.seatDock.y+(seat.y-this.seatDock.y)*blend,this.seatDock.z+(seat.z-this.seatDock.z)*blend)
  this.actor.rotation.set(0,Math.PI/2,0);this.pose.seating(this.seatProgress,this.curlAmount,this.time)
  if(!this.seatProgress){this.feet={...this.seatDock};this.heading=this.aim=0;this.notice='已起立 · WASD 移动'}
  else if(this.seatProgress===1&&this.seatTarget===1)this.notice='已入座 · F 起立'
 }
 private advanceHand(dt:number){
  let pressed=0,reachable=false
  if(this.waveTime!==undefined){this.waveTime+=dt;this.pose.wave(this.waveTime,this.curlAmount);if(this.waveTime>CABIN_ANIMATION.wave){this.waveTime=undefined;this.notice='挥手完成'}}
  if(this.pressTime!==undefined){
   this.pressTime+=dt;pressed=cabinPressAmount(this.pressTime)
   reachable=this.pose.press(this.model.localToWorld(this.door.buttonPoint(pressed)),pressed,false).reachable
  }
  return {pressed,reachable}
 }
 private finishHand(pressed:number,reachable:boolean){
  if(this.pressTime===undefined)return
  const target=this.model.localToWorld(this.door.buttonPoint(pressed)),error=this.pose.samples.tip('R').distanceTo(target)
  if(!this.touched&&pressed>.98&&reachable&&error<.012){this.touched=true;this.motion={...this.motion,target:this.motion.target?0:1,blocked:false};this.notice=this.motion.target?'正在开启舱门':'正在关闭舱门'}
  if(this.pressTime>CABIN_ANIMATION.press){this.pressTime=undefined;if(!this.touched)this.notice='按钮操作未完成，请再按 F 重试'}
 }
 update(seconds:number,input:CabinMove,yaw:number,walking:boolean,seatedView:boolean,running:boolean){
  this.setMode(walking,seatedView);this.running=running
  if(!running)this.cancel()
  const dt=running&&Number.isFinite(seconds)&&seconds>0?Math.min(seconds,.05):0
  if(dt>0&&(input.forward||input.right)&&this.rest.busy)this.cancel(true)
  if(dt>0&&(input.forward||input.right)&&this.seatProgress>0&&this.seatProgress<1&&this.seatTarget)this.cancel(true)
  this.time+=dt;this.curlAmount=dampCabin(this.curlAmount,Number(this.curl),dt,14);this.pose.beginFrame()
  if(this.rest.active){const exit=this.rest.step(dt,this.curlAmount);if(exit){this.feet=exit.position;this.heading=this.aim=exit.heading;this.notice='已起身 · WASD 移动'}else this.notice=this.rest.resting?`${this.rest.title} · 休息中 · F 起身`:this.rest.snapshot()?.posture==='rising'?'正在从床铺起身':'正在躺下休息'}
  else if(this.seatProgress>0||this.seatTarget===1)this.advanceSeat(dt)
  else this.advanceBody(this.active&&dt>0?input:{forward:0,right:0},yaw,dt)
  const hand=this.seatProgress===0?this.advanceHand(dt):{pressed:0,reachable:false}
  this.pose.finishFrame(dt,this.pressTime!==undefined?22:16)
  if(this.seatProgress===0&&!this.rest.active&&this.pressTime===undefined&&this.waveTime===undefined)this.pose.plantFeet(this.phase,this.strength,this.heading)
  else this.pose.clearFeet()
  this.soleY=this.seatProgress===0&&!this.rest.active?this.pose.samples.ground(this.feet.y,this.actor).minimumSoleY:this.pose.samples.minimumY()
  this.restCameraBlend=dampCabin(this.restCameraBlend,Number(this.rest.active),dt,5)
  if(this.rest.active)this.restCameraFocus.copy(this.rest.focus())
  this.finishHand(hand.pressed,hand.reachable)
  const next=stepCabinDoor(this.motion,dt,running,(a,b)=>this.seatProgress===0&&this.door.blocks(a,b,this.feet,CABIN_CREW.radius,CABIN_CREW.height))
  if(next.blocked&&!this.motion.blocked)this.notice=this.motion.target?'开门范围有人，请先让开':'门口有人，已自动重新开启'
  else if(next.progress===next.target&&next.progress!==this.motion.progress&&!this.pending&&this.waveTime===undefined)
   this.notice=this.motion.blocked?'已避让，舱门重新开启':next.target?'舱门已开启':'舱门已关闭'
  this.motion=next;this.door.apply(this.motion,hand.pressed);this.context=this.resolvePrompt();return this.snapshot()
 }
 camera(yaw:number,pitch:number){
  if(!this.active&&!this.seatView){this.actor.visible=true;return undefined}
  const target=this.actor.position.clone().add(new Vector3(0,1.15,0)).lerp(this.restCameraFocus,this.restCameraBlend),angle=Math.max(-.3,Math.min(.9,pitch))
  const wanted=target.clone().add(new Vector3(Math.sin(yaw)*2.25*Math.cos(angle),.55+.8*this.restCameraBlend+Math.sin(angle)*.75,Math.cos(yaw)*2.25*Math.cos(angle)))
  const position=this.surface.cameraEye(target,wanted,this.rest.snapshot()?.deviceId),firstPerson=this.seatView?smoothCabin((this.seatProgress-.55)/.45):0
  if(firstPerson){
   const head=this.model.worldToLocal(this.pose.head()).add(new Vector3(0,.015,-.08))
   const direction=new Vector3(-Math.sin(yaw)*Math.cos(pitch-.22),Math.sin(pitch-.22),-Math.cos(yaw)*Math.cos(pitch-.22))
   position.lerp(head,firstPerson);target.lerp(head.add(direction),firstPerson)
  }
  this.actor.visible=this.rest.active||firstPerson<.75&&position.distanceTo(target)>.65&&!(this.active&&this.seatTarget===0&&this.seatProgress>.65)
  return {position:plain(position),target:plain(target),feet:{...this.feet},blocked:this.blocked}
 }
 snapshot(){
  const resting=this.rest.snapshot(),posture=resting?.posture??(this.seatTarget===1&&this.seatProgress<1?'sitting-down':this.seatTarget===0&&this.seatProgress>0?'standing-up':this.seatProgress===1?'seated':'standing')
  const busy=!!this.pending||this.pressTime!==undefined||this.seatProgress!==this.seatTarget||this.rest.busy
  return {active:this.active,seated:this.seatProgress===1&&this.seatTarget===1,pilotReady:this.seatProgress===1&&this.seatTarget===1,posture,seatProgress:this.seatProgress,position:{...this.feet},heading:this.heading,blocked:this.blocked,
   action:resting?posture==='lying'?'休息中':posture==='rising'?'起身':'躺下':this.pending?'对位中':this.pressTime!==undefined?'按按钮':this.waveTime!==undefined?'挥手':posture==='sitting-down'?'坐下':posture==='standing-up'?'起立':this.curl?'屈指':this.seatProgress===1?'已入座':'站立',
   resting,devicePanel:this.equipment.snapshot(),
   prompt:busy?undefined:this.context,busy,
   door:{...this.motion},doorLabel:cabinDoorLabel(this.motion),notice:this.notice,minimumSoleY:this.soleY,buttonPosition:plain(this.door.buttonPoint()),rigPrototype:true}
 }
 save():CabinSavedState{return {position:{...this.feet},heading:this.heading,door:{...this.motion},seated:this.seatProgress===1,everWalked:this.everWalked,curl:this.curl,seatProgress:this.seatProgress,seatTarget:this.seatTarget,seatIndex:this.seatIndex,seatDock:{...this.seatDock},rest:this.rest.save(),equipmentChecked:this.equipment.save()}}
 reset(){this.cancel();this.rest.clear();this.restCameraBlend=0;this.motion={progress:0,target:0,blocked:false};this.feet={...this.spawn};this.seatDock={...this.spawn};this.heading=this.aim=this.phase=0;this.curl=false;this.everWalked=false;this.seatProgress=1;this.seatTarget=1;this.seatIndex=0;this.active=false;this.pose.seat();this.actor.position.copy(this.original.position);this.actor.rotation.set(0,this.original.rotation,0);this.door.apply(this.motion,0)}
 dispose(){this.cancel();this.rest.clear();this.pose.dispose();this.actor.position.copy(this.original.position);this.actor.rotation.set(0,this.original.rotation,0);this.actor.visible=true;this.surface.dispose();this.door.dispose();this.finish.dispose()}
}

