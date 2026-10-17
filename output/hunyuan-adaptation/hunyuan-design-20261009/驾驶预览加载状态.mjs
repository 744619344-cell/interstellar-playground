const readyControls='[data-view],[data-move],#original,#adjusted,#coating-before,#coating-after,'+
 '#context-layout,#candidate,#context,#exterior,#glazing,#normal-detail,#color-detail';

export function attachPreviewLoading({document:doc=globalThis.document,reload=()=>location.reload()}={}){
 const panel=doc.querySelector('#load-state'),message=doc.querySelector('#load-progress');
 const retry=doc.querySelector('#retry-preview'),controls=[...doc.querySelectorAll(readyControls)];
 let state='loading';
 function update(value,text){
  state=value;doc.body.dataset.loadState=value;doc.body.setAttribute('aria-busy',String(value==='loading'));
  panel.setAttribute('role',value==='error'?'alert':'status');
  message.textContent=text;retry.hidden=value!=='error';
  controls.forEach(control=>{control.disabled=value!=='ready';});
 }
 retry.addEventListener('click',()=>{if(state==='error')reload();});
 update('loading','正在准备3D预览…');
 return {
  progress(url,phase){
   if(state==='loading')update('loading',`${phase}：${decodeURI(url).replace(/^\.\//,'')}`);
  },
  complete(){if(state==='loading')update('ready','资源已就绪，可以切换机位和对照。');},
  fail(error,cleanupErrors=[]){
   doc.body.classList.remove('clean');
   update('error',`预览无法继续：${error.message}${cleanupErrors.length?'；部分资源释放失败，请重新加载。':''}`);
  }
 };
}
