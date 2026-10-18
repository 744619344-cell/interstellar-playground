import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createPreviewAssets} from '../hunyuan-design-20261009/驾驶预览资源.mjs';
import {attachPreviewRuntime} from '../hunyuan-design-20261009/驾驶预览运行.mjs';
import {attachObservationMoves} from '../hunyuan-design-20261009/驾驶围护观察移动.mjs';

const views={left:[[-16,1.1,-4],[0,1.1,-4]],right:[[16,1.1,-4],[0,1.1,-4]],
 quarter:[[-12,7,-15],[0,0,-2]],front:[[0,3.8,-19],[0,.4,-4]],
 'cabin-detail-front':[[0,-.25,-12],[0,-.35,-3.7]],'cabin-detail-left':[[-9,.2,-11],[0,-.5,-3.7]]};

export async function start(){
 const host=document.querySelector('#interactive'),status=document.querySelector('#status');
 host.style.display='block';document.querySelector('#tools').style.display='flex';
 const renderer=new T.WebGLRenderer({antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.toneMapping=T.ACESFilmicToneMapping;
 host.append(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#718795');
 const camera=new T.PerspectiveCamera(42,host.clientWidth/host.clientHeight,.03,100);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
 const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();
 const environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;
 room.dispose();pmrem.dispose();
 scene.add(new T.HemisphereLight(0xffffff,0x5b7180,2));
 const light=new T.DirectionalLight(0xfff5e5,3);light.position.set(-6,10,-8);scene.add(light);
 for(const x of [-.9,.9]){
  const cabinLight=new T.PointLight(0xfff0df,18,10,2);cabinLight.position.set(x,0,-3.8);scene.add(cabinLight);
 }
 const events=new AbortController(),options={signal:events.signal};
 const assets=createPreviewAssets({parse:(bytes,path)=>new GLTFLoader().parseAsync(bytes,path),
  baseUrl:location.href,progress:(url,stage)=>{status.textContent=stage+'：'+decodeURI(url);}});
 const observation=attachObservationMoves(camera,controls);
 let source,candidate,version='candidate';
 function resize(){
  renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;
  camera.updateProjectionMatrix();
 }
 function view(name){camera.position.fromArray(views[name][0]);controls.target.fromArray(views[name][1]);controls.update();}
 function visibility(){
  const showShell=document.querySelector('#shell').checked,showGlass=document.querySelector('#glass').checked;
  const showContext=document.querySelector('#context').checked;
  for(const [name,root] of [['source',source],['candidate',candidate]]){
   if(!root)continue;root.visible=name===version;
   root.traverse(object=>{
    if(!object.isMesh)return;
    let owner=object;
    while(owner.parent&&!owner.userData.module)owner=owner.parent;
    const glass=object.material.name.startsWith('前挡与左右侧窗')||owner.userData.module==='exterior-glass';
    const hull=owner.userData.module==='exterior-hull';
    object.visible=glass?showGlass:hull?showShell:showContext;
   });
  }
 }
 const runtime=attachPreviewRuntime({renderer,controls,observation,resize,
  release:()=>{events.abort();assets.dispose();environment.dispose();},
  onFailure:error=>{status.textContent='预览失败：'+error.message;}});
 try{
  resize();
  source=await assets.original('./前挡玻璃-航天舷窗材质-r3.glb');
  candidate=await assets.original('./前挡玻璃-清晰透光-r5.glb');
  if(runtime.disposed)return;
  scene.add(source,candidate);visibility();view('cabin-detail-front');
  for(const button of document.querySelectorAll('[data-view]'))
   button.addEventListener('click',()=>view(button.dataset.view),options);
  for(const button of document.querySelectorAll('[data-version]'))button.addEventListener('click',()=>{
   version=button.dataset.version;visibility();
   document.querySelectorAll('[data-version]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  },options);
  for(const id of ['shell','glass','context'])document.querySelector('#'+id).addEventListener('change',visibility,options);
  status.textContent='修订候选已加载。上一版/清晰透光切换保留同一机位；可分别检查船壳、玻璃及原内舱。';
  let previous;
  runtime.start(time=>{
   const seconds=previous===undefined?0:Math.max(0,(time-previous)/1000);previous=time;
   observation.update(seconds);controls.update();renderer.render(scene,camera);
  });
 }catch(error){runtime.fail(error);throw error;}
}
