import test from 'node:test'
import assert from 'node:assert/strict'
import { cabinApproachPath,cabinSegmentClear } from './cabinApproach'

test('a supported narrow aisle is reachable from a position between search grid columns',()=>{
 const support=(x:number,z:number)=>Math.abs(x)<1.5&&z>=-3.5||Math.abs(x)<.011&&z>=-4.9?0:undefined
 const start={x:.315,y:0,z:-3.26},goal={x:0,y:0,z:-4.45},path=cabinApproachPath(start,goal,support)
 assert(path);assert.deepEqual(path.at(-1),goal)
 let point=start;for(const next of path){assert(cabinSegmentClear(point,next,support));point=next}
 assert.equal(cabinApproachPath(start,{x:0,y:0,z:-5.2},support),undefined,'an unsupported endpoint remains rejected')
})
