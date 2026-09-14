import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {ShipVisibility,ShipReviewLighting} from '/src/features/space-exploration/rendering/spacecraft/shipVisibility.ts';
import {MechanismPlayer} from '../mechanisms/mechanismPlayer.mjs';
import {shareAtlasTextures,disposeAssets} from '../pbr/reviewTextures.mjs';
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.setSize(innerWidth,innerHeight);document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#101923');
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room);
scene.environment=environment.texture;room.dispose();pmrem.dispose();
const camera=new THREE.PerspectiveCamera(64,innerWidth/innerHeight,.035,100),controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.enablePan=false;
const entries=[],visibility=[],output=document.querySelector('output'),message=document.querySelector('#message');
const review=window.visibilityReview={ready:false,errors:[],manualClock:false};
let player,lights,active=0,view='exterior',disposed=false,last=performance.now();
const presets={exterior:[[12,7,17],[0,0,1]],cabin:[[0,.45,0],[0,.1,4.65]],
 airlock:[[0,.45,5.3],[0,0,7.5]],cutaway:[[8,9,12],[0,-.1,0]]};
function apply(){
 const state={view,outerOpen:player.doors.outer.progress>0,innerOpen:player.doors.inner.progress>0};
 entries.forEach((entry,i)=>{entry.scene.visible=i===active;visibility[i].apply(state);});lights.apply(view);
 review.state={...state,lod:active,...visibility[active].snapshot(),doors:structuredClone(player.doors),paused:player.paused};
 output.textContent=`LOD${active} · ${review.state.triangles.toLocaleString()} 可见三角面 · ${review.state.meshes} 个网格`;
 document.querySelector('#pause').textContent=player.paused?'继续':'暂停';
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===view));
 document.querySelectorAll('[data-lod]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.lod)===active));
}
function select(name){
 view=name;controls.enableRotate=controls.enableZoom=['exterior','cutaway'].includes(view);
 if(view==='cockpit'){
  entries[active].scene.updateMatrixWorld(true);entries[active].scene.getObjectByName('Anchor_CockpitCamera').getWorldPosition(camera.position);
  controls.target.copy(camera.position).add(new THREE.Vector3(0,-.6,-1));
 }else{camera.position.fromArray(presets[view][0]);controls.target.fromArray(presets[view][1]);}
 controls.update();apply();
}
function hidden(){last=performance.now();if(player)player.suspended=document.hidden;}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
function destroy(){
 if(disposed)return;disposed=true;renderer.setAnimationLoop(null);controls.dispose();player?.dispose();lights?.dispose();
 visibility.forEach(v=>v.dispose());disposeAssets(entries);environment.dispose();renderer.dispose();renderer.forceContextLoss();
 document.removeEventListener('visibilitychange',hidden);removeEventListener('resize',resize);
 review.disposal={...renderer.info.memory,contextLost:renderer.getContext().isContextLost()};
}
addEventListener('pagehide',destroy,{once:true});addEventListener('resize',resize);document.addEventListener('visibilitychange',hidden);
try{
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 for(let lod=0;lod<2;lod++){
  const entry=await loader.loadAsync(`/src/assets/models/spacecraft-pbr-lod${lod}.glb`);
  if(disposed){disposeAssets([entry]);throw new Error('Preview disposed');}
  entries.push(entry);scene.add(entry.scene);visibility.push(new ShipVisibility(entry.scene));
 }
 shareAtlasTextures(entries);lights=new ShipReviewLighting(entries.map(e=>e.scene));scene.add(lights.root);
 player=new MechanismPlayer(entries);player.suspended=document.hidden;review.player=player;
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>select(b.dataset.view));
 document.querySelectorAll('[data-lod]').forEach(b=>b.onclick=()=>{active=Number(b.dataset.lod);apply();});
 document.querySelectorAll('[data-door]').forEach(b=>b.onclick=()=>{const name=b.dataset.door;
  message.textContent=player.commandDoor(name,player.doors[name].target===0)?'':'请先完全关闭另一扇门。';apply();});
 document.querySelector('#pause').onclick=()=>{player.paused=!player.paused;apply();};
 document.querySelector('#reset').onclick=()=>{player.reset();player.suspended=document.hidden;message.textContent='';select('exterior');};
 select('exterior');review.ready=true;
}catch(error){if(!disposed){review.errors.push(String(error));output.textContent=String(error);}}
if(!disposed)renderer.setAnimationLoop(now=>{if(player){if(!review.manualClock)player.update((now-last)/1000);apply();}
 last=now;controls.update();renderer.render(scene,camera);review.render={...renderer.info.memory,calls:renderer.info.render.calls};});
