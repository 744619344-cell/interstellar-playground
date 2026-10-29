import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {attachObservationMoves} from './驾驶围护观察移动.mjs';
import {attachContextLayout} from './驾驶围护参照布局.mjs';
import {loadCockpitSeparation} from './驾驶隔离装配.mjs';
import {loadSideConsoles} from './驾驶侧台装配.mjs';
import {attachShipAssembly} from './整船来源显示.mjs';
import {createPreviewAssets} from './驾驶预览资源.mjs';
import {attachPreviewRuntime} from './驾驶预览运行.mjs';
import {attachPreviewLoading} from './驾驶预览加载状态.mjs';
import {attachRetainedExterior,RETAINED_EXTERIOR_SOURCE} from './保留外部来源.mjs';

const loading=attachPreviewLoading();
function createRenderer(){
 try{return new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});}
 catch(error){loading.fail(new Error('无法启动3D预览：'+error.message));throw error;}
}
const renderer=createRenderer();
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement);
const scene=new T.Scene();scene.background=new T.Color('#17354c');
const camera=new T.PerspectiveCamera(65,innerWidth/innerHeight,.01,60);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
controls.minDistance=.08;controls.maxDistance=40;
scene.add(new T.HemisphereLight(0xffffff,0x6d7884,2));
for(const [p,i] of [[[0,1,-3.5],2],[[0,1,-7],1.6],[[-2,0,-4],1]]){
 const light=new T.PointLight(0xffeedd,i*8,12,2);light.position.set(...p);scene.add(light);
}
const sun=new T.DirectionalLight(0xffffff,1.8);sun.position.set(3,4,0);scene.add(sun);
const status=document.querySelector('#status');
const assets=createPreviewAssets({baseUrl:location.href,parse:(bytes,path)=>new GLTFLoader().parseAsync(bytes,path),progress:loading.progress});
const {json,original}=assets;
document.querySelector('#hide-panel').onclick=()=>document.body.classList.add('clean');
document.querySelector('#restore-panel').onclick=()=>document.body.classList.remove('clean');
const requestedRevision=new URLSearchParams(location.search).get('revision');
const mainVersion=new URLSearchParams(location.search).get('console')==='v1'?'v1':'v2';
document.body.dataset.mainConsole=mainVersion;
const consoleLink=document.querySelector('#console-version-link');
if(consoleLink){
 const url=new URL(location.href);url.searchParams.set('console',mainVersion==='v2'?'v1':'v2');
 consoleLink.href=url.pathname+url.search;
 consoleLink.textContent=mainVersion==='v2'?'对照旧主仪表台 v1':'返回集成双握把主仪表台 v2';
}
const revision=['r9','r10','r11','r12','r14','r15','r16','r17'].includes(requestedRevision)?requestedRevision:'r13';
const imageRevision=['r15','r16','r17'].includes(revision);
const revisionLink=document.querySelector('#revision-link');
if(revisionLink){
 revisionLink.textContent=revision==='r14'||imageRevision?'返回保留底稿 r13':revision==='r13'?'对照肩角修订前':'返回最新局部修订';
 revisionLink.href=revision==='r14'||imageRevision?'?revision=r13':revision==='r13'?'?revision=r11':'?revision=r13';
}
document.body.dataset.revision=revision;
let context,candidate,revised,report,adjusted=true;
let releaseLayout=()=>{};
let shipAssembly;
let retainedExterior;
const replacements=[];
const normalDetails=[];
const coatingDetails=[];
let coating=true;
function coatingMode(value){
 coating=value;
 coatingDetails.forEach(({material,map,before})=>{normalDetails.find(row=>row.material===material).map=value?map:before;});
 normalDetail();mode(true);document.body.dataset.coating=value?'image-candidate':'r13-source';
 for(const [id,active] of [['coating-before',!value],['coating-after',value]])document.querySelector('#'+id)?.setAttribute('aria-pressed',String(active));
}
for(const [id,value] of [['coating-before',false],['coating-after',true]]){
 const button=document.querySelector('#'+id);if(button){button.hidden=!imageRevision;button.setAttribute('aria-pressed',String(value));button.onclick=()=>coatingMode(value);}
}
function normalDetail(){
 const enabled=document.querySelector('#normal-detail')?.checked??true;
 const colorEnabled=document.querySelector('#color-detail')?.checked??true;
 normalDetails.forEach(({material,scale,map,flatShading,vertexColors})=>{
  if(scale)material.normalScale.copy(scale).multiplyScalar(enabled?1:0);
  const selected=colorEnabled?map:null;if(material.map!==selected){material.map=selected;material.needsUpdate=true;}
  const flat=colorEnabled?flatShading:true;if(material.flatShading!==flat){material.flatShading=flat;material.needsUpdate=true;}
  const colors=colorEnabled?vertexColors:false;if(material.vertexColors!==colors){material.vertexColors=colors;material.needsUpdate=true;}
 });
 document.body.dataset.normalDetail=enabled?'source':'disabled-diagnostic';
 document.querySelector('#adjusted').textContent=!colorEnabled?'无颜色诊断':enabled?'局部修订':'无凹凸诊断';
}
document.querySelector('#normal-detail').onchange=normalDetail;
document.querySelector('#color-detail').onchange=normalDetail;
const views={驾驶席:[[0,-.65,-3.2],[0,-.65,-5.9]],背面:[[0,-.65,-7.5],[0,-.65,-5.9]],
 左接边:[[-.65,-.65,-4.15],[-1.55,-.55,-5.9]],右接边:[[.65,-.65,-4.15],[1.55,-.55,-5.9]],
 地面过渡:[[0,-1.15,-4.3],[0,-1.5,-5.9]],顶棚过渡:[[0,-.2,-4.45],[0,.25,-5.9]],
 左肩角近景:[[-.85,-.07,-5.18],[-1.51,.212,-5.85]],右肩角近景:[[.85,-.07,-5.18],[1.51,.212,-5.85]],
 后舱接边:[[0,-.4,-1.5],[0,-.35,-2.6]],侧面总览:[[7,3,-1],[0,-.1,-3.5]]};
views.设备俯视=[[0,.30,-3.65],[0,-.90,-4.14]];
views.后舱总览=[[0,-.35,4.25],[0,-.55,-3.4]];
views.折叠床近景=[[.1,-.48,1.3],[-1.35,-1.0,-.25]];
views.工作台近景=[[-.15,-.35,.6],[1.35,-1.0,-.45]];
views.驾驶隔舱前侧=[[0,-.10,-4.8],[0,-.25,-2.55]];
views.驾驶隔舱后侧=[[0,-.20,.4],[0,-.25,-2.55]];
views.左侧过道=[[-1.35,-.10,-3.05],[-1.35,-1.15,-4.4]];
views.右侧过道=[[1.35,-.10,-3.05],[1.35,-1.15,-4.4]];
views.座椅通路总览=[[0,.45,-2.70],[0,-.90,-4.35]];
views.整船外观=[[16,9,-17],[0,0,0]];
views.整船侧面=[[19,3,0],[0,0,0]];
views.整船后方=[[12,7,17],[0,0,0]];
views.驾驶眼位=[[-.65,-.18,-3.84],[-.65,-.18,-6.05]];
function view(name){observation.clear();camera.position.fromArray(views[name][0]);controls.target.fromArray(views[name][1]);controls.update();document.body.dataset.view=name;}
function rigid(root,scale,position){
 const center=new T.Box3().setFromObject(root).getCenter(new T.Vector3());root.position.sub(center);
 const group=new T.Group();group.add(root);group.scale.setScalar(scale);group.position.fromArray(position);scene.add(group);return group;
}
function visibility(){
 if(candidate)candidate.visible=!adjusted&&document.querySelector('#candidate').checked;
 if(revised)revised.visible=adjusted&&document.querySelector('#candidate').checked;
 if(context)context.visible=document.querySelector('#context').checked;
 shipAssembly?.apply({interior:document.querySelector('#context').checked,
  exterior:false,glass:false,
  legacy:document.querySelector('#context-layout')?.value==='legacy',replacements});
 retainedExterior?.apply({exterior:document.querySelector('#exterior').checked,glass:document.querySelector('#glazing').checked});
 replacements.flatMap(row=>row.instances).forEach(object=>{object.visible=document.querySelector('#context').checked&&document.querySelector('#context-layout')?.value!=='legacy';});
}
function mode(value){
 adjusted=value;visibility();
 document.querySelector('#original').setAttribute('aria-pressed',String(!adjusted));
 document.querySelector('#adjusted').setAttribute('aria-pressed',String(adjusted));
 document.body.dataset.finish=adjusted?'adjusted':'original';
 if(report)status.textContent=`第九版底稿 · 局部${revision} · ${report.trialPose.displayBounds.map(n=>n.toFixed(3)).join(' × ')} m\n${adjusted?'局部修订：前段顶棚过渡、两处小把手、两条嵌入顶灯和哑光涂层':'混元原件：保留原始形状与材质'}。\n整体舱体、地板和安装位置保留；完整碰撞、机构及用户美术待验。`;
 if(report&&imageRevision&&adjusted)status.textContent+=`\n接口图像候选未通过，仅对照 · 当前${coating?'候选颜色':'r13原材质'} · 几何沿用r13。`;
}
function fit(){
 const p=report.trialPose;candidate.scale.setScalar(p.uniformScale);candidate.position.fromArray(p.placementCenter);
 candidate.rotation.y=p.rotationYDegrees*Math.PI/180;visibility();
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
document.querySelector('#original').onclick=()=>mode(false);document.querySelector('#adjusted').onclick=()=>mode(true);
document.querySelector('#candidate').onchange=visibility;document.querySelector('#context').onchange=visibility;
document.querySelector('#exterior').onchange=visibility;document.querySelector('#glazing').onchange=visibility;
document.querySelector('#fold').onclick=e=>{const c=document.body.classList.toggle('compact');e.target.textContent=c?'展开信息':'收起信息';};
let runtime;
const observation=attachObservationMoves(camera,controls,{isReady:()=>runtime?.ready??false});
let lastFrame;
function render(time){
 observation.update(lastFrame===undefined?0:(time-lastFrame)/1000);lastFrame=time;
 controls.update();renderer.render(scene,camera);
 document.body.dataset.camera=camera.position.toArray().map(n=>n.toFixed(5)).join(',');
 document.body.dataset.target=controls.target.toArray().map(n=>n.toFixed(5)).join(',');
}
function release(){
 try{
  releaseLayout();shipAssembly?.dispose();retainedExterior?.dispose();
  replacements.flatMap(row=>row.instances).forEach(object=>object.removeFromParent());
  coatingDetails.forEach(({material,map})=>{const detail=normalDetails.find(row=>row.material===material);if(detail)detail.map=map;});
  normalDetails.forEach(({material,scale,map,flatShading,vertexColors})=>{material.map=map;material.flatShading=flatShading;material.vertexColors=vertexColors;if(scale)material.normalScale.copy(scale);});
 }finally{
  try{assets.dispose();}finally{
   scene.clear();replacements.length=0;normalDetails.length=0;coatingDetails.length=0;
   context=candidate=revised=report=shipAssembly=retainedExterior=undefined;releaseLayout=()=>{};
  }
 }
}
runtime=attachPreviewRuntime({renderer,controls,observation,release,onFailure:loading.fail,
 resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}});
try{
 context=await original('../master-design-20261009/整舱统一母版-v6.glb');
 context.traverse(o=>{if(o.isMesh)o.visible=o.userData.part!=='hull'&&o.userData.module!=='exterior-glass'&&!/^(front-window-frame_|cockpit-floor_|cockpit-wall-left_|cockpit-wall-right_|cockpit-ceiling_)/.test(o.name);});
 scene.add(context);
 shipAssembly=attachShipAssembly({context,rigid});
 retainedExterior=attachRetainedExterior({root:await original(RETAINED_EXTERIOR_SOURCE),scene});
 const centerReport=await json('./内舱装配-20261013/中央台-v1/原始模型检查.json');
 const centerRaw=await original('./内舱装配-20261013/中央台-v1/混元原始模型.glb');
 const centerScale=.78/centerReport.dimensions[1];
 const centerReplacement=rigid(centerRaw,centerScale,[0,-1.541+.78/2,-4.06]);
 const mainReport=await json(`./内舱装配-20261013/主仪表台-${mainVersion}/原始模型检查.json`);
 const mainRaw=await original(`./内舱装配-20261013/主仪表台-${mainVersion}/混元原始模型.glb`);
 const mainScale=2.30/mainReport.dimensions[0];
 const mainReplacement=rigid(mainRaw,mainScale,[0,-1.541+mainReport.dimensions[1]*mainScale/2,-4.97]);
 replacements.push({modules:['center-console','throttle'],instances:[centerReplacement],label:'中央台'},
  {modules:['main-console'],instances:[mainReplacement],label:mainVersion==='v2'?'主仪表台v2（集成双握把）':'主仪表台v1（旧版对照）'});
 const bedReport=await json('./内舱装配-20261013/折叠床-v1/原始模型检查.json');
 const bedRaw=await original('./内舱装配-20261013/折叠床-v1/混元原始模型.glb');
 const bedScale=1.93/bedReport.dimensions[0];
 const bedFirst=rigid(bedRaw,bedScale,[-1.385,-1.10,-.25]);bedFirst.rotation.y=Math.PI/2;
 const bedSecond=bedFirst.clone(true);bedSecond.position.z=2.05;scene.add(bedSecond);
 replacements.push({modules:['folding-berth'],instances:[bedFirst,bedSecond],label:'两张长边壁挂床'});
 const workReport=await json('./内舱装配-20261013/工作台-v1/原始模型检查.json');
 const workRaw=await original('./内舱装配-20261013/工作台-v1/混元原始模型.glb');
 const workScale=1.32/workReport.dimensions[0];
 const workGroup=rigid(workRaw,workScale,[1.353,-1.562+workReport.dimensions[1]*workScale/2,-.45]);workGroup.rotation.y=-Math.PI/2;
 replacements.push({modules:['rear-workbench'],instances:[workGroup],label:'后舱工作台'});
 replacements.push(await loadSideConsoles({original,rigid,json}));
 replacements.push(await loadCockpitSeparation({original,rigid}));
 releaseLayout=attachContextLayout(context,{replacements,onChange:visibility});
 report=await json('./驾驶围护总成-v9/原始围护检查.json');
 const raw=await original('./驾驶围护总成-v9/混元原始模型.glb');candidate=rigid(raw,1,[0,0,0]);fit();
 const revisionRaw=await original(`./局部调整-v9-20261012/围护v9-局部修订-${revision}.glb`);
 revised=rigid(revisionRaw,report.trialPose.uniformScale,report.trialPose.placementCenter);
 const seenMaterials=new Set();
 revisionRaw.traverse(o=>{if(o.isMesh)[].concat(o.material).forEach(material=>{
  if((material.normalMap||material.map||material.vertexColors)&&!seenMaterials.has(material)){seenMaterials.add(material);normalDetails.push({material,scale:material.normalMap?material.normalScale.clone():null,map:material.map,flatShading:material.flatShading,vertexColors:material.vertexColors});}
 });});
 if(imageRevision){
  const name=`Scoped imagegen interface candidate ${revision}`;
  const baseline=normalDetails.find(row=>row.material.name!==name&&row.map)?.map;
  if(!baseline)throw Error('缺少r13对照贴图');
  normalDetails.filter(row=>row.material.name===name).forEach(({material,map})=>coatingDetails.push({material,map,before:baseline}));
  if(coatingDetails.length!==1)throw Error('接口候选材质数量不符');
 }
 normalDetail();document.body.dataset.coating=imageRevision?'image-candidate':'source-material';
 revised.rotation.y=report.trialPose.rotationYDegrees*Math.PI/180;
 // Keep the retained r10 exterior assembly as the sole canopy/front-window source.
 view('整船外观');mode(adjusted);runtime.start(render);loading.complete();
}catch(error){runtime.fail(error);}
