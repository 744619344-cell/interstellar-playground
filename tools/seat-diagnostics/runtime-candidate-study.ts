import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { Quaternion, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { loadMicrogravityAssembly } from '../../src/features/space-exploration/rendering/spacecraft/microgravityAssembly'
import { MicrogravityCabinRuntime } from '../../src/features/space-exploration/rendering/spacecraft/microgravityCabinRuntime'
import { SeatEscapeAssist } from '../../src/features/space-exploration/rendering/spacecraft/seatEscapeAssist'
import { disposeShipModel } from '../../src/features/space-exploration/rendering/spacecraft/shipModelRuntime'
import { createCabinFloat } from '../../src/features/space-exploration/domain/cabinFloatMotion'
const root='output/hunyuan-adaptation/microgravity-cabin-20261025/seat-control-20261029',inputFile=process.argv[2] ?? 'actual-pose-bones.json',capture=JSON.parse(await readFile(`${root}/${inputFile}`,'utf8')),probe=capture.collisionProbe
async function run(enabled:boolean,key:string){
  const loader=new GLTFLoader();loader.register(p=>{p.loadTextureImage=async()=>new Texture();return{name:'runtime_candidate_study'}})
  const asset=await loadMicrogravityAssembly(new AbortController().signal,disposeShipModel,async url=>{const b=await readFile(new URL(url));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')})
  const rootQ=new Quaternion().fromArray(probe.pose.rootRotation),front=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI),q=rootQ.clone().multiply(front.clone().invert())
  const float=createCabinFloat(probe.from);float.orientation={x:q.x,y:q.y,z:q.z,w:q.w}
  const cabin=new MicrogravityCabinRuntime(asset.scene,{float}),rig=(cabin as any).rig,actor=(cabin as any).actor;(cabin as any).seatEscape=new SeatEscapeAssist(enabled)
  actor.position.set(probe.from.x,probe.from.y,probe.from.z);actor.quaternion.copy(rootQ)
  for(const row of probe.pose.bones){const bone=rig.bones.get(row.name);if(bone)bone.quaternion.fromArray(row.rotation)}rig.update()
  const ref=probe.samples.map((p:any)=>new Vector3(p.x,p.y,p.z)),points=rig.bodyPoints(),maxError=Math.max(...points.map((p:Vector3,i:number)=>p.distanceTo(ref[i])))
  const samples=[];let active=0,ready=0,blocked=0
  try{
    const start=cabin.snapshot().position;cabin.key(key,true)
    for(let i=0;i<120;i++){
      cabin.update(1/60,{forward:0,right:0},capture.view.yaw,true,false,true)
      const action=(cabin as any).seatEscape;active+=Number(action.active);ready+=Number(rig.seatClearanceReady);blocked+=Number(cabin.snapshot().blocked)
      if([0,29,59,71,119].includes(i))samples.push({frame:i+1,position:cabin.snapshot().position,active:action.active,ready:rig.seatClearanceReady})
    }
    cabin.key(key,false);const end=cabin.snapshot().position,delta=new Vector3(end.x-start.x,end.y-start.y,end.z-start.z),goal=new Vector3(-Math.cos(capture.view.yaw),0,Math.sin(capture.view.yaw)).normalize()
    return{enabled,key,maxError,start,end,distance:delta.length(),alongLeft:delta.dot(goal),activeFrames:active,readyFrames:ready,blockedFrames:blocked,samples}
  }finally{cabin.dispose();disposeShipModel(asset.scene)}
}
const results=[];for(const key of ['ArrowLeft','ArrowRight'])for(const enabled of [false,true]){const r=await run(enabled,key);results.push(r);process.stdout.write(JSON.stringify(r)+'\n')}
await mkdir('.cache', { recursive: true }); await writeFile(`.cache/seat-handoff-runtime-${inputFile}`,JSON.stringify(results,null,2))
