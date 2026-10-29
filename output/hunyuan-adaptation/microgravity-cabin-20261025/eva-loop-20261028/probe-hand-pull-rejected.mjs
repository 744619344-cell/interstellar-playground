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
cabin.nudgeMove(-1,-.65);for(let i=0;i<300;i++){tick();if(i%30===0)record('push toward inner '+i)}
cabin.evaAction('inner');for(let i=0;i<230;i++)tick();record('inner request end')
cabin.key('KeyX',true);cabin.key('KeyX',false);for(let i=0;i<60;i++)tick();record('inner source regrasp')
{
 const old=cabin.rig.bodyPoints(),previous=structuredClone(cabin.state),contact=cabin.state.contact,delta=new Vector3(.003,0,0),point=new Vector3().copy(contact.point),normal=cabin.surfaces.grips.find(g=>g.id===contact.id).surfaceNormal
 cabin.state.position={...cabin.state.position,x:cabin.state.position.x+.003};cabin.applyBody();cabin.hold();const after=cabin.rig.bodyPoints(),hits=[]
 for(let i=0;i<old.length;i++)if(!cabin.surfaces.clear(old[i],after[i],.003)){const h=cabin.surfaces.cast(old[i],after[i]);hits.push({i,from:old[i],to:after[i],distance:h?.distance,owner:h?.owner.name,parent:h?.owner.parent?.name,normal:h?.normal})}
 console.log('PULL COLLISION',JSON.stringify({contact,afterContact:cabin.state.contact,hits,before:old.length,after:after.length},null,2));cabin.state=previous;cabin.applyBody();cabin.hold()
}
{
 const original=cabin.surfaces.poseClear.bind(cabin.surfaces);let reported=false
 cabin.surfaces.poseClear=(before,after,release)=>{const clear=original(before,after,release);if(!clear&&!reported){reported=true;console.log('ACTUAL PULL BLOCK',JSON.stringify({contact:cabin.state.contact,release,hits:before.flatMap((p,i)=>{if(cabin.surfaces.clear(p,after[i],.003))return[];const h=cabin.surfaces.cast(p,after[i]);return[{i,from:p,to:after[i],distance:h?.distance,owner:h?.owner.name,parent:h?.owner.parent?.name}]})},null,2))}return clear}
}
cabin.key('KeyJ',true);cabin.key('KeyD',true);for(let i=0;i<190;i++)tick();cabin.key('KeyD',false);record('pull toward opening')
cabin.key('KeyS',true);for(let i=0;i<180;i++){tick();if(i%60===0)record('pull through inner '+i)}cabin.key('KeyS',false);cabin.key('KeyJ',false)
cabin.key('KeyX',true);cabin.key('KeyX',false);cabin.key('KeyX',true);cabin.key('KeyX',false);for(let i=0;i<65;i++)tick();record('rear frame regrasp')
cabin.nudgeMove(-1,0);for(let i=0;i<300;i++){tick();if(i%60===0)record('push into airlock '+i)}
await writeFile(new URL('./inner-route-probe.json',import.meta.url),JSON.stringify({method:'Actual-source locker fixture, then real grasp/wear/push/actions. No position changes after initial fixture; not a main-scene continuous proof.',samples},null,2));console.log(JSON.stringify(samples.map(s=>({stage:s.stage,position:s.position,contact:s.contact,suit:s.suit,notice:s.notice})),null,2));cabin.dispose();disposeShipModel(asset.scene)
