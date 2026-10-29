import * as T from 'three'
import { loadMicrogravityAssembly } from '/src/features/space-exploration/rendering/spacecraft/microgravityAssembly.ts'
import { disposeShipModel } from '/src/features/space-exploration/rendering/spacecraft/shipModelRuntime.ts'
import { ShipReviewLighting } from '/src/features/space-exploration/rendering/spacecraft/shipVisibility.ts'
import { ShipModelEnvironment } from '/src/features/space-exploration/rendering/spacecraft/shipModelEnvironment.ts'
import { MicrogravityOutfit } from '/src/features/space-exploration/rendering/astronaut/microgravityOutfit.ts'
const scene=new T.Scene(),camera=new T.OrthographicCamera(-1.6,1.6,1.3,-1.3,.01,100),renderer=new T.WebGLRenderer({antialias:true,logarithmicDepthBuffer:true}),env=new ShipModelEnvironment(scene),events=new AbortController(),signal=events.signal
scene.background=new T.Color('#162833');renderer.setPixelRatio(Math.min(1.25,devicePixelRatio));renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;document.body.append(renderer.domElement)
const mode=document.getElementById('camera'),choice=document.getElementById('candidate'),pose=document.getElementById('pose'),button=document.getElementById('isolate'),overlay=document.getElementById('overlay'),status=document.getElementById('status')
const proposals={A:{y:.29,z:-.84,back:1.61},B:{y:-.12,z:-.84,back:1.48},C:{y:-.86,z:-1.12,back:1.60},D:{y:-.12,z:-.84,back:1.48}}, roots=new Map()
let model,lighting,outfit,poseData,aborter,frame,dead=false,isolated=true,generation=0
function staticPose(){
 if(!outfit||!poseData||pose.value==='none')return;const p=poseData.reach.find(r=>r.fixture===(pose.value==='arrival'?'actual-main-arrival':pose.value==='lower'?'explicit-existing-work-grip-fixture':'proposed-25deg-tilted-posture-raised-3cm-only'))
 const rotation=pose.value==='lower'?new T.Quaternion():new T.Quaternion(0,-.11596190616080022,0,.9932536616190014)
 if(pose.value==='tilted')rotation.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),-25*Math.PI/180))
 outfit.body(new T.Vector3().copy(p.position),rotation.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),Math.PI)));outfit.rig.pose(0)
 const point=pose.value==='arrival'?new T.Vector3(2.2081961304383526,.3510137858293034,-.15180573781195716):new T.Vector3(1.6264998770309265,-.3771629681204811,-.6482285582409273)
 const normal=pose.value==='arrival'?new T.Vector3(-.185657,-.982614,.000564):new T.Vector3(-.769059,.566284,-.296430),touch=outfit.rig.reach(point,undefined,normal);if(touch.reachable)outfit.rig.grasp(touch.side)
 if(pose.value==='tilted')outfit.rig.reach(new T.Vector3(1.48,-.76,-.99),'L',new T.Vector3(-1,0,0))
}
function view(){
 const aspect=innerWidth/innerHeight,height=mode.value==='context'?2.9:2.6;camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.top=height/2;camera.bottom=-height/2
 if(mode.value==='front'){camera.position.set(-1.5,-.455,-1.12);camera.lookAt(1.8,-.455,-1.12)}
 else if(mode.value==='side'){camera.position.set(.95,-.455,2.4);camera.lookAt(1.7,-.455,-1.05)}
 else{camera.position.set(-1.7,.7,1.25);camera.lookAt(1.8,-.1,-.9)}
 camera.updateProjectionMatrix();camera.updateMatrixWorld(true);renderer.setSize(innerWidth,innerHeight)
 staticPose();if(model)for(const [root,visible] of roots)root.visible=root.name==='MicrogravityCrew'?pose.value!=='none':isolated?root.name==='micro-work':visible
 button.textContent=isolated?'显示整舱':'仅显示原工位';annotations()
}
function annotations(){
 const p=proposals[choice.value];if(!p){overlay.innerHTML='';document.getElementById('details').textContent='先确认原有屏幕、工具位和扶手，再评审安装范围。';return}
 const project=point=>{const q=new T.Vector3(...point).project(camera);return `${(q.x+1)*innerWidth/2},${(1-q.y)*innerHeight/2}`}
 const corners=x=>[[x,p.y-.12,p.z-.16],[x,p.y-.12,p.z+.16],[x,p.y+.12,p.z+.16],[x,p.y+.12,p.z-.16]]
 const front=corners(p.back-.12),back=corners(p.back),poly=points=>points.map(project).join(' ')
 overlay.innerHTML=`<polygon points="${poly(front)}" fill="#f4c96b22" stroke="#f4c96b" stroke-width="2"/><polygon points="${poly(back)}" fill="none" stroke="#f4c96b" stroke-dasharray="5 5"/>${front.map((v,i)=>`<line x1="${project(v).split(',')[0]}" y1="${project(v).split(',')[1]}" x2="${project(back[i]).split(',')[0]}" y2="${project(back[i]).split(',')[1]}" stroke="#f4c96b" stroke-dasharray="4 4"/>`).join('')}`
 document.getElementById('details').textContent=`${choice.value}：拟议320×240×120mm\n中心 y=${p.y.toFixed(2)}, z=${p.z.toFixed(2)}m\n前/后平面 x=${(p.back-.12).toFixed(2)}/${p.back.toFixed(2)}m\n${choice.value==='D'?'仅为重设计方向：需先重排此工具位，背部支撑和工具收纳未冻结。':'纯二维范围，尚未通过装配或操作验收。'}`
}
function release(){exportButton.disabled=true;exportLink.hidden=true;exportLink.removeAttribute('href');outfit?.dispose();outfit=undefined;lighting?.dispose();lighting=undefined;env.dispose();if(model)disposeShipModel(model);model=undefined;roots.clear()}
async function load(){
 aborter?.abort();if(dead||document.hidden)return;status.textContent='加载原模型…';const request=new AbortController();aborter=request;const token=++generation
 try{const data=await(await fetch('./interface-static-v4.json',{signal:request.signal})).json(),asset=await loadMicrogravityAssembly(request.signal,disposeShipModel);if(dead||token!==generation||document.hidden){disposeShipModel(asset.scene);return}model=asset.scene;poseData=data;scene.add(model);model.updateMatrixWorld(true);outfit=new MicrogravityOutfit(model);for(const root of model.children)roots.set(root,root.visible);lighting=new ShipReviewLighting([model]);scene.add(lighting.root);lighting.apply('cockpit');env.ensure(renderer);view();exportButton.disabled=false;status.textContent='原模型已就绪 · 未制作三维装置'}catch(e){if(token===generation)release();if(e.name!=='AbortError'&&!dead)status.textContent=e.message}
}
for(const el of [mode,choice,pose])el.addEventListener('change',view,{signal});button.addEventListener('click',()=>{isolated=!isolated;view()},{signal});window.addEventListener('resize',view,{signal})
const exportButton=document.createElement('button'),exportLink=document.createElement('a');exportButton.textContent='保存原件视图';exportButton.disabled=true;exportLink.textContent='下载当前原件PNG';exportLink.hidden=true;exportLink.download='work-source-front.png';button.after(exportButton,exportLink)
exportButton.addEventListener('click',()=>{if(!model||document.hidden||dead)return;renderer.render(scene,camera);exportLink.href=renderer.domElement.toDataURL('image/png');exportLink.hidden=false},{signal})
document.addEventListener('visibilitychange',()=>{if(document.hidden){generation++;aborter?.abort();release();status.textContent='页面隐藏，原模型资源已释放'}else load()},{signal})
window.addEventListener('pagehide',()=>{dead=true;generation++;aborter?.abort();events.abort();cancelAnimationFrame(frame);release();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove()},{once:true})
function animate(){if(!document.hidden)renderer.render(scene,camera);if(!dead)frame=requestAnimationFrame(animate)}view();frame=requestAnimationFrame(animate);load()
