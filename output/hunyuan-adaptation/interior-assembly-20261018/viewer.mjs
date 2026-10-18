import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createPreviewAssets} from '../hunyuan-design-20261009/驾驶预览资源.mjs';
import {attachPreviewRuntime} from '../hunyuan-design-20261009/驾驶预览运行.mjs';
import {attachObservationMoves} from '../hunyuan-design-20261009/驾驶围护观察移动.mjs';

const views={cockpit:[[0,.1,-1.65],[0,-.5,-5.25]],aft:[[0,-.12,-2.6],[0,-.3,4.2]],
 forward:[[0,-.05,3.9],[0,-.35,-4.5]],beds:[[.5,-.1,1.7],[-2.85,-1.02,1.4]],
 workbench:[[-.3,-.1,1.8],[2.75,-1.08,1.3]],exterior:[[14,8,-18],[0,0,0]]};

function moduleOf(object){
 let owner=object;
 while(owner.parent&&!owner.userData.module)owner=owner.parent;
 return owner.userData.module;
}

function instance(original,row){
 const root=original.clone(true),remove=[];
 if(row.modules)root.traverse(object=>{
  if(object.isMesh&&!row.modules.includes(moduleOf(object)))remove.push(object);
 });
 remove.forEach(object=>object.removeFromParent());
 const centered=new T.Group();centered.position.fromArray(row.sourceCenter).negate();centered.add(root);
 const placed=new T.Group();placed.add(centered);placed.scale.setScalar(row.uniformScale);
 placed.rotation.y=T.MathUtils.degToRad(row.rotationYDegrees);placed.position.fromArray(row.placementCenter);
 return placed;
}

export async function start(){
 const host=document.querySelector('#interactive'),status=document.querySelector('#status');
 host.style.display='block';document.querySelector('#tools').style.display='flex';
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
 renderer.toneMapping=T.ACESFilmicToneMapping;host.append(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#718795');
 const camera=new T.PerspectiveCamera(64,1,.03,150),controls=new OrbitControls(camera,renderer.domElement);
 controls.enableDamping=true;
 const observation=attachObservationMoves(camera,controls),events=new AbortController(),options={signal:events.signal};
 const assets=createPreviewAssets({parse:(bytes,path)=>new GLTFLoader().parseAsync(bytes,path),baseUrl:location.href,
  progress:(url,stage)=>{status.textContent=stage+'：'+decodeURI(url);}});
 const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();
 const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
 const originals=new Map(),groups=new Map();
 const hemi=new T.HemisphereLight(0xffffff,0x5b7180,1.5);scene.add(hemi);
 const sun=new T.DirectionalLight(0xfff5e5,3);sun.position.set(-6,10,-8);scene.add(sun);
 function resize(){renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();}
 function view(name){camera.position.fromArray(views[name][0]);controls.target.fromArray(views[name][1]);controls.update();}
 function visibility(){
  for(const [id,group] of groups){
   if(id==='exterior')group.traverse(object=>{
    if(!object.isMesh)return;
    const glass=moduleOf(object)==='exterior-glass'||[].concat(object.material).some(m=>m.name.startsWith('前挡与左右侧窗'));
    object.visible=document.querySelector(glass?'#glass':'#shell').checked;
   });
   else group.visible=document.querySelector(id==='cabin'?'#cabin':'#furniture').checked;
  }
 }
 const runtime=attachPreviewRuntime({renderer,controls,observation,resize,
  release:()=>{events.abort();assets.dispose();environment.dispose();scene.clear();originals.clear();groups.clear();},
  onFailure:error=>{status.textContent='预览失败：'+error.message;}});
 try{
  const manifest=await assets.json('./assembly-v2.json');if(runtime.disposed)return;
  for(const row of manifest.reviewLights){
   const light=new T.PointLight(new T.Color(...row.color),row.watts,0,2);light.position.fromArray(row.position);scene.add(light);
  }
  for(const row of manifest.sources){
   let original=originals.get(row.source);
   if(!original){original=await assets.original('../../../'+row.source);if(runtime.disposed)return;originals.set(row.source,original);}
   const group=instance(original,row);groups.set(row.id,group);scene.add(group);
  }
  if(runtime.disposed)return;
  resize();visibility();view('aft');
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>view(button.dataset.view),options));
  document.querySelectorAll('#tools input').forEach(input=>input.addEventListener('change',visibility,options));
  status.textContent='真实原件试装；拖拽旋转、右键平移、滚轮缩放，WASD / 方向键移动，Q / E 升降。取消外壳仅为显式诊断。';
  let previous;
  runtime.start(time=>{const seconds=previous===undefined?0:Math.max(0,(time-previous)/1000);previous=time;
   observation.update(seconds);controls.update();renderer.render(scene,camera);
  });
 }catch(error){runtime.fail(error);throw error;}
}
