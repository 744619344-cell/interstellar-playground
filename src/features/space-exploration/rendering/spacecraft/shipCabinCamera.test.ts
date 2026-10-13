import test from 'node:test'
import assert from 'node:assert/strict'
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { ShipCabinCamera, shipCabinObstacles } from './shipCabinCamera'
import { ShipViewCamera } from './shipViewCamera'

test('inspection moves along the view, slides at walls, and cannot tunnel through fixtures', () => {
  const camera = new ShipCabinCamera(); camera.setSeat({ x: 0, y: -.18, z: 1 })
  camera.setObstacles([new Box3(new Vector3(-.5,-1,1.4),new Vector3(.5,.5,1.6))])
  camera.move(-100,0,0,0,true)
  assert(camera.snapshot().z < 1.4); assert(camera.blocked)
  camera.move(0,1,0,0,true); camera.move(-1,0,0,0,true)
  assert(camera.snapshot().z > 1.6)
  for(let i=0;i<8;i++)camera.move(0,1,0,0,true)
  assert(camera.snapshot().x <= 1.66); assert(camera.blocked)
  camera.move(0,0,100,0,true); assert(camera.snapshot().y <= 1.078)
  camera.move(0,0,-100,0,true); camera.move(0,0,-100,0,true); camera.move(0,0,-100,0,true)
  assert(camera.snapshot().y >= -1.478)
  const before=camera.snapshot(); camera.move(NaN,1,0,0,true); assert.deepEqual(camera.snapshot(),before)
})

test('closed/moving inner door blocks crossing; fully open passage admits only its clear aperture', () => {
  const camera = new ShipCabinCamera(); camera.setSeat({x:0,y:-.18,z:4.5})
  camera.move(-1,0,0,0,false); assert(camera.snapshot().z <= 4.75)
  camera.move(-1,0,0,0,true); assert(camera.snapshot().z > 5.17)
  for(let i=0;i<6;i++)camera.move(-1,0,0,0,true)
  assert(camera.snapshot().z <= 6.95)
  const side=new ShipCabinCamera();side.setSeat({x:1,y:-.18,z:4.5})
  side.move(-1,0,0,0,true);assert(side.snapshot().z <= 4.75)
})

test('local fixture bounds are unaffected by the ship world translation and rotation', () => {
  const model=new Group(), part=new Mesh(new BoxGeometry(1,1,2),new MeshStandardMaterial())
  part.userData.module='seat';part.position.set(1,-1,-3);model.add(part)
  const before=shipCabinObstacles(model)
  model.position.set(12,15,20);model.rotation.y=1.1
  const after=shipCabinObstacles(model)
  assert(before[0].min.distanceTo(after[0].min)<1e-10);assert(before[0].max.distanceTo(after[0].max)<1e-10)
  part.geometry.dispose();(part.material as MeshStandardMaterial).dispose()
})

test('interior view retains roam position and zoom through view switches and anchor/resource reload', () => {
  const ship={position:{x:0,y:0,z:0},orientation:{x:0,y:0,z:0,w:1}}
  const camera=new ShipViewCamera(ship);camera.setSeat({x:-.65,y:-.18,z:-3.84});camera.setMode('cabin')
  camera.moveCabin(-.5,0,0,false);camera.zoom(-10)
  const before=camera.snapshot()
  camera.setMode('cockpit');camera.setSeat({x:-.65,y:-.18,z:-3.84});camera.setMode('cabin')
  for(let i=0;i<60;i++)camera.update(ship,1/60)
  assert.deepEqual(camera.snapshot().cabinPosition,before.cabinPosition)
  assert.equal(camera.snapshot().interiorFov,45)
  assert.deepEqual(camera.snapshot().position,before.cabinPosition)
})
