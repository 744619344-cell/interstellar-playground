import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Box3, Mesh, PerspectiveCamera, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { loadCurrentShipAssembly } from './currentShipAssembly'
import { CurrentCabinRuntime } from './currentCabinRuntime'
import { CurrentAftDoor,crewIntersectsBox } from './currentAftDoor'
import { disposeShipModel,ShipModelRuntime,type ShipModelAsset } from './shipModelRuntime'
import { CABIN_CREW,stepCabinDoor } from '../../domain/cabinCrewMotion'

async function parseReal(url:string){
 const bytes=await readFile(new URL(url)),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
 loader.register(parser=>{parser.loadTextureImage=async()=>new Texture();return {name:'actual_asset_without_images'}})
 return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,'')
}

async function checkOwnedModelReload(asset:ShipModelAsset){
 let first:ShipModelAsset|undefined=asset
 const owner=new ShipModelRuntime(()=>{},async()=>{
  const existing=first;first=undefined
  return existing??loadCurrentShipAssembly(new AbortController().signal,disposeShipModel,url=>parseReal(url))
 })
 const ready=async()=>{
  const deadline=Date.now()+5000
  while(owner.snapshot().status==='loading'&&Date.now()<deadline)await new Promise(done=>setTimeout(done,10))
  assert.equal(owner.snapshot().status,'ready')
 }
 const tick=(forward=0,right=0)=>owner.updateCabin(.025,{forward,right},Math.PI,.22,true,false,true)
 try{
  await ready();for(let i=0;i<60;i++)tick()
  for(let i=0;i<400;i++)tick(1)
  for(let i=0;i<100&&owner.snapshot().cabin!.position.z>6;i++)tick(-1)
  for(let i=0;i<55;i++)tick(0,1)
  for(let i=0;i<10;i++)tick(1)
  assert(owner.cabinAction('door'));for(let i=0;i<240;i++)tick()
  const before=owner.snapshot().cabin;assert(before);assert.equal(before.door.progress,1)
  owner.suspend(true);owner.suspend(true)
  assert.equal(owner.snapshot().cabin,undefined,'hidden owner releases its actual controller and asset')
  owner.suspend(false);await ready();tick()
  assert.deepEqual(owner.snapshot().cabin?.position,before.position)
  assert.deepEqual(owner.snapshot().cabin?.door,before.door,'freshly loaded actual assets restore the saved mechanism state')
 }finally{owner.dispose()}
}

test('actual ship supports walking, real glove contact, door travel and borrowed-resource restoration',async()=>{
 const asset=await loadCurrentShipAssembly(new AbortController().signal,disposeShipModel,url=>parseReal(url))
 const actor=asset.scene.getObjectByName('ExistingAstronautInPilotSeat')!,seat=actor.position.clone()
 const cabin=new CurrentCabinRuntime(asset.scene),door=new CurrentAftDoor(asset.scene)
 let releases=0;asset.scene.traverse(o=>{if(o instanceof Mesh)o.geometry.addEventListener('dispose',()=>releases++)})
 const tick=(forward=0,right=0)=>cabin.update(.025,{forward,right},Math.PI,true,false,true)
 for(let i=0;i<60;i++)tick();const start=cabin.snapshot()
 assert.equal(cabin.action('door'),false,'distant actions cannot remotely open the door')
 assert.equal(cabin.snapshot().door.target,0)
 const actualMin=new Box3().setFromObject(actor,true).min.y
 assert(Math.abs(actualMin-start.minimumSoleY)<.003,`cached soles ${start.minimumSoleY} match actual ${actualMin}; actor ${actor.position.y}`)
 assert(cabin.action('wave'));tick();assert.equal(cabin.snapshot().action,'挥手')
 cabin.update(.025,{forward:1,right:0},Math.PI,true,false,false)
 assert.deepEqual(cabin.snapshot().position,start.position,'paused actions and movement stop')
 assert.equal(cabin.snapshot().action,'站立')
 for(let i=0;i<400;i++)tick(1)
 const stopped=cabin.snapshot();assert(stopped.blocked);assert(stopped.position.z>6.15&&stopped.position.z<6.3)
 for(let i=0;i<100&&cabin.snapshot().position.z>6;i++)tick(-1)
 for(let i=0;i<55;i++)tick(0,1)
 for(let i=0;i<10;i++)tick(1)
 assert(cabin.snapshot().position.x< -1,JSON.stringify(cabin.snapshot()))
 const admitted=cabin.action('door')
 assert(admitted,JSON.stringify({state:cabin.snapshot(),shoulder:(cabin as any).pose.shoulder('R').toArray(),line:(cabin as any).surface.lineClear((cabin as any).pose.shoulder('R'),door.buttonPoint())}))
 let contactError=Infinity
 for(let i=0;i<240;i++){
  tick()
  const state=cabin.snapshot()
  if(state.door.target===1&&state.action==='按按钮'){
   const tip=(cabin as any).pose.samples.tip('R') as Vector3
   contactError=Math.min(contactError,tip.distanceTo(door.buttonPoint(1)))
  }
 }
 assert(contactError<.012,'door changes only after actual skinned glove contact')
 assert.equal(cabin.snapshot().door.progress,1)
 const saved=cabin.save()
 assert.equal(cabin.snapshot().door.blocked,false)
 assert(Math.abs(new Box3().setFromObject(actor,true).min.y-cabin.snapshot().minimumSoleY)<.003)
 const hinge=asset.scene.getObjectByName('AftDoorHinge')!,before=hinge.position.clone()
 assert(Math.abs(hinge.rotation.y+Math.PI/2)<1e-9)
 const feet={x:0,y:-1.54,z:6.28}
 const blocked=stepCabinDoor({progress:.4,target:0,blocked:false},.05,true,(a,b)=>crewIntersectsBox(door.sweep(a,b),feet,CABIN_CREW.radius,CABIN_CREW.height))
 assert.equal(blocked.target,1);assert(blocked.blocked)
 assert(cabin.action('door'));for(let i=0;i<240;i++)tick()
 assert.equal(cabin.snapshot().door.progress,0,'second physical press closes door')
 assert(hinge.position.z>before.z)
 const camera=new PerspectiveCamera(55,1,.025,100),button=door.buttonPoint()
 camera.position.copy(button).add(new Vector3(.1,.03,-.8));camera.lookAt(button);camera.updateMatrixWorld(true)
 assert(door.hit(camera,100,100,200,200),'ray hits actual low button mesh')
 cabin.reset();assert.deepEqual(actor.position,seat)
 tick();assert.deepEqual(cabin.snapshot().position,start.position)
 cabin.dispose();door.dispose();assert.equal(releases,0,'controllers borrow assembly resources')
 assert.deepEqual(actor.position,seat);assert.equal(hinge.rotation.y,0)
 const restored=new CurrentCabinRuntime(asset.scene,saved)
 restored.update(.025,{forward:0,right:0},Math.PI,true,false,true)
 const restoredHeight=new Box3().setFromObject(actor,true).getSize(new Vector3()).y
 assert(restoredHeight>1.8&&restoredHeight<1.91,'restored standing pose is reconstructed immediately, without blending from the source seat pose')
 assert.equal(restored.snapshot().door.progress,1,'resource restoration keeps door state')
 assert.deepEqual(restored.snapshot().position,saved.position,'resource restoration keeps supported feet position')
 restored.dispose()
 await checkOwnedModelReload(asset);assert(releases>0)
})
