function restoreOnReturn(doc,page,reload){
 const aborter=new AbortController();
 const restore=()=>{if(!doc.hidden){aborter.abort();reload();}};
 doc.addEventListener('visibilitychange',restore,{signal:aborter.signal});
 page.addEventListener('pageshow',event=>{if(event.persisted)restore();},{signal:aborter.signal});
}

export function attachPreviewRuntime({renderer,controls,observation,release,resize,onFailure,
 document:doc=globalThis.document,window:page=globalThis.window,reload=()=>location.reload()}){
 const aborter=new AbortController(),options={signal:aborter.signal};
 let closed=false,started=false;
 controls.enabled=false;
 function destroy(){
  if(closed)return [];
  closed=true;started=false;aborter.abort();
  const errors=[];
  for(const action of [()=>renderer.setAnimationLoop(null),()=>observation.destroy(),release,
   ()=>controls.dispose(),()=>renderer.dispose(),()=>renderer.domElement.remove()]){
   try{action();}catch(error){errors.push(error);}
  }
  controls.enabled=false;doc.body.dataset.loaded='false';doc.body.dataset.released='true';
  return errors;
 }
 function fail(error){
  if(closed)return;
  const errors=destroy();onFailure(error,errors);
 }
 function suspend(){
  if(closed)return;
  const errors=destroy();
  if(errors.length){onFailure(new Error('退出预览时资源释放失败'),errors);return;}
  restoreOnReturn(doc,page,reload);
 }
 page.addEventListener('resize',resize,options);
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden)suspend();},options);
 page.addEventListener('pagehide',event=>{if(event.persisted)suspend();else destroy();},options);
 renderer.domElement.addEventListener('webglcontextlost',event=>{
  event.preventDefault();fail(new Error('图形上下文已中断，请重新加载预览'));
 },options);
 if(doc.hidden)suspend();
 return {
  get ready(){return started&&!closed;},get disposed(){return closed;},destroy,fail,
  start(render){
   if(closed)return false;
   started=true;controls.enabled=true;doc.body.dataset.loaded='true';doc.body.dataset.released='false';
   renderer.setAnimationLoop(time=>{if(closed)return;try{render(time);}catch(error){fail(error);}});
   return true;
  }
 };
}
