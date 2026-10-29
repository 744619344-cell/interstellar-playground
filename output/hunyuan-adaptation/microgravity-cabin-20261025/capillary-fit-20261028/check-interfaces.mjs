import { readFile, writeFile } from 'node:fs/promises'
import { Texture, Vector3, Quaternion } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { loadMicrogravityAssembly } from '../../../../src/features/space-exploration/rendering/spacecraft/microgravityAssembly.ts'
import { MicrogravitySurfaces } from '../../../../src/features/space-exploration/rendering/spacecraft/microgravitySurfaces.ts'
import { MicrogravityOutfit } from '../../../../src/features/space-exploration/rendering/astronaut/microgravityOutfit.ts'
import { disposeShipModel } from '../../../../src/features/space-exploration/rendering/spacecraft/shipModelRuntime.ts'
const loader=new GLTFLoader();loader.register(p=>{p.loadTextureImage=async()=>new Texture();return{name:'read_only_interface'}})
const asset=await loadMicrogravityAssembly(new AbortController().signal,disposeShipModel,async url=>{const b=await readFile(new URL(url));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')})
const surfaces=new MicrogravitySurfaces(asset.scene),outfit=new MicrogravityOutfit(asset.scene),front=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI),normal=new Vector3(-1,0,0)
const arrival=JSON.parse(await readFile(new URL('../drift-route-20261028/production-final-events.json',import.meta.url),'utf8'))[0].float
const proposals=[{id:'A',y:.29,z:-.84,back:1.61},{id:'B',y:-.12,z:-.84,back:1.48},{id:'C',y:-.86,z:-1.12,back:1.60}],results=[]
const belongs=(o,id)=>{for(let p=o;p;p=p.parent)if(p.name===id)return true;return false}
try{
 for(const p of proposals){const samples=[]
  for(let iy=0;iy<=12;iy++)for(let iz=0;iz<=16;iz++){
   const y=p.y-.12+iy*.02,z=p.z-.16+iz*.02,hit=surfaces.cast(new Vector3(0,y,z),new Vector3(2.6,y,z));samples.push({y,z,x:hit?.point.x,work:!!hit&&belongs(hit.owner,'micro-work'),intrudes:!!hit&&hit.point.x<p.back})
  }
  const xs=samples.filter(s=>s.work).map(s=>s.x);results.push({...p,samples:samples.length,knownWork:samples.filter(s=>s.work).length,missing:samples.filter(s=>!s.work).length,sourceXMin:Math.min(...xs),sourceXMax:Math.max(...xs),gapMin:Math.min(...xs)-p.back,gapMax:Math.max(...xs)-p.back,sampledIntrusion:samples.filter(s=>s.intrudes).length,grid:samples})
 }
 const grip=surfaces.grips.find(g=>g.id===arrival.contact.id),lower=surfaces.grips.find(g=>g.id==='micro-work:rail:1'),fixtures=[{id:'actual-main-arrival',position:arrival.position,orientation:arrival.orientation,grip},{id:'explicit-existing-work-grip-fixture',position:lower.point.clone().addScaledVector(lower.normal,.62).add(new Vector3(0,-.22,0)),orientation:{x:0,y:0,z:0,w:1},grip:lower},{id:'proposed-close-lower-posture-only',position:{x:1.21,y:-.76,z:-.86},orientation:arrival.orientation,grip:lower},{id:'proposed-25deg-tilted-posture-raised-3cm-only',position:{x:1.22,y:-.85,z:-.68},orientation:new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-25*Math.PI/180).multiply(new Quaternion().copy(arrival.orientation)),grip:lower}],reach=[]
 for(const f of fixtures){outfit.body(new Vector3().copy(f.position),new Quaternion().copy(f.orientation).multiply(front));outfit.rig.pose(0);const touch=outfit.rig.reach(f.grip.point,undefined,f.grip.surfaceNormal),side=touch.side==='L'?'R':'L',targets=[]
  for(const p of proposals)for(const upper of p.id==='C'?[false,true]:[false]){const target=new Vector3(p.back-.12,p.y+(upper?.10:-.08),p.z+(upper?.13:.10));targets.push({id:p.id+(upper?'-upper-control':''),target,freeHand:side,canReach:outfit.rig.canReach(target,normal,side),lineClear:surfaces.clear(outfit.rig.reachVolumes().find(v=>v.side===side).shoulder,target)})}
  const body=outfit.rig.bodyPoints(),feet=body.reduce((min,p)=>Math.min(min,p.y),Infinity),floor=surfaces.cast(new Vector3(f.position.x,-.4,f.position.z),new Vector3(f.position.x,-2,f.position.z)),behind=[]
  body.forEach((p,index)=>{const hit=surfaces.cast(new Vector3(0,p.y,p.z),p);if(hit&&hit.point.x<p.x-.004)behind.push({index,point:p,hit:hit.point,owner:hit.owner.name,triangle:hit.triangle,nearHandContact:p.distanceTo(f.grip.point)<.18})})
  reach.push({fixture:f.id,position:f.position,grip:f.grip.id,support:{reachable:touch.reachable,error:touch.error,side:touch.side},handEnvelopes:outfit.rig.reachVolumes(),targets,lowestSkinY:feet,sourceBelow:floor?.point,behindSourceSamples:behind,limits:'Static finite source pose/line checks only. A point behind the first inboard face is conservative evidence, not a closed-volume proof. Not continuous arrival, full limb sweep, load rating or installed device validation.'})
 }
 const report={method:'Read-only 2cm source rays per proposed footprint; original rig canReach restores its pose; no device/collision geometry created.',results,reach};await writeFile(new URL('./interface-static-v4.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({results:results.map(({grid,...r})=>r),reach},null,2))
}finally{outfit.dispose();surfaces.dispose();disposeShipModel(asset.scene)}
