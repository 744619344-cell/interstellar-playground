import { readFile, writeFile } from 'node:fs/promises'
import { Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { loadMicrogravityAssembly } from '../../../../src/features/space-exploration/rendering/spacecraft/microgravityAssembly.ts'
import { MicrogravityCabinRuntime } from '../../../../src/features/space-exploration/rendering/spacecraft/microgravityCabinRuntime.ts'
import { disposeShipModel } from '../../../../src/features/space-exploration/rendering/spacecraft/shipModelRuntime.ts'

const loader = new GLTFLoader(); loader.register(p => { p.loadTextureImage = async () => new Texture(); return { name: 'read_only_cpu' } })
const asset = await loadMicrogravityAssembly(new AbortController().signal, disposeShipModel, async url => {
  const b = await readFile(new URL(url)); return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')
})
const variant=process.argv[2]??'baseline', cabin = new MicrogravityCabinRuntime(asset.scene), frames=[], collisions=[]
let step=0, stage='initial'
const record=()=>{const s=cabin.snapshot(); frames.push({step,stage,position:s.position,orientation:s.float.orientation,velocity:s.float.velocity,angularVelocity:s.float.angularVelocity,contact:s.float.contact,blocked:s.blocked,posture:s.posture,notice:s.notice,study:s.equipment.study})}
const translate=cabin.surfaces.translate.bind(cabin.surfaces)
cabin.surfaces.translate=(points,from,to,velocity,release)=>{
 const result=translate(points,from,to,velocity,release), delta=new Vector3().copy(to).sub(from)
 if(new Vector3().copy(result.position).distanceTo(to)>.0001&&collisions.length<30){
  const hits=points.flatMap((point,index)=>{const hit=cabin.surfaces.cast(point,point.clone().add(delta)); if(!hit)return[]
   const sample=cabin.rig.samples[index], path=[];for(let o=hit.owner;o;o=o.parent)path.push(o.name)
   const joints=sample?.mesh.geometry.getAttribute('skinIndex'),weights=sample?.mesh.geometry.getAttribute('skinWeight'),influences=sample?[0,1,2,3].map(k=>({bone:sample.mesh.skeleton.bones[joints.getComponent(sample.index,k)]?.name,weight:weights.getComponent(sample.index,k)})):[]
   return [{index,skinVertex:sample?.index,skinMesh:sample?.mesh.name,influences,point:point.toArray(),hit:hit.point,normal:hit.normal,distance:hit.distance,triangle:hit.triangle,ownerPath:path}]})
  collisions.push({step,stage,from,to,velocity,result,release,hits})
 }
 return result
}
const tick=(count=1)=>{for(let i=0;i<count;i++){cabin.update(1/60,{forward:0,right:0},0,true,false,true);step++;if(i%15===0)record()}}
const key=(name,down)=>cabin.key(name,down)
try{
 tick(45);stage='yaw';key('ArrowRight',true);tick(42);key('ArrowRight',false)
 if(variant.startsWith('settled'))tick(90)
 stage='initial-push';key('KeyW',true);key('KeyD',true);key('Space',true);tick(7);key('KeyW',false);key('KeyD',false);key('Space',false)
 stage='coast';tick(440);record();stage='catch';key('KeyX',true);key('KeyX',false);tick(50);record()
 stage='settle-grip';tick(90);stage='work';cabin.interact();cabin.equipmentAction('micro-work','open');record()
 await writeFile(new URL(`./${variant}-before-push.json`,import.meta.url),JSON.stringify(cabin.save(),null,2))
 cabin.equipmentAction('micro-work','study-arm');stage='experiment-push';key('Space',true);tick(7);key('Space',false);tick(200);record()
 if(variant.endsWith('return')){
  stage='coast-to-port'
  for(let i=0;i<600;i++){tick();const g=cabin.nearestGrip();if(g?.id.startsWith('micro-port-liner')){key('KeyX',true);key('KeyX',false);tick(60);record();break}}
  if(cabin.snapshot().float.contact){stage='return-push';key('Space',true);tick(7);key('Space',false)
   for(let i=0;i<650;i++){tick();const g=cabin.nearestGrip();if(g?.id==='micro-starboard-liner:rail:1'){key('KeyX',true);key('KeyX',false);tick(75);record();break}}
   stage='return-work';cabin.equipmentAction('micro-work','open');record()
  }
 }
 const result={method:'Actual initial spawn, existing key/interact calls only. Read-only instrumentation preserves original collision result. CPU textures omitted, not visual proof.',frames,collisions,saved:cabin.save()}
 await writeFile(new URL(`./${variant}.json`,import.meta.url),JSON.stringify(result,null,2))
 console.log(JSON.stringify({frames:frames.filter(f=>['catch','work'].includes(f.stage)),last:frames.at(-1),collisions:collisions.slice(0,4)},null,2))
}finally{cabin.dispose();disposeShipModel(asset.scene)}
