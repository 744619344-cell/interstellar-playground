import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
document.body.append(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color('#101923');
const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
const environment=pmrem.fromScene(room);scene.environment=environment.texture;room.dispose();pmrem.dispose();
const camera=new THREE.PerspectiveCamera(64,innerWidth/innerHeight,.04,100);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
controls.minDistance=.25;controls.maxDistance=35;
scene.add(new THREE.HemisphereLight(0xd9e7ed,0x32302a,2));
const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(4,8,-5);scene.add(light);
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),models=[];
const output=document.querySelector('output');let active=0,view='cutaway',door=false,exterior;
window.interiorReview={ready:false,models:[],errors:[]};
function selection(){
 if(exterior)exterior.visible=view!=='cutaway';
 models.forEach((model,i)=>{model.visible=i===active;model.traverse(obj=>{
  if(obj.isMesh){obj.visible=!(view==='cutaway'&&/^(Ceiling|Walls)/.test(obj.name));
   if(obj.name==='Door_Inner')obj.visible=door;}
 });});
 const info=window.interiorReview.models[active];
 output.textContent=`LOD${active} · ${info.triangles.toLocaleString()} 三角面 · 内门${door?'显示':'隐藏（检查通道）'}`;
 document.querySelectorAll('[data-lod]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.lod)===active));
 document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===view));
 window.interiorReview.selection={lod:active,view,door};
}
const presets={cutaway:[[7,7,-8.5],[0,-.2,1]],cabin:[[0,.6,3.9],[0,0,-4.5]],
 cockpit:[[0,.6,-2.65],[0,-.1,-4.8]],airlock:[[-.35,.5,4.85],[.3,-.1,6.2]]};
function selectView(name){view=name;
 if(name==='pilot'){
  models[active].updateMatrixWorld(true);
  models[active].getObjectByName('Anchor_CockpitCamera').getWorldPosition(camera.position);
  controls.target.copy(camera.position).add(new THREE.Vector3(0,-.6,-1));
 }else{camera.position.fromArray(presets[name][0]);controls.target.fromArray(presets[name][1]);}
 controls.update();selection();}
try{
 exterior=(await loader.loadAsync('/src/assets/models/spacecraft-exterior-lod1.glb')).scene;
 exterior.traverse(obj=>{if(obj.name==='Canopy_Glass')obj.visible=false;});scene.add(exterior);
 for(let lod=0;lod<2;lod++){
  const {scene:model}=await loader.loadAsync(`/src/assets/models/spacecraft-interior-lod${lod}.glb`);
  let triangles=0,meshes=0;model.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;meshes++;}});
  scene.add(model);models.push(model);window.interiorReview.models.push({lod,triangles,meshes});
 }
 document.querySelectorAll('[data-lod]').forEach(b=>b.onclick=()=>{active=Number(b.dataset.lod);selection();});
 document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>selectView(b.dataset.view));
 document.querySelector('#door').onclick=()=>{door=!door;document.querySelector('#door').textContent=door?'隐藏内门':'显示内门';selection();};
 selectView('cutaway');window.interiorReview.ready=true;
}catch(error){output.textContent=String(error);window.interiorReview.errors.push(String(error));}
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);
 window.interiorReview.render={calls:renderer.info.render.calls,geometries:renderer.info.memory.geometries};});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);controls.dispose();const geometries=new Set(),materials=new Set();
 [...models,...(exterior?[exterior]:[])].forEach(model=>model.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);}}));
 geometries.forEach(x=>x.dispose());materials.forEach(x=>x.dispose());environment.dispose();renderer.dispose();
 window.interiorReview.disposal={geometries:renderer.info.memory.geometries};},{once:true});
