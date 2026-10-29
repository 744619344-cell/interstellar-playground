import * as T from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {loadMicrogravityAssembly} from '/src/features/space-exploration/rendering/spacecraft/microgravityAssembly.ts'
import {MicrogravityCabinRuntime} from '/src/features/space-exploration/rendering/spacecraft/microgravityCabinRuntime.ts'
import {createCabinFloat} from '/src/features/space-exploration/domain/cabinFloatMotion.ts'
import {disposeShipModel} from '/src/features/space-exploration/rendering/spacecraft/shipModelRuntime.ts'
import {ShipReviewLighting} from '/src/features/space-exploration/rendering/spacecraft/shipVisibility.ts'
import {ShipModelEnvironment} from '/src/features/space-exploration/rendering/spacecraft/shipModelEnvironment.ts'
import {installCabinClipRecorder} from '/src/features/space-exploration/rendering/solar-system/cabinClipRecorder.ts'
const scene=new T.Scene(),camera=new T.PerspectiveCamera(53,innerWidth/innerHeight,.025,100),renderer=new T.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true}),controls=new OrbitControls(camera,renderer.domElement),aborter=new AbortController(),signal=aborter.signal,environment=new ShipModelEnvironment(scene),state=document.querySelector('#state')
renderer.setPixelRatio(1.25);renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=.87;renderer.setClearColor('#111d28');document.body.append(renderer.domElement)
installCabinClipRecorder(renderer.domElement,document.querySelector('aside'),signal)
let model,runtime,lighting,loading,generation=0,seekToken=0,dead=false,frame,bed=2,view='front',ticks=0,playing=false,speed=1,last=0,accumulator=0
function status(){if(!runtime)return;const s=runtime.snapshot();state.textContent=`${bed}号床 · ${s.posture}\n时间 ${(ticks/60).toFixed(3)} 秒 / ${ticks}帧\n人物约束点 ${Object.values(s.position).map(n=>n.toFixed(4)).join(', ')}\n${s.notice}\n镜头 ${view}：${camera.position.toArray().map(n=>n.toFixed(3)).join(', ')}`}
function aim(){if(!runtime)return;controls.enabled=view!=='follow';if(view==='follow'){const v=runtime.camera(0,.15);if(v){camera.position.copy(v.position);camera.lookAt(new T.Vector3().copy(v.target))}return}
 const box=new T.Box3().setFromObject(model.getObjectByName(`micro-sleep-${bed}`),true),p=box.getCenter(new T.Vector3());p.x=-2.25;p.y=-.08
 const station=model.getObjectByName(`micro-sleep-${bed}`),sign=view==='right'?1:-1,offsets=view==='front'?[new T.Vector3(3.15,.08,.04)]:[[2.4,2.2],[2.8,1.35],[3,.9]].map(([x,z])=>new T.Vector3(x,.08,z*sign))
 const offset=offsets.find(o=>!runtime.surfaces.cast(p,p.clone().add(o),station))??offsets.at(-1)
 controls.target.copy(p);camera.position.copy(p).add(offset);controls.update();status()}
function step(count=1){if(!runtime)return;for(let i=0;i<count;i++){runtime.update(1/60,{forward:0,right:0},0,true,false,true);ticks++}if(view==='follow')aim();status()}
function start(){if(!model)return;++seekToken;runtime?.dispose();const box=new T.Box3().setFromObject(model.getObjectByName(`micro-sleep-${bed}`),true),p=box.getCenter(new T.Vector3());p.x=box.max.x+.45;p.y=.05
 runtime=new MicrogravityCabinRuntime(model,{float:createCabinFloat(p)});runtime.update(1/60,{forward:0,right:0},0,true,false,true);runtime.interact();ticks=0;accumulator=0;status();aim()}
async function advance(count,token=seekToken){for(let done=0;done<count;done+=12){if(token!==seekToken||!runtime)return false;step(Math.min(12,count-done));await new Promise(requestAnimationFrame)}return true}
async function seek(count){start();return advance(count)}
function release(){++seekToken;runtime?.dispose();runtime=undefined;lighting?.dispose();lighting=undefined;environment.dispose();if(model){scene.remove(model);disposeShipModel(model);model=undefined}}
async function load(){loading?.abort();loading=new AbortController();const task=loading,token=++generation;try{const asset=await loadMicrogravityAssembly(task.signal,disposeShipModel);if(dead||token!==generation){disposeShipModel(asset.scene);return}model=asset.scene;scene.add(model);lighting=new ShipReviewLighting([model]);lighting.apply('cockpit');scene.add(lighting.root);environment.ensure(renderer);start()}catch(e){if(!task.signal.aborted)state.textContent=e.message}}
for(const b of document.querySelectorAll('[data-bed]'))b.addEventListener('click',()=>{bed=Number(b.dataset.bed);playing=false;start()},{signal})
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{view=b.dataset.view;aim()},{signal})
for(const b of document.querySelectorAll('[data-time]'))b.addEventListener('click',()=>{playing=false;seek(Math.round(Number(b.dataset.time)*60))},{signal})
for(const b of document.querySelectorAll('[data-step]'))b.addEventListener('click',()=>{playing=false;step(Number(b.dataset.step))},{signal})
document.querySelector('#play').addEventListener('click',()=>{playing=!playing},{signal})
document.querySelector('#slow').addEventListener('click',e=>{speed=speed===1?.25:1;e.currentTarget.textContent=`速度：${speed===1?'正常':'四分之一'}`},{signal})
document.querySelector('#leave').addEventListener('click',()=>{runtime?.interact();status()},{signal})
document.querySelector('#cancel').addEventListener('click',()=>{runtime?.cancel(true);status()},{signal})
document.querySelector('#grasp').addEventListener('click',()=>{runtime?.key('KeyX',true);runtime?.key('KeyX',false);status()},{signal})
document.querySelector('#return-mid').addEventListener('click',async()=>{playing=false;if(await seek(216)){runtime.interact();await advance(84)}},{signal})
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()},{signal})
document.addEventListener('visibilitychange',()=>{playing=false;last=0;accumulator=0;if(document.hidden){++generation;loading?.abort();release();renderer.dispose()}else load()},{signal})
addEventListener('pagehide',()=>{dead=true;++generation;loading?.abort();aborter.abort();cancelAnimationFrame(frame);controls.dispose();release();renderer.dispose();renderer.forceContextLoss()},{once:true})
function draw(now){if(!document.hidden){if(playing&&runtime){accumulator+=Math.min(.05,(now-last)/1000)*speed;while(accumulator>=1/60){step();accumulator-=1/60}}if(view!=='follow')controls.update();renderer.render(scene,camera)}last=now;if(!dead)frame=requestAnimationFrame(draw)}
frame=requestAnimationFrame(draw);load()
