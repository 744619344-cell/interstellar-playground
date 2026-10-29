import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Box3,Texture,Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { loadCurrentShipAssembly } from './currentShipAssembly'
import { CurrentCabinRuntime } from './currentCabinRuntime'
import { CabinEquipment } from './cabinEquipment'
import { disposeShipModel } from './shipModelRuntime'

async function loadReal(){
 return loadCurrentShipAssembly(new AbortController().signal,disposeShipModel,async url=>{
  const bytes=await readFile(new URL(url)),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  loader.register(parser=>{parser.loadTextureImage=async()=>new Texture();return {name:'actual_geometry_without_images'}})
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,'')
 })
}
const standing=(x:number,z:number)=>({position:{x,y:-1.54,z},heading:0,door:{progress:0,target:0 as const,blocked:false},seated:false,everWalked:true,curl:false})

test('actual furniture inventory includes every usable source and excludes occluded prompts',async()=>{
 const asset=await loadReal()
 try{
  const equipment=new CabinEquipment(asset.scene,()=>-1.54)
  assert.equal(equipment.devices.length,8)
  assert.equal(equipment.devices.filter(d=>d.kind==='bed').length,3)
  assert.equal(equipment.devices.filter(d=>d.kind==='console').length,2)
  assert(equipment.devices.filter(d=>d.kind==='bed').every(d=>d.surfaceY!==undefined&&Math.abs(d.surfaceY+.82)<.025))
  assert.equal(equipment.prompts({x:0,y:-1.54,z:1.6},()=>false).length,0)
  assert.equal(equipment.prompts({x:0,y:-1.54,z:20},()=>true).length,0)
  asset.scene.traverse(o=>{delete o.userData.partSource})
  assert.equal(new CabinEquipment(asset.scene,()=>-1.54).devices.length,8,'preview wrappers without source tags are recognized too')
 }finally{disposeShipModel(asset.scene)}
})

test('all three real beds fit the actual posed suit, restore rest state, and return to supported standing',async()=>{
 const asset=await loadReal()
 try{
  for(const [index,z]of [-.3,1.6,3.5].entries()){
   let cabin=new CurrentCabinRuntime(asset.scene,standing(0,z))
   const tick=()=>cabin.update(.025,{forward:0,right:0},Math.PI,true,false,true)
   try{
    tick();assert.equal(cabin.snapshot().prompt?.id,'bed');assert.equal(cabin.snapshot().prompt?.title,`${index+1} 号床铺`)
    cabin.interact();for(let i=0;i<300;i++)tick()
    assert.equal(cabin.snapshot().posture,'lying',JSON.stringify(cabin.snapshot()))
    assert.equal(cabin.snapshot().prompt?.verb,'起身');assert.equal(cabin.snapshot().pilotReady,false)
    const actor=asset.scene.getObjectByName('ExistingAstronautInPilotSeat')!,bounds=new Box3().setFromObject(actor,true)
    const bed=new CabinEquipment(asset.scene,()=>-1.54).devices.find(d=>d.id===cabin.snapshot().resting?.deviceId)!
    assert(bounds.min.x>=bed.box.min.x&&bounds.max.x<=bed.box.max.x)
    assert(bounds.min.z>=bed.box.min.z&&bounds.max.z<=bed.box.max.z)
    assert(bounds.min.y>=bed.surfaceY!+.01)
    for(const side of ['L','R'])assert((cabin as any).pose.samples.minimumY(side)-bed.surfaceY!<.045,'both boots rest close to the mattress rather than floating above it')
    assert(bounds.getSize(new Vector3()).x>1.8);assert(bounds.getSize(new Vector3()).y<1.2)
    const view=cabin.camera(Math.PI,.15)!
    assert(actor.visible,'rest camera keeps the lying actor visible')
    assert(new Vector3(view.position.x,view.position.y,view.position.z).distanceTo(new Vector3(view.target.x,view.target.y,view.target.z))>1,'own mattress AABB cannot collapse rest camera')
    const saved=cabin.save();cabin.dispose();cabin=new CurrentCabinRuntime(asset.scene,saved)
    assert.equal(cabin.snapshot().posture,'lying')
    cabin.update(.05,{forward:0,right:0},Math.PI,true,false,false)
    assert.equal(cabin.save().rest?.progress,1,'pause freezes rest posture')
    tick();cabin.interact();for(let i=0;i<140;i++)tick()
    assert.equal(cabin.snapshot().posture,'standing');assert.equal(cabin.save().rest,undefined)
    assert(Math.abs(cabin.snapshot().minimumSoleY-cabin.snapshot().position.y)<.005)
    assert(new Vector3(0,1,0).applyQuaternion(actor.quaternion).y>.999)
   }finally{cabin.dispose()}
  }
 }finally{disposeShipModel(asset.scene)}
})

test('movement cancels partial lying without leaving the actor tilted or allowing seated control',async()=>{
 const asset=await loadReal(),cabin=new CurrentCabinRuntime(asset.scene,standing(0,1.6))
 const tick=(forward=0)=>cabin.update(.025,{forward,right:0},Math.PI,true,false,true)
 try{
  tick();cabin.interact()
  for(let i=0;i<250&&((cabin.snapshot().resting?.progress??0)<.3);i++)tick()
  assert.equal(cabin.snapshot().posture,'lying-down')
  tick(1);for(let i=0;i<100;i++)tick()
  assert.equal(cabin.snapshot().posture,'standing');assert.equal(cabin.snapshot().pilotReady,false)
 }finally{cabin.dispose();disposeShipModel(asset.scene)}
})

test('storage, locker, workbench and both consoles expose functional contextual panels',async()=>{
 const asset=await loadReal()
 try{
  for(const [kind,x,z]of [['storage',1.3,1.4],['locker',1.3,3.4],['workbench',1,-.4],['console',-1.9,-4.3],['console',1.8,-4.3]] as const){
   const cabin=new CurrentCabinRuntime(asset.scene,standing(x,z)),tick=()=>cabin.update(.025,{forward:0,right:0},0,true,false,true)
   try{
    tick();assert.equal(cabin.snapshot().prompt?.id,kind,JSON.stringify({kind,x,z,state:cabin.snapshot()}))
    cabin.interact();tick();assert.equal(cabin.snapshot().devicePanel?.kind,kind)
    assert.equal(cabin.snapshot().prompt?.verb,'结束查看')
    cabin.action('inspect');assert.equal(cabin.snapshot().devicePanel?.checked,true)
    assert.equal(cabin.save().equipmentChecked?.length,1)
    cabin.interact();tick();assert.equal(cabin.snapshot().devicePanel,undefined)
    cabin.interact();tick();assert.equal(cabin.snapshot().devicePanel?.checked,true)
    cabin.update(.025,{forward:1,right:0},0,true,false,true);assert.equal(cabin.snapshot().devicePanel,undefined)
    assert.doesNotMatch(cabin.snapshot().notice,/正在查看/,'leaving a device clears its active-use notice')
    cabin.interact();tick();cabin.cancel();assert.equal(cabin.snapshot().devicePanel,undefined);assert.equal(cabin.snapshot().notice,'已结束查看')
   }finally{cabin.dispose()}
  }
 }finally{disposeShipModel(asset.scene)}
})

test('resting pose survives release and a fresh parse of all real ship assets',async()=>{
 let asset=await loadReal(),cabin=new CurrentCabinRuntime(asset.scene,standing(0,1.6))
 const tick=()=>cabin.update(.025,{forward:0,right:0},Math.PI,true,false,true)
 try{
  tick();cabin.interact();for(let i=0;i<280;i++)tick()
  assert.equal(cabin.snapshot().posture,'lying')
  const saved=cabin.save(),before=new Box3().setFromObject(asset.scene.getObjectByName('ExistingAstronautInPilotSeat')!,true)
  cabin.dispose();disposeShipModel(asset.scene);asset=await loadReal();cabin=new CurrentCabinRuntime(asset.scene,saved)
  assert.equal(cabin.snapshot().posture,'lying')
  const after=new Box3().setFromObject(asset.scene.getObjectByName('ExistingAstronautInPilotSeat')!,true)
  assert(before.min.distanceTo(after.min)<1e-6);assert(before.max.distanceTo(after.max)<1e-6)
  tick();cabin.interact();for(let i=0;i<140;i++)tick()
  assert.equal(cabin.snapshot().posture,'standing')
 }finally{cabin.dispose();disposeShipModel(asset.scene)}
})
