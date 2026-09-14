import {AnimationMixer,LoopOnce} from 'three';

const clips=['OuterDoorOpen','OuterDoorClose','InnerDoorOpen','InnerDoorClose','ConsoleActive','ThrusterBurn'];
const duration=1.3;
export class MechanismPlayer {
 constructor(entries){
  this.entries=entries.map(({scene,animations})=>{
   const mixer=new AnimationMixer(scene),actions={};
   for(const name of clips){
    const clip=animations.find(c=>c.name===name);
    if(!clip)throw new Error(`Missing clip: ${name}`);
    if(/Door/.test(name)&&Math.abs(clip.duration-duration)>1e-3)throw new Error('Unexpected door duration');
    const action=mixer.clipAction(clip);action.setLoop(LoopOnce,1);action.clampWhenFinished=true;
    action.play();action.paused=true;action.setEffectiveWeight(0);actions[name]=action;
   }
   return {scene,mixer,actions};
  });
  this.reset();
 }
 reset(){
  this.doors={inner:{progress:0,target:0},outer:{progress:0,target:0}};
  this.console=false;this.thrust=false;this.paused=false;this.suspended=false;this.time=0;
  this.apply();
 }
 commandDoor(name,open){
  if(!['inner','outer'].includes(name))throw new Error('Unknown door');
  const other=this.doors[name==='inner'?'outer':'inner'];
  if(open&&(other.progress>1e-6||other.target===1))return false;
  this.doors[name].target=open?1:0;this.apply();return true;
 }
 update(delta){
  if(this.paused||this.suspended||!Number.isFinite(delta)||delta<=0)return;
  const dt=Math.min(delta,.05);this.time+=dt;
  for(const door of Object.values(this.doors)){
   const distance=door.target-door.progress;
   door.progress+=Math.sign(distance)*Math.min(Math.abs(distance),dt/duration);
  }
  this.apply();
 }
 apply(){
  for(const {mixer,actions} of this.entries){
   for(const [name,door] of Object.entries(this.doors)){
    const prefix=name==='inner'?'InnerDoor':'OuterDoor';
    for(const direction of ['Open','Close']){
     const active=(door.target===1)===(direction==='Open');
     const action=actions[prefix+direction];
     this.seek(action,(direction==='Open'?door.progress:1-door.progress)*action.getClip().duration,active);
    }
   }
   for(const [name,enabled] of [['ConsoleActive',this.console],['ThrusterBurn',this.thrust]]){
    this.seek(actions[name],this.time%actions[name].getClip().duration,enabled);
   }
   mixer.update(0);
  }
 }
 seek(action,time,enabled){
  action.enabled=true;action.paused=true;action.time=time;action.setEffectiveWeight(enabled?1:0);
 }
 snapshot(){return {doors:structuredClone(this.doors),console:this.console,thrust:this.thrust,
  paused:this.paused,suspended:this.suspended,time:this.time};}
 dispose(){for(const {mixer,scene} of this.entries){mixer.stopAllAction();mixer.uncacheRoot(scene);}this.entries=[];}
}
