import {readFile,writeFile} from 'node:fs/promises'
import {Texture,Vector3,Box3,Raycaster,Mesh} from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {loadMicrogravityAssembly} from '../../../../src/features/space-exploration/rendering/spacecraft/microgravityAssembly.ts'
import {MicrogravityCabinRuntime} from '../../../../src/features/space-exploration/rendering/spacecraft/microgravityCabinRuntime.ts'
import {MicrogravitySleepFabric} from '../../../../src/features/space-exploration/rendering/spacecraft/microgravitySleepFabric.ts'
import {createCabinFloat} from '../../../../src/features/space-exploration/domain/cabinFloatMotion.ts'
import {disposeShipModel} from '../../../../src/features/space-exploration/rendering/spacecraft/shipModelRuntime.ts'
const loader=new GLTFLoader();loader.register(p=>{p.loadTextureImage=async()=>new Texture();return{name:'actual_geometry'}})
const asset=await loadMicrogravityAssembly(new AbortController().signal,disposeShipModel,async url=>{const b=await readFile(new URL(url));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')})
const fabric=new MicrogravitySleepFabric(asset.scene,false,true,true,'v5'),bed=asset.scene.getObjectByName('micro-sleep-1'),box=new Box3().setFromObject(bed,true),start=box.getCenter(new Vector3());start.x=box.max.x+.45;start.y=.05
const cabin=new MicrogravityCabinRuntime(asset.scene,{float:createCabinFloat(start)}),scope=JSON.parse(await readFile(new URL('../../../../src/assets/models/microgravity-cabin-20261025/sleep-fit-v2-mask.json',import.meta.url))),tick=()=>cabin.update(1/60,{forward:0,right:0},0,true,false,true),actor=asset.scene.getObjectByName('MicrogravityCrew')
const barriers=[];let liveFrame=0;const clear=cabin.surfaces.clear.bind(cabin.surfaces)
cabin.surfaces.clear=(from,to,tolerance,ignore)=>{
 const result=clear(from,to,tolerance,ignore)
 if(!result&&ignore&&barriers.length<30){
  const hit=cabin.surfaces.cast(from,to,ignore),close=cabin.rig.samples.map(s=>({s,d:cabin.rig.point(s).distanceTo(new Vector3(from.x,from.y,from.z))})).sort((a,b)=>a.d-b.d)[0]
  const joints=close.s.mesh.geometry.getAttribute('skinIndex'),weights=close.s.mesh.geometry.getAttribute('skinWeight'),i=close.s.index
  const influences=['X','Y','Z','W'].map(k=>({bone:close.s.mesh.skeleton.bones[joints[`get${k}`](i)].name,weight:weights[`get${k}`](i)}))
  barriers.push({sample:i,delta:close.d,influences,frame:liveFrame,from:[from.x,from.y,from.z],to:[to.x,to.y,to.z],owner:hit?.owner.name,chain:hit?.owner.parent?.name,point:hit?.point,notice:cabin.snapshot().notice,station:cabin.stations.save()})
 }
 return result
}
cabin.rig.alignedSleep=true;tick();cabin.interact();const samples=[];let meshes=[];bed.traverse(o=>{if(o instanceof Mesh)meshes.push(o)})
for(let frame=0;frame<=216;frame++){
 liveFrame=frame;if([0,21,42,84,126,168,216].includes(frame)){
  const joints=[]
  for(const name of ['head','neck','chest','collar_L','collar_R','upper_arm_L','upper_arm_R','hand_L','hand_R']){
   const joint=actor.getObjectByName(name),p=joint.getWorldPosition(new Vector3()),ray=new Raycaster(new Vector3(box.max.x+1,p.y,p.z),new Vector3(-1,0,0),0,3),hits=ray.intersectObjects(meshes,false)
   joints.push({name,point:p.toArray(),faces:hits.slice(0,4).map(h=>{const face=h.face,ids=[face.a,face.b,face.c];return{point:h.point.toArray(),aheadOfJointM:h.point.x-p.x,side:h.object.userData.microSleepSidePanel??false,vertices:ids,allowedMask:ids.map(i=>scope.weights[i]??null)}})})
  }
  samples.push({frame,seconds:frame/60,posture:cabin.snapshot().posture,position:cabin.snapshot().position,joints})
 }
 tick()
}
cabin.interact();for(let i=0;i<210;i++){liveFrame=217+i;tick()}console.log(JSON.stringify({posture:cabin.snapshot().posture,notice:cabin.snapshot().notice,barriers}));await writeFile(new URL('./alignment-return-blocked.json',import.meta.url),JSON.stringify({method:'Read-only actual GLTF geometry and native posed skeleton. Rays identify occluding source faces; joint centers are not skin contact distances.',samples,barriers},null,2))
console.log(JSON.stringify(samples.at(-1),null,2));cabin.dispose();fabric.dispose();disposeShipModel(asset.scene)

