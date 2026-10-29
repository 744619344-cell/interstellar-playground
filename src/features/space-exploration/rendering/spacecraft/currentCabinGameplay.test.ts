import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { loadCurrentShipAssembly } from './currentShipAssembly'
import { CurrentCabinRuntime } from './currentCabinRuntime'
import { disposeShipModel } from './shipModelRuntime'

async function loadReal(){
 return loadCurrentShipAssembly(new AbortController().signal,disposeShipModel,async url=>{
  const bytes=await readFile(new URL(url)),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  loader.register(parser=>{parser.loadTextureImage=async()=>new Texture();return {name:'actual_geometry_without_images'}})
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,'')
 })
}

test('ordinary aisle approach exposes F, aligns hand and completes both door directions',async()=>{
 const asset=await loadReal(),cabin=new CurrentCabinRuntime(asset.scene)
 const tick=(forward=0,right=0)=>cabin.update(.025,{forward,right},Math.PI,true,false,true)
 try{
  for(let i=0;i<60;i++)tick()
  assert.equal(cabin.snapshot().posture,'standing')
  assert.equal(cabin.snapshot().prompt?.id,'seat')
  for(let i=0;i<420&&cabin.snapshot().prompt?.id!=='door';i++)tick(1)
  for(let i=0;i<20;i++)tick()
  assert.equal(cabin.snapshot().prompt?.id,'door',JSON.stringify(cabin.snapshot()))
  cabin.interact();assert(cabin.snapshot().busy)
  for(let i=0;i<250;i++)tick()
  assert.equal(cabin.snapshot().door.progress,1,JSON.stringify(cabin.snapshot()))
  assert.equal(cabin.snapshot().door.blocked,false)
  assert.equal(cabin.snapshot().notice,'舱门已开启')
  cabin.interact();for(let i=0;i<220;i++)tick()
  assert.equal(cabin.snapshot().door.progress,0,JSON.stringify(cabin.snapshot()))
  assert.equal(cabin.snapshot().notice,'舱门已关闭')
 }finally{cabin.dispose();disposeShipModel(asset.scene)}
})

test('near seat F animates sitting and standing; pilot readiness and exit prompt follow posture',async()=>{
 const asset=await loadReal(),cabin=new CurrentCabinRuntime(asset.scene)
 const tick=(walking=true)=>cabin.update(.025,{forward:0,right:0},0,walking,!walking,true)
 try{
  for(let i=0;i<60;i++)tick()
  assert.equal(cabin.interact(),'cockpit',JSON.stringify(cabin.snapshot()))
  tick(false);assert.equal(cabin.snapshot().pilotReady,false)
  for(let i=0;i<200;i++)tick(false)
  assert.equal(cabin.snapshot().posture,'seated',JSON.stringify(cabin.snapshot()))
  assert.equal(cabin.snapshot().prompt?.verb,'起立')
  assert(cabin.snapshot().pilotReady)
  assert.equal(cabin.interact(),'cabin')
  tick();assert.equal(cabin.snapshot().posture,'standing-up')
  for(let i=0;i<60;i++)tick()
  assert.equal(cabin.snapshot().posture,'standing')
  assert.equal(cabin.snapshot().prompt?.verb,'坐下驾驶')
  // The revised exit is the supported centre aisle beside the chair; clear its back before crossing.
  for(let i=0;i<60;i++)cabin.update(.025,{forward:-1,right:0},0,true,false,true)
  for(let i=0;i<20;i++)cabin.update(.025,{forward:0,right:1},0,true,false,true)
  assert.equal(cabin.interact(),'cockpit',JSON.stringify(cabin.snapshot()))
  for(let i=0;i<200;i++)tick(false)
  assert(asset.scene.getObjectByName('ExistingAstronautInPilotSeat')!.position.x>.85,'nearest right-hand seat is usable too')
  cabin.interact();for(let i=0;i<60;i++)tick()
  cabin.interact();for(let i=0;i<24;i++)tick()
  cabin.cancel(true);for(let i=0;i<90;i++)tick()
  assert.equal(cabin.snapshot().posture,'standing','cancelled sitting returns smoothly to supported standing')
 }finally{cabin.dispose();disposeShipModel(asset.scene)}
})

test('several ordinary door-side positions can use F without manually finding the hand-contact spot',async()=>{
 const asset=await loadReal()
 try{
  for(const point of [{x:0,z:6.1},{x:.3,z:6},{x:-.3,z:5.6},{x:-1.3,z:6.05}]){
   const cabin=new CurrentCabinRuntime(asset.scene,{position:{...point,y:-1.54},heading:0,door:{progress:0,target:0,blocked:false},seated:false,everWalked:true,curl:false})
   try{
    const tick=()=>cabin.update(.025,{forward:0,right:0},Math.PI,true,false,true)
    tick();assert.equal(cabin.snapshot().prompt?.id,'door',JSON.stringify(point))
    cabin.interact();for(let i=0;i<280;i++)tick()
    assert.equal(cabin.snapshot().door.progress,1,JSON.stringify({point,state:cabin.snapshot()}))
   }finally{cabin.dispose()}
  }
 }finally{disposeShipModel(asset.scene)}
})
