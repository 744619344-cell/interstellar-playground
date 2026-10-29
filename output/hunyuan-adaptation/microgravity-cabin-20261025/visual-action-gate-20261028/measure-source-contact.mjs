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
const fabric=new MicrogravitySleepFabric(asset.scene,false,true,true,'v5'),bed=asset.scene.getObjectByName('micro-sleep-2'),box=new Box3().setFromObject(bed,true),start=box.getCenter(new Vector3());start.x=box.max.x+.45;start.y=.05
const cabin=new MicrogravityCabinRuntime(asset.scene,{float:createCabinFloat(start)}),scope=JSON.parse(await readFile(new URL('../../../../src/assets/models/microgravity-cabin-20261025/sleep-fit-v2-mask.json',import.meta.url))),tick=()=>cabin.update(1/60,{forward:0,right:0},0,true,false,true),actor=asset.scene.getObjectByName('MicrogravityCrew')
tick();cabin.interact();const samples=[];let meshes=[];bed.traverse(o=>{if(o instanceof Mesh)meshes.push(o)})
for(let frame=0;frame<=216;frame++){
 if([0,21,42,84,126,168,216].includes(frame)){
  const joints=[]
  for(const name of ['head','neck','chest','collar_L','collar_R','upper_arm_L','upper_arm_R','hand_L','hand_R']){
   const joint=actor.getObjectByName(name),p=joint.getWorldPosition(new Vector3()),ray=new Raycaster(new Vector3(box.max.x+1,p.y,p.z),new Vector3(-1,0,0),0,3),hits=ray.intersectObjects(meshes,false)
   joints.push({name,point:p.toArray(),faces:hits.slice(0,4).map(h=>{const face=h.face,ids=[face.a,face.b,face.c];return{point:h.point.toArray(),aheadOfJointM:h.point.x-p.x,side:h.object.userData.microSleepSidePanel??false,vertices:ids,allowedMask:ids.map(i=>scope.weights[i]??null)}})})
  }
  samples.push({frame,seconds:frame/60,posture:cabin.snapshot().posture,position:cabin.snapshot().position,joints})
 }
 tick()
}
await writeFile(new URL('./source-contact.json',import.meta.url),JSON.stringify({method:'Read-only actual GLTF geometry and native posed skeleton. Rays identify occluding source faces; joint centers are not skin contact distances.',samples},null,2))
console.log(JSON.stringify(samples.at(-1),null,2));cabin.dispose();fabric.dispose();disposeShipModel(asset.scene)
