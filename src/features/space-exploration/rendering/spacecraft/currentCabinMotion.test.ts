import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Texture,Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { loadCurrentShipAssembly } from './currentShipAssembly'
import { CurrentCabinRuntime } from './currentCabinRuntime'
import { disposeShipModel } from './shipModelRuntime'
import { CABIN_ANIMATION,cabinGait,cabinPressAmount,motionEase } from '../../domain/cabinMotionProfile'

async function loadReal(){
 return loadCurrentShipAssembly(new AbortController().signal,disposeShipModel,async url=>{
  const bytes=await readFile(new URL(url)),loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  loader.register(parser=>{parser.loadTextureImage=async()=>new Texture();return {name:'actual_geometry_without_images'}})
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,'')
 })
}
const saved={position:{x:0,y:-1.54,z:1.6},heading:0,door:{progress:0,target:0 as const,blocked:false},seated:false,everWalked:true,curl:false}

test('clip envelopes settle smoothly and hold the physical button fully depressed before release',()=>{
 for(let i=0;i<=100;i++){const x=i/100;assert(motionEase(x)>=0&&motionEase(x)<=1);assert(Math.abs(motionEase(x)+motionEase(1-x)-1)<1e-12)}
 assert.equal(cabinPressAmount(-1),0);assert.equal(cabinPressAmount(CABIN_ANIMATION.press),0)
 for(const t of [.6,.9,1.2,1.3])assert.equal(cabinPressAmount(t),1)
 assert(motionEase(.001)<1e-7);assert(1-motionEase(.999)<1e-7)
})

test('stance ankle stays in ship coordinates while the body travels, and reverse input turns before striding',async()=>{
 const asset=await loadReal(),cabin=new CurrentCabinRuntime(asset.scene,saved),actor=asset.scene.getObjectByName('ExistingAstronautInPilotSeat')!
 let last:{cycle:number;point:Vector3}|undefined,samples=0,travel=0
 try{
  for(let i=0;i<150;i++){
   const before=cabin.snapshot().position;cabin.update(.025,{forward:1,right:0},0,true,false,true)
   const phase=(cabin as any).phase as number,gait=cabinGait(phase,'L'),point=actor.getObjectByName('foot_L')!.getWorldPosition(new Vector3())
   if((cabin as any).strength>.85&&gait.cycle>.08&&gait.cycle<.48){
    if(last&&gait.cycle>last.cycle){assert(Math.hypot(point.x-last.point.x,point.z-last.point.z)<.006);travel+=Math.abs(cabin.snapshot().position.z-before.z);samples++}
    last={cycle:gait.cycle,point}
   }else last=undefined
  }
  assert(samples>30);assert(travel>1)
  const start=cabin.snapshot().position;let heading=cabin.snapshot().heading
  for(let i=0;i<12;i++){
   cabin.update(.025,{forward:-1,right:0},0,true,false,true)
   const next=cabin.snapshot().heading,delta=Math.abs(Math.atan2(Math.sin(next-heading),Math.cos(next-heading)))
   assert(delta<=CABIN_ANIMATION.turnRate*.025+1e-8);heading=next
  }
  assert(Math.abs(cabin.snapshot().position.z-start.z)<.2,'body does not slide backwards during the first half turn')
 }finally{cabin.dispose();disposeShipModel(asset.scene)}
})

test('lying uses bent knees at the bed edge before reclining and keeps the pelvis trajectory continuous',async()=>{
 const asset=await loadReal(),cabin=new CurrentCabinRuntime(asset.scene,saved),actor=asset.scene.getObjectByName('ExistingAstronautInPilotSeat')!
 let seated=false,reclined=false,previous:Vector3|undefined
 try{
  cabin.update(.025,{forward:0,right:0},0,true,false,true);cabin.interact()
  for(let i=0;i<350;i++){
   cabin.update(.025,{forward:0,right:0},0,true,false,true)
   const p=cabin.snapshot().resting?.progress;if(p===undefined)continue
   const hip=actor.getObjectByName('thigh_L')!.getWorldPosition(new Vector3())
   if(previous)assert(hip.distanceTo(previous)<.1,'pelvis cannot snap between clip stages');previous=hip
   if(p>.23&&p<.28){assert(actor.getObjectByName('shin_L')!.rotation.z<-.9);assert(new Vector3(0,1,0).applyQuaternion(actor.quaternion).y>.95);seated=true}
   if(p>.96){assert(actor.getObjectByName('shin_L')!.rotation.z> -1.2&&actor.getObjectByName('shin_L')!.rotation.z<-.8);assert(new Vector3(0,1,0).applyQuaternion(actor.quaternion).y<.1);reclined=true}
  }
  assert(seated&&reclined);assert.equal(cabin.snapshot().posture,'lying')
 }finally{cabin.dispose();disposeShipModel(asset.scene)}
})

test('wave settles back to relaxed arms and finger flexion uses staggered natural ranges',async()=>{
 const asset=await loadReal(),cabin=new CurrentCabinRuntime(asset.scene,saved),actor=asset.scene.getObjectByName('ExistingAstronautInPilotSeat')!
 const tick=()=>cabin.update(.025,{forward:0,right:0},0,true,false,true)
 try{
  tick();assert(cabin.action('wave'));for(let i=0;i<35;i++)tick()
  assert(actor.getObjectByName('upper_arm_R')!.rotation.x>0)
  for(let i=0;i<80;i++)tick();assert.equal(cabin.snapshot().action,'站立')
  assert(Math.abs(actor.getObjectByName('upper_arm_R')!.rotation.x+1.35)<.02)
  cabin.action('curl');for(let i=0;i<30;i++)tick()
  assert(Math.abs(actor.getObjectByName('pinky_R')!.rotation.x)>Math.abs(actor.getObjectByName('index_R')!.rotation.x))
  cabin.action('relax');for(let i=0;i<30;i++)tick()
  assert(Math.abs(actor.getObjectByName('index_R')!.rotation.x)<.04)
 }finally{cabin.dispose();disposeShipModel(asset.scene)}
})
