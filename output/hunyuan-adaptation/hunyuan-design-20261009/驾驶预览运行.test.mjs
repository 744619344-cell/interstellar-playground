import test from 'node:test';
import assert from 'node:assert/strict';
import {attachPreviewRuntime} from './驾驶预览运行.mjs';
import {createPreviewAssets} from './驾驶预览资源.mjs';

const event=(name,extra={})=>Object.assign(new Event(name,{cancelable:true}),extra);
function setup({hidden=false,release=()=>{}}={}){
 const doc=Object.assign(new EventTarget(),{hidden,body:{dataset:{}}}),page=new EventTarget();
 const calls={release:0,controls:0,observation:0,renderer:0,canvas:0,resize:0,reload:0},failures=[];
 const canvas=Object.assign(new EventTarget(),{remove(){calls.canvas++;}});
 const renderer={domElement:canvas,loop:null,setAnimationLoop(loop){this.loop=loop;},dispose(){calls.renderer++;}};
 const controls={enabled:true,dispose(){calls.controls++;}};
 const runtime=attachPreviewRuntime({document:doc,window:page,renderer,controls,
  observation:{destroy(){calls.observation++;}},release(){calls.release++;release();},
  resize(){calls.resize++;},reload(){calls.reload++;},onFailure:(...errors)=>failures.push(errors)});
 return {runtime,doc,page,calls,failures,renderer,controls,canvas};
}

test('loading has no animation or orbit input; teardown is idempotent and removes resize',()=>{
 const {runtime,doc,page,calls,renderer,controls}=setup();
 assert.equal(runtime.ready,false);assert.equal(controls.enabled,false);assert.equal(renderer.loop,null);
 page.dispatchEvent(event('resize'));assert.equal(calls.resize,1);
 runtime.start(()=>{});assert.equal(runtime.ready,true);assert.equal(controls.enabled,true);
 assert.equal(doc.body.dataset.loaded,'true');runtime.destroy();runtime.destroy();page.dispatchEvent(event('resize'));
 assert.equal(calls.resize,1);assert.equal(controls.enabled,false);assert.equal(renderer.loop,null);
 assert.equal(doc.body.dataset.loaded,'false');assert.equal(doc.body.dataset.released,'true');
 for(const name of ['release','controls','observation','renderer','canvas'])assert.equal(calls[name],1,name);
 assert.equal(runtime.start(()=>{}),false);
});

test('hidden pages release once and competing return events reload only once',()=>{
 const {runtime,doc,page,calls}=setup();runtime.start(()=>{});
 doc.hidden=true;doc.dispatchEvent(event('visibilitychange'));page.dispatchEvent(event('pagehide',{persisted:true}));
 assert.equal(runtime.disposed,true);assert.equal(calls.release,1);assert.equal(calls.reload,0);
 doc.hidden=false;doc.dispatchEvent(event('visibilitychange'));page.dispatchEvent(event('pageshow',{persisted:true}));
 doc.dispatchEvent(event('visibilitychange'));page.dispatchEvent(event('resize'));
 assert.equal(calls.reload,1);assert.equal(calls.release,1);assert.equal(calls.resize,0);
});

test('bfcache pagehide restores on pageshow; ordinary navigation needs no reload',()=>{
 const saved=setup();saved.page.dispatchEvent(event('pagehide',{persisted:true}));
 saved.page.dispatchEvent(event('pageshow',{persisted:false}));assert.equal(saved.calls.reload,0);
 saved.page.dispatchEvent(event('pageshow',{persisted:true}));saved.page.dispatchEvent(event('pageshow',{persisted:true}));
 assert.equal(saved.calls.reload,1);
 const exited=setup();exited.page.dispatchEvent(event('pagehide',{persisted:false}));
 exited.page.dispatchEvent(event('pageshow',{persisted:true}));assert.equal(exited.calls.reload,0);assert.equal(exited.calls.release,1);
});

test('load failure releases resources and returning to the tab cannot cause a retry loop',()=>{
 const {runtime,doc,page,calls,failures}=setup();runtime.fail(new Error('missing.glb: HTTP 404'));
 runtime.fail(new Error('late failure'));doc.hidden=true;doc.dispatchEvent(event('visibilitychange'));
 doc.hidden=false;doc.dispatchEvent(event('visibilitychange'));page.dispatchEvent(event('pageshow',{persisted:true}));
 assert.equal(calls.reload,0);assert.equal(failures.length,1);assert.match(failures[0][0].message,/HTTP 404/);
 assert.equal(runtime.ready,false);assert.equal(calls.release,1);
});

test('render errors stop the loop; already queued callbacks cannot touch released resources',()=>{
 const {runtime,renderer,calls,failures}=setup();let frames=0;
 runtime.start(()=>{frames++;throw new Error('render failed');});const queued=renderer.loop;
 queued(10);queued(20);assert.equal(frames,1);assert.equal(renderer.loop,null);
 assert.equal(calls.renderer,1);assert.match(failures[0][0].message,/render failed/);
});

test('context loss is handled once and listeners are gone after cleanup',()=>{
 const {canvas,runtime,failures,calls}=setup();runtime.start(()=>{});
 const lost=event('webglcontextlost');canvas.dispatchEvent(lost);canvas.dispatchEvent(event('webglcontextlost'));
 assert.equal(lost.defaultPrevented,true);assert.equal(failures.length,1);assert.equal(calls.release,1);
 assert.match(failures[0][0].message,/图形上下文/);
});

test('a cleanup error cannot prevent orbit controls, renderer and canvas cleanup',()=>{
 const {runtime,failures,calls}=setup({release:()=>{throw new Error('release failed');}});
 runtime.fail(new Error('load failed'));assert.equal(failures[0][1].length,1);
 assert.match(failures[0][1][0].message,/release failed/);
 for(const name of ['release','controls','observation','renderer','canvas'])assert.equal(calls[name],1,name);
});

test('initially hidden previews never start rendering and restore once when visible',()=>{
 const {runtime,doc,calls}=setup({hidden:true});assert.equal(runtime.start(()=>{}),false);assert.equal(calls.release,1);
 doc.hidden=false;doc.dispatchEvent(event('visibilitychange'));assert.equal(calls.reload,1);
});

test('a second asset failing tears down the earlier parsed asset and aborts its scope',async()=>{
 let geometry=0,removed=0,requests=0,signal;
 const root={traverse(visit){visit({geometry:{dispose(){geometry++;}}});},removeFromParent(){removed++;}};
 const assets=createPreviewAssets({baseUrl:'https://preview.example/',parse:async()=>({scene:root}),request:async(_url,options)=>{
  signal=options.signal;return ++requests===1?new Response(new Uint8Array([1])):new Response('',{status:404});
 }});
 const {runtime,calls,failures}=setup({release:()=>assets.dispose()});
 try{await assets.original('./first.glb');await assets.original('./second.glb');runtime.start(()=>{});}
 catch(error){runtime.fail(error);}
 assert.equal(geometry,1);assert.equal(removed,1);assert.equal(signal.aborted,true);
 assert.equal(calls.renderer,1);assert.equal(failures.length,1);assert.match(failures[0][0].message,/second.glb：HTTP 404/);
});
