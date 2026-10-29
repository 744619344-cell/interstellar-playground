import test from 'node:test'
import assert from 'node:assert/strict'
import { cabinProximity } from './cabinProximity'
import { cabinCircleHitsPolygon,cabinConvexHull } from './cabinDoorCollision'

test('context prompts appear only near usable devices, and seated F always means stand',()=>{
 const door={x:-.75,y:-.29,z:6.67},seat={x:-.9,y:-1.5,z:-4.5},feet={x:0,y:-1.54,z:6}
 assert.equal(cabinProximity(feet,door,seat,false,false,true)?.verb,'开启舱门')
 assert.equal(cabinProximity(feet,door,seat,true,false,true)?.verb,'关闭舱门')
 assert.equal(cabinProximity({...feet,z:1},door,seat,false,false,true),undefined)
 assert.equal(cabinProximity({...feet,z:-3.2},door,seat,false,false,true)?.verb,'坐下驾驶')
 assert.equal(cabinProximity(feet,door,seat,false,true,true)?.verb,'起立')
 assert.equal(cabinProximity(feet,door,seat,false,true,false),undefined)
})
test('oriented leaf footprint leaves empty AABB corners usable while blocking the actual leaf',()=>{
 const polygon=cabinConvexHull([{x:0,z:0},{x:1,z:1},{x:1.05,z:.95},{x:.05,z:-.05}])
 assert(!cabinCircleHitsPolygon({x:.05,z:.9},.2,polygon))
 assert(cabinCircleHitsPolygon({x:.5,z:.5},.2,polygon))
 assert(cabinCircleHitsPolygon({x:1.1,z:1.1},.2,polygon))
})
