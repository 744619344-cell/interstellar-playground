import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {attachObservationMoves} from './驾驶围护观察移动.mjs';

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
let context,candidate,revised,report,disposed=false,adjusted=true;
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
 const group=new T.Group();group.add(root);group.scale.setScalar(scale);group.position.fromArray(position);scene.add(group);return group;
}
function visibility(){
 if(candidate)candidate.visible=!adjusted&&document.querySelector('#candidate').checked;
 if(revised)revised.visible=adjusted&&document.querySelector('#candidate').checked;
 if(context)context.visible=document.querySelector('#context').checked;
}
function mode(value){
 adjusted=value;visibility();
 document.querySelector('#original').setAttribute('aria-pressed',String(!adjusted));
 document.querySelector('#adjusted').setAttribute('aria-pressed',String(adjusted));
 document.body.dataset.finish=adjusted?'adjusted':'original';
 if(report)status.textContent=`第九版底稿 · ${report.trialPose.displayBounds.map(n=>n.toFixed(3)).join(' × ')} m\n${adjusted?'局部修订：前段顶棚过渡、两处小把手、两条嵌入顶灯和哑光涂层':'混元原件：保留原始形状与材质'}。\n整体舱体、地板和安装位置保留；完整碰撞、机构及用户美术待验。`;
}
function fit(){
 const p=report.trialPose;candidate.scale.setScalar(p.uniformScale);candidate.position.fromArray(p.placementCenter);
 candidate.rotation.y=p.rotationYDegrees*Math.PI/180;visibility();
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
document.querySelector('#original').onclick=()=>mode(false);document.querySelector('#adjusted').onclick=()=>mode(true);
document.querySelector('#candidate').onchange=visibility;document.querySelector('#context').onchange=visibility;
document.querySelector('#fold').onclick=e=>{const c=document.body.classList.toggle('compact');e.target.textContent=c?'展开信息':'收起信息';};
attachObservationMoves(camera,controls);
function render(){
 controls.update();renderer.render(scene,camera);
 document.body.dataset.camera=camera.position.toArray().map(n=>n.toFixed(5)).join(',');
 document.body.dataset.target=controls.target.toArray().map(n=>n.toFixed(5)).join(',');
}
renderer.setAnimationLoop(document.hidden?null:render);
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
function destroy(){
 if(disposed)return;
 disposed=true;aborter.abort();renderer.setAnimationLoop(null);roots.forEach(release);roots.clear();controls.dispose();renderer.dispose();
 document.body.dataset.released='true';
}
addEventListener('visibilitychange',()=>{
 if(document.hidden)destroy();else if(disposed)location.reload();else renderer.setAnimationLoop(render);
});
addEventListener('pagehide',destroy,{once:true});
addEventListener('pageshow',event=>{if(event.persisted&&disposed)location.reload();});
try{
 context=await original('../master-design-20261009/整舱统一母版-v6.glb');
 context.traverse(o=>{if(o.isMesh)o.visible=o.userData.part!=='hull'&&o.userData.module!=='exterior-glass'&&!/^(front-window-frame_|cockpit-floor_|cockpit-wall-left_|cockpit-wall-right_|cockpit-ceiling_)/.test(o.name);});
 scene.add(context);
 report=await json('./驾驶围护总成-v9/原始围护检查.json');if(disposed)throw Error('检查页已退出');
 const raw=await original('./驾驶围护总成-v9/混元原始模型.glb');candidate=rigid(raw,1,[0,0,0]);fit();
 const revisionRaw=await original('./局部调整-v9-20261012/围护v9-局部修订-r9.glb');
 revised=rigid(revisionRaw,report.trialPose.uniformScale,report.trialPose.placementCenter);
 revised.rotation.y=report.trialPose.rotationYDegrees*Math.PI/180;
 const windowPose=await json('./前窗总成-v2/实装观察结论.json');
 const windowOriginal=await original('./前窗总成-v2/混元原始模型.glb');
 rigid(windowOriginal,windowPose.uniformScale,windowPose.placementCenter);
 view('驾驶席');mode(adjusted);document.body.dataset.loaded='true';
}catch(error){if(!disposed)status.textContent='加载失败：'+error.message;}
