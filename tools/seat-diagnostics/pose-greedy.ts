import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { Quaternion, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { loadMicrogravityAssembly } from '../../src/features/space-exploration/rendering/spacecraft/microgravityAssembly'
import { MicrogravityCabinRuntime } from '../../src/features/space-exploration/rendering/spacecraft/microgravityCabinRuntime'
import { disposeShipModel } from '../../src/features/space-exploration/rendering/spacecraft/shipModelRuntime'
import { createCabinFloat } from '../../src/features/space-exploration/domain/cabinFloatMotion'
const output='.cache/seat-handoff-pose-greedy.json'
const loader=new GLTFLoader();loader.register(p=>{p.loadTextureImage=async()=>new Texture();return{name:'bounded_pose_search'}})
const asset=await loadMicrogravityAssembly(new AbortController().signal,disposeShipModel,async url=>{const b=await readFile(new URL(url));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')})
const float=createCabinFloat({x:-.6814494406519505,y:-.7074372655819307,z:-3.6401887568211824});float.orientation={x:.000023207919430950093,y:.3676821111041187,z:-.00004579504541612472,w:.9299515377363622}
const cabin=new MicrogravityCabinRuntime(asset.scene,{float}),rig=(cabin as any).rig,surfaces=(cabin as any).surfaces,yaw=-1.9139981428729482,goal=new Vector3(-Math.cos(yaw),0,Math.sin(yaw)).normalize()
const names=['upper_arm_R','forearm_R','hand_R','thigh_R','shin_R','foot_R'],original=new Map(names.map(name=>[name,rig.bones.get(name).quaternion.clone()]))
function clearance(points:Vector3[]){let best=.2,who:any;for(let i=0;i<points.length;i++){const hit=surfaces.cast(points[i],points[i].clone().addScaledVector(goal,.2));if(hit&&hit.distance-.004<best){best=Math.max(0,hit.distance-.004);who={owner:hit.owner.name,triangle:hit.triangle,identity:rig.sampleIdentity(i)}}}return{distance:best,blocker:who}}
function apply(name:string,axis:Vector3,angle:number){rig.bones.get(name).quaternion.multiply(new Quaternion().setFromAxisAngle(axis,angle));rig.update()}
try{
 const sequence:any[]=[]
 for(const [name,axis,angle] of [['upper_arm_R',[0,1,0],-.2],['forearm_R',[0,1,0],-.2],['thigh_R',[0,0,1],-.2]] as const){apply(name,new Vector3(...axis),angle);sequence.push({name,axis,angle})}
 let best=clearance(rig.bodyPoints()),iterations=0,attempts=0;const initial=best
 while(iterations<5 && best.distance<.19){
  let choice:any
  for(const name of names)for(const xyz of [[1,0,0],[0,1,0],[0,0,1]])for(const angle of [-.1,.1]){
   const bone=rig.bones.get(name),base=bone.quaternion.clone(),axis=new Vector3(...xyz as [number,number,number]),target=base.clone().multiply(new Quaternion().setFromAxisAngle(axis,angle));attempts++
   if(original.get(name)!.angleTo(target)>.251)continue
   let before=rig.bodyPoints(),safe=true
   for(let i=1;i<=5;i++){bone.quaternion.copy(base).multiply(new Quaternion().setFromAxisAngle(axis,angle*i/5));rig.update();const after=rig.bodyPoints();if(!surfaces.poseClear(before,after,undefined,0)){safe=false;break}before=after}
   if(safe){const hit=clearance(before);if(hit.distance>best.distance+.001 && (!choice||hit.distance>choice.clearance.distance))choice={name,axis:xyz,angle,clearance:hit}}
   bone.quaternion.copy(base);rig.update()
  }
  if(!choice)break
  apply(choice.name,new Vector3(...choice.axis),choice.angle);sequence.push(choice);best=choice.clearance;iterations++
 }
 const result={note:'Greedy offline source initial pose at recorded root; fixed pose only, no dynamics or visual acceptance.',initial,final:best,iterations,attempts,sequence}
 await mkdir('.cache', { recursive: true }); await writeFile(output,JSON.stringify(result,null,2));process.stdout.write(JSON.stringify(result,null,2))
}finally{cabin.dispose();disposeShipModel(asset.scene)}
