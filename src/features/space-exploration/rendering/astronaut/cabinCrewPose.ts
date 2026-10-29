import { Bone, Quaternion, Vector3, type Group } from 'three'
import { CabinRigSamples } from './cabinRigSamples'
import { CabinFootPlant } from './cabinFootPlant'
import { cabinGait,cabinRestStages,motionStage } from '../../domain/cabinMotionProfile'

type Side='L'|'R'

/** Pose-only adapter for this existing +X-forward rig; does not change binds, weights or geometry. */
export class CabinCrewPose {
  readonly samples:CabinRigSamples
  private bones=new Map<string,Bone>()
  private original:{bone:Bone;position:Vector3;rotation:Quaternion}[]=[]
  private root:Bone
  private previous:{bone:Bone;position:Vector3;rotation:Quaternion}[]=[]
  private blend:{bone:Bone;position:Vector3;rotation:Quaternion}[]=[]
  private feet:CabinFootPlant
  constructor(readonly model:Group,private host:Group) {
    model.traverse(o=>{if(o instanceof Bone){this.bones.set(o.name,o);this.original.push({bone:o,position:o.position.clone(),rotation:o.quaternion.clone()})}})
    for(const name of ['root','upper_arm_R','forearm_R','hand_R','thigh_L','thigh_R','shin_L','shin_R'])if(!this.bones.has(name))throw new Error(`Missing crew joint ${name}`)
    this.root=this.bones.get('root')!;this.rest();this.samples=new CabinRigSamples(model,host)
    this.previous=this.original.map(v=>({bone:v.bone,position:v.bone.position.clone(),rotation:v.bone.quaternion.clone()}))
    this.blend=this.original.map(v=>({bone:v.bone,position:v.bone.position.clone(),rotation:v.bone.quaternion.clone()}))
    this.feet=new CabinFootPlant(model,host,this.bones)
  }
  beginFrame(){for(const v of this.previous){v.position.copy(v.bone.position);v.rotation.copy(v.bone.quaternion)}}
  finishFrame(seconds:number,rate=16){
    const alpha=1-Math.exp(-Math.max(0,seconds)*rate)
    for(const v of this.previous){v.bone.position.copy(v.position.lerp(v.bone.position,alpha));v.bone.quaternion.copy(v.rotation.slerp(v.bone.quaternion,alpha))}
    this.samples.update()
  }
  private rest() {for(const bone of this.bones.values())bone.quaternion.identity();this.root.position.y=0}
  idle(curl:boolean|number=false) {
    this.rest()
    for(const [side,sign]of [['L',1],['R',-1]] as const){
      this.bones.get(`upper_arm_${side}`)!.rotation.x=sign*1.35
      this.bones.get(`forearm_${side}`)!.rotation.y=sign*.15
      for(const [name,base,amount]of [['index',.025,.19],['middle',.045,.25],['ring',.055,.29],['pinky',.065,.32]] as const){const joint=this.bones.get(`${name}_${side}`);if(joint)joint.rotation.x=sign*(base+Number(curl)*amount)}
      const thumb=this.bones.get(`thumb_${side}`);if(thumb)thumb.rotation.y=sign*(.06+Number(curl)*.1)
    }
  }
  walk(phase:number,strength:number,curl:boolean|number,time=0,turn=0) {
    this.idle(curl)
    for(const [side,sign]of [['L',1],['R',-1]] as const){
      const gait=cabinGait(phase,side),hip=this.bones.get(`thigh_${side}`)!,shin=this.bones.get(`shin_${side}`)!
      const pivot=Math.abs(turn)*(1-strength)*Math.sin(time*8+sign*Math.PI/2)
      hip.rotation.z=gait.hip*strength+.035*pivot;shin.rotation.z=gait.knee*strength-.08*Math.max(0,pivot)
      const foot=this.bones.get(`foot_${side}`);if(foot)foot.rotation.z=-.65*(hip.rotation.z+shin.rotation.z)+.07*gait.lift*strength
      this.bones.get(`upper_arm_${side}`)!.rotation.y=.18*Math.sin(phase)*strength
      this.bones.get(`forearm_${side}`)!.rotation.y+=sign*.07*Math.max(0,sign*Math.sin(phase))*strength
    }
    this.root.rotation.x=.018*Math.sin(phase)*strength;this.root.position.y=-.01*strength*(1+Math.cos(phase*2))
    this.bones.get('chest')!.rotation.z=.006*Math.sin(time*2.2)-.025*strength
    this.bones.get('chest')!.rotation.y=-.025*Math.sin(phase)*strength-.035*turn
  }
  wave(seconds:number,curl:boolean|number) {
    const envelope=motionStage(seconds,0,.5)*(1-motionStage(seconds,1.5,2.05))
    this.idle(curl);this.bones.get('upper_arm_R')!.rotation.x=-1.35+2.15*envelope
    this.bones.get('forearm_R')!.rotation.y=-.15-.65*envelope
    this.bones.get('hand_R')!.rotation.x=Math.sin((seconds-.5)*9)*.2*envelope*motionStage(seconds,.3,.6)
    this.bones.get('chest')!.rotation.y=-.035*envelope
  }
  sitting(amount:number,curl:boolean|number=false){
    this.idle(curl)
    for(const v of this.original){v.bone.position.lerp(v.position,amount);v.bone.quaternion.slerp(v.rotation,amount)}
  }
  private mixTo(build:()=>void,amount:number){
    for(const v of this.blend){v.position.copy(v.bone.position);v.rotation.copy(v.bone.quaternion)}
    build()
    for(const v of this.blend){v.bone.position.copy(v.position.lerp(v.bone.position,amount));v.bone.quaternion.copy(v.rotation.slerp(v.bone.quaternion,amount))}
  }
  seating(progress:number,curl:number,time=0){
    this.sitting(motionStage(progress,.06,.94),curl)
    const hinge=Math.sin(Math.PI*progress)
    this.bones.get('chest')!.rotation.z-=.19*hinge;this.bones.get('head')!.rotation.z+=.045*hinge
    this.bones.get('chest')!.rotation.x+=.003*Math.sin(time*2.2)*progress
  }
  lying(curl:number=0){
    this.idle(curl)
    for(const side of ['L','R']){this.bones.get(`thigh_${side}`)!.rotation.z=.3;this.bones.get(`shin_${side}`)!.rotation.z=-1.02;this.bones.get(`foot_${side}`)!.rotation.z=-Math.PI/2+.72}
    this.bones.get('chest')!.rotation.z=-.035
  }
  bed(progress:number,curl:number){
    const stage=cabinRestStages(progress);this.sitting(stage.sit,curl)
    this.mixTo(()=>this.lying(curl),stage.recline)
    this.bones.get('chest')!.rotation.z-=.10*Math.sin(Math.PI*progress)
  }
  hips(){this.model.updateWorldMatrix(true,true);return this.host.worldToLocal(this.bones.get('thigh_L')!.getWorldPosition(new Vector3()).add(this.bones.get('thigh_R')!.getWorldPosition(new Vector3())).multiplyScalar(.5))}
  plantFeet(phase:number,strength:number,heading:number){this.feet.apply(phase,strength,heading);this.samples.update()}
  clearFeet(){this.feet.clear()}
  head(){this.samples.update();return (this.bones.get('head')??this.bones.get('chest')!).getWorldPosition(new Vector3())}
  shoulder(side:Side) {this.model.updateWorldMatrix(true,true);return this.bones.get(`upper_arm_${side}`)!.getWorldPosition(new Vector3())}
  private solveArm(target:Vector3,side:Side) {
    const upper=this.bones.get(`upper_arm_${side}`)!,fore=this.bones.get(`forearm_${side}`)!,hand=this.bones.get(`hand_${side}`)!
    this.model.updateWorldMatrix(true,true)
    const a=upper.getWorldPosition(new Vector3()),b=fore.getWorldPosition(new Vector3()),c=hand.getWorldPosition(new Vector3())
    const l1=a.distanceTo(b),l2=b.distanceTo(c),direction=target.clone().sub(a),d=direction.length()
    if(d>l1+l2-.003||d<Math.abs(l1-l2)+.003)return false
    direction.divideScalar(d)
    const oldBend=b.clone().sub(a),pole=oldBend.addScaledVector(direction,-oldBend.dot(direction))
    if(pole.lengthSq()<1e-7){pole.set(0,-1,0).transformDirection(this.host.matrixWorld);pole.addScaledVector(direction,-pole.dot(direction))}
    pole.normalize();const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along))
    const elbow=a.clone().addScaledVector(direction,along).addScaledVector(pole,height)
    const upperDirection=upper.parent!.worldToLocal(elbow.clone()).sub(upper.position).normalize()
    upper.quaternion.setFromUnitVectors(fore.position.clone().normalize(),upperDirection)
    this.model.updateWorldMatrix(true,true)
    const foreDirection=fore.parent!.worldToLocal(target.clone()).sub(fore.position).normalize()
    fore.quaternion.setFromUnitVectors(hand.position.clone().normalize(),foreDirection)
    this.model.updateWorldMatrix(true,true);return true
  }
  press(targetWorld:Vector3,amount:number,curl:boolean) {
    this.idle(curl)
    this.bones.get('chest')!.rotation.z=-.035*amount;this.bones.get('index_R')!.rotation.x=0
    const upper=this.bones.get('upper_arm_R')!,fore=this.bones.get('forearm_R')!,hand=this.bones.get('hand_R')!
    const baseU=upper.quaternion.clone(),baseF=fore.quaternion.clone(),baseH=hand.quaternion.clone()
    this.samples.update()
    const wrist=hand.getWorldPosition(new Vector3()),reach=this.samples.tip('R').distanceTo(wrist)
    const direction=targetWorld.clone().sub(this.shoulder('R')).normalize()
    let reachable=this.solveArm(targetWorld.clone().addScaledVector(direction,-reach),'R')
    for(let i=0;i<8&&reachable;i++){
      this.samples.update();const wrist=hand.getWorldPosition(new Vector3())
      const localTip=hand.worldToLocal(this.samples.tip('R')).normalize()
      const localAim=hand.parent!.worldToLocal(targetWorld.clone()).sub(hand.position).normalize()
      hand.quaternion.setFromUnitVectors(localTip,localAim)
      this.samples.update()
      const tipOffset=this.samples.tip('R').sub(wrist)
      if(!this.solveArm(targetWorld.clone().sub(tipOffset),'R')){reachable=false;break}
    }
    const solvedU=upper.quaternion.clone(),solvedF=fore.quaternion.clone(),solvedH=hand.quaternion.clone()
    upper.quaternion.copy(baseU).slerp(solvedU,amount);fore.quaternion.copy(baseF).slerp(solvedF,amount)
    hand.quaternion.copy(baseH).slerp(solvedH,amount)
    this.samples.update();return {reachable,error:this.samples.tip('R').distanceTo(targetWorld)}
  }
  seat() {for(const source of this.original){source.bone.position.copy(source.position);source.bone.quaternion.copy(source.rotation)};this.samples?.update()}
  dispose() {this.seat();this.feet.clear();this.bones.clear();this.original=[];this.previous=[];this.blend=[]}
}
