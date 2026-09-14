import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {MechanismPlayer} from './mechanismPlayer.mjs';
import {shareAtlasTextures,disposeAssets} from '../pbr/reviewTextures.mjs';
const assetKind=document.body.dataset.assets==='pbr'?'pbr':'mechanisms';
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#101923');
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
const environment=pmrem.fromScene(room);scene.environment=environment.texture;room.dispose();pmrem.dispose();
const environmentBaseline=renderer.info.memory.textures;
const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.035,100);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=.2;controls.maxDistance=40;
scene.add(new THREE.HemisphereLight(0xd9e7ed,0x32302a,2));
const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(4,8,10);scene.add(light);
const entries=[],output=document.querySelector('output'),message=document.querySelector('#message');
let active=0,view='rear',player,last=performance.now(),disposed=false;
const review=window.mechanismReview={ready:false,entries,manualClock:false,errors:[],environmentBaseline};
const presets={rear:[[12,7,17],[0,0,1]],portal:[[4,2.6,13],[0,-.1,7.3]],
 inner:[[0,.4,2.8],[0,-.2,5.8]],cutaway:[[8,9,12],[0,-.1,0]]};
function selection(){
 entries.forEach(({scene:model},i)=>{model.visible=i===active;model.traverse(o=>{
  if(o.isMesh)o.visible=!(view==='cutaway'&&/^(Exterior_|Canopy|Ceiling|Walls|AftFrame)/.test(o.name));
 });});
 document.querySelectorAll('[data-lod]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.lod)===active));
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===view));
 review.selection={lod:active,view};
}
function selectView(name){
 view=name;
 if(name==='pilot'){
  entries[active].scene.updateMatrixWorld(true);
  entries[active].scene.getObjectByName('Anchor_CockpitCamera').getWorldPosition(camera.position);
  controls.target.copy(camera.position).add(new THREE.Vector3(0,-.6,-1));
 }else{camera.position.fromArray(presets[name][0]);controls.target.fromArray(presets[name][1]);}
 controls.update();selection();
}
function status(){
 for(const name of ['console','thrust'])document.querySelector('#'+name).setAttribute('aria-pressed',player[name]);
 document.querySelector('#pause').textContent=player.paused?'继续':'暂停';
 output.textContent=`LOD${active} · 外门 ${Math.round(player.doors.outer.progress*100)}% · 内门 ${Math.round(player.doors.inner.progress*100)}%${player.paused?' · 已暂停':''}`;
}
function bind(){
 document.querySelectorAll('[data-lod]').forEach(b=>b.onclick=()=>{active=Number(b.dataset.lod);selection();});
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>selectView(b.dataset.view));
 document.querySelectorAll('[data-door]').forEach(b=>b.onclick=()=>{
  message.textContent=player.commandDoor(b.dataset.door,b.dataset.open==='1')?'':'请先完全关闭另一扇门。';
 });
 for(const name of ['console','thrust'])document.querySelector('#'+name).onclick=()=>{player[name]=!player[name];player.apply();};
 document.querySelector('#pause').onclick=()=>{player.paused=!player.paused;last=performance.now();};
 document.querySelector('#reset').onclick=()=>{player.reset();player.suspended=document.hidden;message.textContent='';last=performance.now();};
}
document.addEventListener('visibilitychange',visibility);addEventListener('resize',resize);
addEventListener('pagehide',destroyReview,{once:true});
try{
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 for(let lod=0;lod<2;lod++){
  const entry=await loader.loadAsync(`/src/assets/models/spacecraft-${assetKind}-lod${lod}.glb`);
  if(disposed){disposeAssets([entry]);review.discardedLoads=(review.discardedLoads||0)+1;throw new Error('Preview disposed');}
  entries.push(entry);scene.add(entry.scene);
 }
 review.textures=shareAtlasTextures(entries);
 player=new MechanismPlayer(entries);player.suspended=document.hidden;review.player=player;
 bind();selectView('rear');review.ready=true;
}catch(error){if(!disposed){output.textContent=String(error);review.errors.push(String(error));}}
if(!disposed)renderer.setAnimationLoop(now=>{
 const delta=(now-last)/1000;last=now;
 if(player){if(!review.manualClock)player.update(delta);status();}
 controls.update();renderer.render(scene,camera);
 review.render={calls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};
});
function visibility(){last=performance.now();if(player)player.suspended=document.hidden;}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}
function destroyReview(){
 if(disposed)return;disposed=true;renderer.setAnimationLoop(null);player?.dispose();controls.dispose();
 document.removeEventListener('visibilitychange',visibility);removeEventListener('resize',resize);
 disposeAssets(entries);
 environment.dispose();renderer.dispose();renderer.forceContextLoss();
 review.disposal={geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,
  contextLost:renderer.getContext().isContextLost()};
}
