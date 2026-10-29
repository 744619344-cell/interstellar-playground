import * as T from 'three'
import React from 'react'
import {createRoot} from 'react-dom/client'
import {loadMicrogravityAssembly} from '/src/features/space-exploration/rendering/spacecraft/microgravityAssembly.ts'
import {MicrogravityCabinRuntime} from '/src/features/space-exploration/rendering/spacecraft/microgravityCabinRuntime.ts'
import {MicrogravitySurfaces} from '/src/features/space-exploration/rendering/spacecraft/microgravitySurfaces.ts'
import {createCabinFloat} from '/src/features/space-exploration/domain/cabinFloatMotion.ts'
import {parseCabinEquipmentAction} from '/src/features/space-exploration/domain/cabinEquipmentCatalog.ts'
import CabinEquipmentUsePanel from '/src/features/space-exploration/ui/CabinEquipmentUsePanel.tsx'
import CabinMotionStudyPanel from '/src/features/space-exploration/ui/CabinMotionStudyPanel.tsx'
import '/src/features/space-exploration/ui/ShipFlight.css'
import {disposeShipModel} from '/src/features/space-exploration/rendering/spacecraft/shipModelRuntime.ts'
import {ShipReviewLighting} from '/src/features/space-exploration/rendering/spacecraft/shipVisibility.ts'
import {ShipModelEnvironment} from '/src/features/space-exploration/rendering/spacecraft/shipModelEnvironment.ts'

const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,innerWidth/innerHeight,.025,100),renderer=new T.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true}),environment=new ShipModelEnvironment(scene),events=new AbortController(),signal=events.signal
renderer.setPixelRatio(Math.min(1.25,devicePixelRatio));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;scene.background=new T.Color('#10232f');renderer.domElement.tabIndex=0;document.body.append(renderer.domElement)
const ui=createRoot(document.getElementById('equipment')),studyUi=createRoot(document.getElementById('study')),status=document.getElementById('status'),fixture=document.getElementById('fixture')
let model,runtime,lighting,loading,saved,frame,dead=false,generation=0,last=performance.now(),lastOutput=0,paused=false,yaw=-Math.PI/2,pitch=.15,drag
const focus=()=>renderer.domElement.focus()
function release(){saved=runtime?.save()??saved;runtime?.dispose();runtime=undefined;ui.render(null);studyUi.render(null);lighting?.dispose();lighting=undefined;environment.dispose();if(model)disposeShipModel(model);model=undefined}
function reset(){
 if(!model)return;const equipment=runtime?.save().equipment??saved?.equipment;runtime?.dispose();let initial
 if(fixture.value!=='rail'){const surfaces=new MicrogravitySurfaces(model),id=fixture.value==='service'?'micro-starboard-liner:rail:1':'micro-work:rail:1',grip=surfaces.grips.find(g=>g.id===id);if(!grip)throw Error('缺少实际来源抓点');const point=grip.point.clone().addScaledVector(grip.normal,.62).add(new T.Vector3(0,-.22,0));surfaces.dispose();initial={float:createCabinFloat(point),equipment}}
 runtime=new MicrogravityCabinRuntime(model,initial);saved=undefined;yaw=-Math.PI/2;pitch=.15;paused=false;document.getElementById('pause').textContent='暂停';status.textContent='实际模型已就绪 · F 查看，X 抓稳';focus()
}
async function load(){
 loading?.abort();loading=new AbortController();const token=++generation
 try{const asset=await loadMicrogravityAssembly(loading.signal,disposeShipModel,undefined,p=>status.textContent=`模型 ${p.completed}/${p.total} · ${(p.loadedBytes/1e6).toFixed(0)} MB`);if(dead||token!==generation){disposeShipModel(asset.scene);return}model=asset.scene;scene.add(model);lighting=new ShipReviewLighting([model]);scene.add(lighting.root);environment.ensure(renderer);if(saved){runtime=new MicrogravityCabinRuntime(model,saved);status.textContent='已恢复设备清单与检查状态'}else reset()}
 catch(e){if(!dead&&e.name!=='AbortError')status.textContent=e.message}
}
function onAction(action){const command=parseCabinEquipmentAction(action);if(command&&!paused)runtime?.equipmentAction(command.id,command.action);focus()}
function panel(s){
 studyUi.render(React.createElement(CabinMotionStudyPanel,{study:s.equipment.study,paused,onAction}))
 const p=s.devicePanel;if(!p){ui.render(null);return}
 ui.render(React.createElement(React.Fragment,null,React.createElement('h2',null,p.title),React.createElement('p',null,p.description),React.createElement('nav',{'aria-label':'切换附近设备'},s.nearbyEquipment.filter(d=>d.id!==p.id).map(d=>React.createElement('button',{key:d.id,disabled:paused,onClick:()=>onAction(`equipment:${d.id}:open`)},d.title))),React.createElement(CabinEquipmentUsePanel,{id:p.id,state:s.equipment,context:s.equipmentContext,paused,onAction})))
}
document.getElementById('reset').addEventListener('click',()=>{status.textContent='重建实际表面查询…';setTimeout(()=>{if(!dead&&!document.hidden)reset()},0)},{signal})
document.getElementById('interact').addEventListener('click',()=>{if(!paused)runtime?.interact();focus()},{signal})
document.getElementById('grip').addEventListener('click',()=>{if(!paused){runtime?.key('KeyX',true);runtime?.key('KeyX',false)}focus()},{signal})
document.getElementById('push').addEventListener('click',()=>{if(!paused)runtime?.nudgeMove(0,0);focus()},{signal})
document.getElementById('pause').addEventListener('click',()=>{paused=!paused;if(paused)runtime?.cancel();document.getElementById('pause').textContent=paused?'继续':'暂停';focus()},{signal})
document.getElementById('cancel').addEventListener('click',()=>{runtime?.cancel(true);focus()},{signal})
function key(e){if(e.ctrlKey||e.metaKey||e.altKey||document.activeElement?.tagName==='SELECT')return;const down=e.type==='keydown';if(down&&e.repeat)return;if(e.code==='KeyF'){if(down&&!paused)runtime?.interact();e.preventDefault()}else if(e.code==='Escape'){if(down)runtime?.cancel(true);e.preventDefault()}else if(runtime?.key(e.code,down))e.preventDefault()}
window.addEventListener('keydown',key,{signal});window.addEventListener('keyup',key,{signal});window.addEventListener('blur',()=>runtime?.cancel(),{signal})
renderer.domElement.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];renderer.domElement.setPointerCapture(e.pointerId)},{signal});renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;yaw-=(e.clientX-drag[0])*.005;pitch=Math.max(-.8,Math.min(1.1,pitch+(e.clientY-drag[1])*.005));drag=[e.clientX,e.clientY]},{signal});renderer.domElement.addEventListener('pointerup',()=>drag=undefined,{signal})
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()},{signal})
document.addEventListener('visibilitychange',()=>{if(document.hidden){++generation;loading?.abort();release();renderer.dispose()}else load()},{signal})
window.addEventListener('pagehide',()=>{dead=true;++generation;loading?.abort();events.abort();cancelAnimationFrame(frame);release();ui.unmount();studyUi.unmount();renderer.dispose();renderer.forceContextLoss()},{once:true})
function animate(now){
 const dt=Math.min(.05,(now-last)/1000);last=now
 if(!document.hidden){if(runtime){runtime.update(dt,{forward:0,right:0},yaw,true,false,!paused);lighting?.apply('cockpit',runtime.cabinLight);const view=runtime.camera(yaw,pitch);if(view){camera.position.copy(view.position);camera.lookAt(view.target.x,view.target.y,view.target.z)}if(now-lastOutput>120){lastOutput=now;const s=runtime.snapshot();panel(s);document.getElementById('notice').textContent=s.notice;document.getElementById('diagnostics').textContent=JSON.stringify({position:s.position,posture:s.posture,contact:s.float.contact?.id,panel:s.devicePanel?.id,kit:s.equipment.kit,inspection:s.equipment.inspection,inspections:s.equipment.inspections,light:s.equipment.light,paused},null,2)}}renderer.render(scene,camera)}
 if(!dead)frame=requestAnimationFrame(animate)
}
frame=requestAnimationFrame(animate);load()
