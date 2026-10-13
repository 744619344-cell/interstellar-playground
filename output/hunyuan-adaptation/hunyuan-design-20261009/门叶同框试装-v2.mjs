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
for(const [p,i] of [[[0,2,2],2],[[0,2,6.3],1.6],[[-2,0,4],1]]){
 const light=new T.PointLight(0xffeedd,i*8,12,2);light.position.set(...p);scene.add(light);
}
const sun=new T.DirectionalLight(0xffffff,1.8);sun.position.set(3,4,0);scene.add(sun);
const aborter=new AbortController(),status=document.querySelector('#status'),roots=new Set();
let context,leaf,report,disposed=false;
const views={后舱近景:[[0,-.12,2.3],[0,-.2,4.94]],气闸反向:[[0,-.12,6.6],[0,-.2,4.94]],
 左接边:[[-.7,-.18,3.5],[-.77,-.15,5.12]],右接边:[[.7,-.18,3.5],[.77,-.15,5.12]],
 门槛:[[0,-1.05,3.6],[0,-1.52,5.12]],顶部:[[0,.4,3.55],[0,.81,5.12]]};
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
 const group=new T.Group();group.add(root);group.scale.setScalar(scale);group.rotation.y=Math.PI;
 group.position.fromArray(position);scene.add(group);return group;
}
function visibility(){
 if(leaf)leaf.visible=document.querySelector('#leaf').checked;
 if(context)context.visible=document.querySelector('#context').checked;
}
function fit(){
 if(!leaf)return;
 const mode=document.querySelector('#fit').value,v=report.trialVariants.find(r=>r.mode===mode);
 leaf.scale.setScalar(v.uniformScale);leaf.position.fromArray(v.placementCenter);
 const placement=document.querySelector('#placement').value;
 if(placement==='recess')leaf.position.z=5.06;
 status.textContent=`门叶v2原件 · ${v.displayBounds.map(n=>n.toFixed(3)).join(' × ')} m\n隔舱v15按内墙净宽3.410m摆放；门叶刚性定位${placement==='recess'?'槽深中部z=5.06':'背缘外对照'}，实际轮廓/相交仍需判定。`;
 document.body.dataset.fit=mode;document.body.dataset.placement=placement;document.body.dataset.loaded='true';visibility();
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
document.querySelector('#fit').onchange=fit;
document.querySelector('#placement').onchange=fit;
document.querySelector('#leaf').onchange=visibility;document.querySelector('#context').onchange=visibility;
document.querySelector('#fold').onclick=e=>{const c=document.body.classList.toggle('compact');e.target.textContent=c?'展开信息':'收起信息';};
function render(){controls.update();renderer.render(scene,camera);}
renderer.setAnimationLoop(document.hidden?null:render);
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});
addEventListener('visibilitychange',()=>{if(!disposed)renderer.setAnimationLoop(document.hidden?null:render);});
addEventListener('pagehide',()=>{disposed=true;aborter.abort();renderer.setAnimationLoop(null);roots.forEach(release);roots.clear();controls.dispose();renderer.dispose();},{once:true});
try{
 context=await original('../master-design-20261009/整舱统一母版-v6.glb');
 context.traverse(o=>{if(o.isMesh)o.visible=o.userData.part!=='hull'&&o.userData.module!=='exterior-glass'&&!o.name.startsWith('Door_Inner-')&&o.userData.module!=='airlock-inner-door';});
 scene.add(context);
 const frame=await original('./内门隔舱总成-v15/混元原始模型.glb');
 rigid(frame,3.6155457925316408,[0,-.23239027103582566,5.039291889101608]);
 report=await json('./内门门叶-v2/原始门叶检查.json');if(disposed)throw Error('检查页已退出');
 const rawLeaf=await original('./内门门叶-v2/混元原始模型.glb');
 leaf=rigid(rawLeaf,1,[0,0,0]);fit();view('后舱近景');
}catch(error){if(!disposed)status.textContent='加载失败：'+error.message;}
