import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewAssets} from './驾驶预览资源.mjs';

const baseUrl='https://preview.example/check/index.html';
const deferred=()=>{let resolve,reject;const promise=new Promise((ok,no)=>{resolve=ok;reject=no;});return {promise,resolve,reject};};
const bytes=()=>new Response(new Uint8Array([1,2,3]));
function source(){
 const counts={geometry:0,material:0,texture:0,image:0,skeleton:0,removed:0};
 const image={close(){counts.image++;}};
 const texture={isTexture:true,source:{data:image},dispose(){counts.texture++;}};
 const material={map:texture,normalMap:texture,dispose(){counts.material++;}};
 const geometry={dispose(){counts.geometry++;}},skeleton={dispose(){counts.skeleton++;}};
 const node={geometry,material:[material,material],skeleton};
 const root={traverse(visit){visit(node);visit(node);},removeFromParent(){counts.removed++;}};
 return {root,counts,node};
}

test('load reports download/parse phases and resolves relative resource paths',async()=>{
 const {root,counts}=source(),requests=[],phases=[],parsed=[];
 const assets=createPreviewAssets({baseUrl,request:async(url,options)=>{
  requests.push({url,signal:options.signal});return url.endsWith('.json')?new Response('{"width":2.3}'):bytes();
 },parse:async(data,path)=>{parsed.push({data,path});return {scene:root};},progress:(...row)=>phases.push(row)});
 assert.deepEqual(await assets.json('./安装/检查.json'),{width:2.3});
 assert.equal(await assets.original('./安装/来源.glb'),root);
 assert.equal(parsed[0].path,'https://preview.example/check/%E5%AE%89%E8%A3%85/');
 assert.equal(parsed[0].data.byteLength,3);
 assert.deepEqual(phases.map(row=>row[1]),['读取安装记录','下载模型','解析模型']);
 assets.dispose();assert.ok(requests.every(row=>row.signal.aborted));
 assert.deepEqual(counts,{geometry:1,material:1,texture:1,image:1,skeleton:1,removed:1});
});

test('shared resources across registered roots are released exactly once',async()=>{
 const {root,counts,node}=source();let secondRemoved=0,index=0;
 const second={traverse(visit){visit({...node,material:node.material[0]});},removeFromParent(){secondRemoved++;}};
 const assets=createPreviewAssets({baseUrl,request:async()=>bytes(),parse:async()=>({scene:index++?second:root})});
 await assets.original('./first.glb');await assets.original('./second.glb');assets.dispose();assets.dispose();
 assert.deepEqual(counts,{geometry:1,material:1,texture:1,image:1,skeleton:1,removed:1});assert.equal(secondRemoved,1);
});

test('closing during download aborts the request and never parses a late response',async()=>{
 const download=deferred();let signal,parsed=0;
 const assets=createPreviewAssets({baseUrl,request:(_url,options)=>{signal=options.signal;return download.promise;},parse:()=>{parsed++;}});
 const pending=assets.original('./pending.glb');assets.dispose();assert.ok(signal.aborted);
 download.resolve(bytes());await assert.rejects(pending,{name:'AbortError'});assert.equal(parsed,0);
});

test('closing during GLTF parsing releases the late scene instead of registering it',async()=>{
 const parsing=deferred(),started=deferred(),{root,counts}=source();
 const assets=createPreviewAssets({baseUrl,request:async()=>bytes(),parse:()=>{started.resolve();return parsing.promise;}});
 const pending=assets.original('./late.glb');await started.promise;assets.dispose();
 parsing.resolve({scene:root});await assert.rejects(pending,{name:'AbortError'});assets.dispose();
 assert.deepEqual(counts,{geometry:1,material:1,texture:1,image:1,skeleton:1,removed:1});
});

test('late parse rejection and late JSON completion remain cancellation',async()=>{
 const parsing=deferred(),started=deferred();
 const assets=createPreviewAssets({baseUrl,request:async()=>bytes(),parse:()=>{started.resolve();return parsing.promise;}});
 const pending=assets.original('./late.glb');await started.promise;assets.dispose();
 parsing.reject(new Error('decode failed'));await assert.rejects(pending,{name:'AbortError'});
 const json=deferred(),reading=deferred();
 const records=createPreviewAssets({baseUrl,request:async()=>({ok:true,json:()=>{reading.resolve();return json.promise;}})});
 const record=records.json('./pose.json');await reading.promise;records.dispose();json.resolve({scale:1});
 await assert.rejects(record,{name:'AbortError'});
});

test('HTTP and invalid model errors identify the actual failing asset',async()=>{
 const missing=createPreviewAssets({baseUrl,request:async()=>new Response('',{status:404})});
 await assert.rejects(missing.original('./隔舱/来源.glb'),/隔舱\/来源.glb：HTTP 404/);missing.dispose();
 const invalid=createPreviewAssets({baseUrl,request:async()=>bytes(),parse:async()=>{throw new Error('Invalid GLB');}});
 await assert.rejects(invalid.original('./broken.glb'),/broken.glb：Invalid GLB/);invalid.dispose();
 const json=createPreviewAssets({baseUrl,request:async()=>new Response('bad json')});
 await assert.rejects(json.json('./安装.json'),/安装.json/);json.dispose();
});

test('disposed scopes cannot start another request or update loading progress',async()=>{
 let requests=0,phases=0;
 const assets=createPreviewAssets({baseUrl,request:()=>{requests++;},progress:()=>{phases++;}});
 assets.dispose();await assert.rejects(assets.original('./again.glb'),{name:'AbortError'});
 await assert.rejects(assets.json('./again.json'),{name:'AbortError'});assert.equal(requests,0);assert.equal(phases,0);
});
