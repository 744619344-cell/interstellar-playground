import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#17354c');
const camera=new T.PerspectiveCamera(65,innerWidth/innerHeight,.01,60);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
scene.add(new T.HemisphereLight(0xffffff,0x6d7884,2));
for(const [p,i] of [[[0,1,-3.5],2],[[0,1,-7],1.6],[[-2,0,-4],1]]){
 const light=new T.PointLight(0xffeedd,i*8,12,2);light.position.set(...p);scene.add(light);
}
const sun=new T.DirectionalLight(0xffffff,1.8);sun.position.set(3,4,0);scene.add(sun);
const aborter=new AbortController(),status=document.querySelector('#status'),roots=new Set();
let context,candidate,report,disposed=false;
const views={驾驶席:[[0,-.65,-3.2],[0,-.65,-5.9]],背面:[[0,-.65,-7.5],[0,-.65,-5.9]],
 左接边:[[-.65,-.65,-4.15],[-1.55,-.55,-5.9]],右接边:[[.65,-.65,-4.15],[1.55,-.55,-5.9]],
 地面过渡:[[0,-1.15,-4.3],[0,-1.5,-5.9]],顶棚过渡:[[0,-.2,-4.45],[0,.25,-5.9]],
 后舱接边:[[0,-.4,-1.5],[0,-.35,-2.6]],侧面总览:[[7,3,-1],[0,-.1,-3.5]]};
function view(name){camera.position.fromArray(views[name][0]);controls.target.fromArray(views[name][1]);controls.update();document.body.dataset.view=name;}
function release(root){
 const geometries=new Set(),materials=new Set(),textures=new Set(),images=new Set();
 root?.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);[].concat(o.material).forEach(m=>materials.add(m));}});
 materials.forEach(m=>Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);}));
 textures.forEach(t=>{if(t.image)images.add(t.image);t.dispose();});images.forEach(i=>i.close?.());
 materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());root?.removeFromParent();
}
async function json(url){
 const response=await fetch(url,{signal:aborter.signal});if(!response.ok)throw Error('检查记录读取失败');return response.json();
}
async function original(url){
 const response=await fetch(url,{signal:aborter.signal});if(!response.ok)throw Error('原始文件读取失败');
 const bytes=await response.arrayBuffer();if(disposed)throw Error('检查页已退出');
 const asset=await new GLTFLoader().parseAsync(bytes,new URL('.',new URL(url,location.href)).href);
 if(disposed){release(asset.scene);throw Error('检查页已退出');}roots.add(asset.scene);return asset.scene;
}
function rigid(root,scale,position){
 const center=new T.Box3().setFromObject(root).getCenter(new T.Vector3());root.position.sub(center);
 const group=new T.Group();group.add(root);group.scale.setScalar(scale);group.rotation.y=0;
 group.position.fromArray(position);scene.add(group);return group;
}
function visibility(){
 if(candidate)candidate.visible=document.querySelector('#candidate').checked;
 if(context)context.visible=document.querySelector('#context').checked;
}
function fit(){
 if(!candidate)return;
 const p=report.trialPose;candidate.scale.setScalar(p.uniformScale);candidate.position.fromArray(p.placementCenter);
 candidate.rotation.y=p.rotationYDegrees*Math.PI/180;
 status.textContent=`围护v9原件 · ${p.displayBounds.map(n=>n.toFixed(3)).join(' × ')} m\n低前端z=-5.90、有限地板面y=-1.5449；空腔和前窗接边均待判定。`;
 document.body.dataset.loaded='true';visibility();
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));




document.querySelector('#candidate').onchange=visibility;document.querySelector('#context').onchange=visibility;
document.querySelector('#fold').onclick=e=>{const c=document.body.classList.toggle('compact');e.target.textContent=c?'展开信息':'收起信息';};
function render(){controls.update();renderer.render(scene,camera);}
renderer.setAnimationLoop(document.hidden?null:render);
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
addEventListener('visibilitychange',()=>{if(!disposed)renderer.setAnimationLoop(document.hidden?null:render);});
addEventListener('pagehide',()=>{disposed=true;aborter.abort();renderer.setAnimationLoop(null);roots.forEach(release);roots.clear();controls.dispose();renderer.dispose();},{once:true});
try{
 context=await original('../master-design-20261009/整舱统一母版-v6.glb');
 context.traverse(o=>{if(o.isMesh)o.visible=o.userData.part!=='hull'&&o.userData.module!=='exterior-glass'&&!/^(front-window-frame_|cockpit-floor_|cockpit-wall-left_|cockpit-wall-right_|cockpit-ceiling_)/.test(o.name);});
 scene.add(context);
 report=await json('./驾驶围护总成-v9/原始围护检查.json');if(disposed)throw Error('检查页已退出');
 const rawWindow=await original('./驾驶围护总成-v9/混元原始模型.glb');
 candidate=rigid(rawWindow,1,[0,0,0]);fit();
 const windowPose=await json('./前窗总成-v2/实装观察结论.json');
 const windowOriginal=await original('./前窗总成-v2/混元原始模型.glb');
 rigid(windowOriginal,windowPose.uniformScale,windowPose.placementCenter);view('驾驶席');
}catch(error){if(!disposed)status.textContent='加载失败：'+error.message;}
