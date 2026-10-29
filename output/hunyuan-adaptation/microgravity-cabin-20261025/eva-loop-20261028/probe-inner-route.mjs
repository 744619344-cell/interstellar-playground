import {readFile,writeFile} from 'node:fs/promises'
import {Texture,Vector3,Box3} from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {loadMicrogravityAssembly} from '../../../../src/features/space-exploration/rendering/spacecraft/microgravityAssembly.ts'
import {MicrogravityCabinRuntime} from '../../../../src/features/space-exploration/rendering/spacecraft/microgravityCabinRuntime.ts'
import {MicrogravitySurfaces} from '../../../../src/features/space-exploration/rendering/spacecraft/microgravitySurfaces.ts'
import {createCabinFloat} from '../../../../src/features/space-exploration/domain/cabinFloatMotion.ts'
import {disposeShipModel} from '../../../../src/features/space-exploration/rendering/spacecraft/shipModelRuntime.ts'
const loader=new GLTFLoader();loader.register(p=>{p.loadTextureImage=async()=>new Texture();return{name:'actual_source_geometry'}})
const asset=await loadMicrogravityAssembly(new AbortController().signal,disposeShipModel,async url=>{const b=await readFile(new URL(url));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')},undefined,undefined,{lockerDoors:true})
const surfaces=new MicrogravitySurfaces(asset.scene),grip=surfaces.grips.find(g=>g.id.startsWith('micro-locker')),start=grip.point.clone().add(new Vector3(-.62,-.22,0));surfaces.dispose()
const cabin=new MicrogravityCabinRuntime(asset.scene,{float:createCabinFloat(start)}),tick=()=>cabin.update(1/60,{forward:0,right:0},0,true,false,true),samples=[]
const record=stage=>{const s=cabin.snapshot();samples.push({stage,position:s.position,velocity:s.float.velocity,contact:s.float.contact?.id,suit:s.eva.suit,location:s.eva.location,notice:s.notice,prompt:s.prompt,doors:cabin.doors.snapshot(),buttons:cabin.doors.buttons,controls:s.evaControls})}
tick();cabin.key('KeyX',true);cabin.key('KeyX',false);for(let i=0;i<50;i++)tick();record('held at actual locker grip')
cabin.evaAction('locker');for(let i=0;i<150;i++)tick();console.log('LOCKER',JSON.stringify(cabin.save().lockerDoor));record('cabinet door fully open')
cabin.evaAction('wear');for(let i=0;i<190;i++)tick();cabin.evaAction('inspect');record('wear and inspect')
cabin.nudgeMove(-1,-.5);for(let i=0;i<240;i++)tick();record('push toward inner')
cabin.evaAction('inner');for(let i=0;i<45;i++)tick();record('inner request')
cabin.key('KeyX',true);cabin.key('KeyX',false);for(let i=0;i<210;i++)tick();record('inner source regrasp and open')
cabin.nudgeMove(0,1);for(let i=0;i<75;i++)tick();record('frame supported lateral push')
cabin.key('KeyX',true);cabin.key('KeyX',false);for(let i=0;i<65;i++)tick();record('opening edge regrasp')
cabin.nudgeMove(-1,0);for(let i=0;i<300;i++){tick();if(i%60===0)record('push into airlock '+i)}
await writeFile(new URL('./inner-route-probe.json',import.meta.url),JSON.stringify({method:'Actual-source locker fixture, then real grasp/wear/push/actions. No position changes after initial fixture; not a main-scene continuous proof.',samples},null,2));console.log(JSON.stringify(samples.map(s=>({stage:s.stage,position:s.position,contact:s.contact,suit:s.suit,notice:s.notice})),null,2));cabin.dispose();disposeShipModel(asset.scene)

