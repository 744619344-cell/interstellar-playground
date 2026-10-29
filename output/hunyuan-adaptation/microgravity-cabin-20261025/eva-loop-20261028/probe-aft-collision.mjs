import {readFile,writeFile} from 'node:fs/promises'
import {Texture,Vector3} from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {loadMicrogravityAssembly} from '../../../../src/features/space-exploration/rendering/spacecraft/microgravityAssembly.ts'
import {MicrogravityCabinRuntime} from '../../../../src/features/space-exploration/rendering/spacecraft/microgravityCabinRuntime.ts'
import {createCabinFloat} from '../../../../src/features/space-exploration/domain/cabinFloatMotion.ts'
import {createEvaProcedure} from '../../../../src/features/space-exploration/domain/evaProcedure.ts'
import {disposeShipModel} from '../../../../src/features/space-exploration/rendering/spacecraft/shipModelRuntime.ts'
const loader=new GLTFLoader();loader.register(p=>{p.loadTextureImage=async()=>new Texture();return{name:'actual_source_geometry'}})
const asset=await loadMicrogravityAssembly(new AbortController().signal,disposeShipModel,async url=>{const b=await readFile(new URL(url));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')})
const cabin=new MicrogravityCabinRuntime(asset.scene,{float:{...createCabinFloat({x:0,y:-.2,z:7.9}),velocity:{x:0,y:0,z:.2}},eva:{...createEvaProcedure(),suit:'ready',location:'outside',pressure:'vacuum',outerOpen:true,tether:true,checks:{helmet:true,seal:true,oxygen:true,battery:true,lifeSupport:true}},doors:{inner:{progress:0,target:0,blocked:false},outer:{progress:1,target:1,blocked:false}}})
cabin.update(.05,{forward:0,right:0},0,true,false,true);cabin.key('KeyS',true);for(let i=0;i<100;i++)cabin.update(.05,{forward:0,right:0},0,true,false,true)
const hits=cabin.rig.bodyPoints().flatMap(p=>{const hit=cabin.surfaces.cast(p,p.clone().add(new Vector3(0,0,.1)));if(!hit)return[];const parents=[];for(let o=hit.owner;o;o=o.parent)parents.push({name:o.name,visible:o.visible,part:o.userData.currentShipPart,module:o.userData.microgravityModule});return[{point:hit.point,distance:hit.distance,parents}]})
const result={method:'Read-only collision diagnosis from an explicit phase fixture; not a traversal proof.',position:cabin.snapshot().position,velocity:cabin.snapshot().float.velocity,hits};await writeFile(new URL('./aft-collision-source.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));cabin.dispose();disposeShipModel(asset.scene)
