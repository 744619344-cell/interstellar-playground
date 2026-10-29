import test from 'node:test'
import assert from 'node:assert/strict'
import { CABIN_CREW, cabinDoorAngle, cabinDoorPull, moveCabinCrew, stepCabinDoor } from './cabinCrewMotion'

test('crew uses supported ground, bounded substeps and equal diagonal speed',()=>{
  const origin={x:0,y:-1.54,z:0},support=()=>-1.54
  const straight=moveCabinCrew(origin,{forward:1,right:0},0,.05,support)
  const diagonal=moveCabinCrew(origin,{forward:1,right:1},0,.05,support)
  assert(Math.abs(straight.distance-CABIN_CREW.speed*.05)<1e-12)
  assert(Math.abs(straight.distance-diagonal.distance)<1e-12)
  const blocked=moveCabinCrew(origin,{forward:1,right:1},0,.05,(x,z)=>z<-.01?undefined:-1.54)
  assert(blocked.blocked);assert.equal(blocked.position.z,0);assert(blocked.position.x>0)
  assert.deepEqual(moveCabinCrew(origin,{forward:1,right:0},0,.05,()=>undefined).position,origin)
  assert.equal(moveCabinCrew(origin,{forward:NaN,right:0},0,1,support).distance,0)
  assert.equal(moveCabinCrew(origin,{forward:1,right:0},0,5,support).distance,straight.distance)
})

test('plug clears frame before swing; obstructed closing reopens and opening waits',()=>{
  assert(Math.abs(cabinDoorAngle(.2))<1e-12);assert.equal(cabinDoorPull(.2),1)
  assert.equal(cabinDoorAngle(1),-Math.PI/2);assert.equal(cabinDoorPull(0),0)
  const closing={progress:.6,target:0 as const,blocked:false}
  assert.deepEqual(stepCabinDoor(closing,.05,true,()=>true),{...closing,target:1,blocked:true})
  const opening={progress:.3,target:1 as const,blocked:false}
  assert.deepEqual(stepCabinDoor(opening,.05,true,()=>true),{...opening,blocked:true})
  assert(stepCabinDoor(opening,.05,true,()=>false).progress>.3)
  assert.equal(stepCabinDoor(closing,.05,false,()=>false),closing)
  assert.equal(stepCabinDoor(closing,Infinity,true,()=>false),closing)
})
