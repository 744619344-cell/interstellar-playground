import test from 'node:test';
import assert from 'node:assert/strict';
import {attachPreviewLoading} from './驾驶预览加载状态.mjs';

function setup(){
 const classes=new Set(['clean']),attributes={};
 const body={dataset:{},classList:{remove:name=>classes.delete(name)},setAttribute:(key,value)=>{attributes[key]=value;}};
 const panel={attributes:{},setAttribute(key,value){this.attributes[key]=value;}},message={textContent:''};
 const retry=Object.assign(new EventTarget(),{hidden:false}),controls=[{disabled:false},{disabled:false}];
 const elements={'#load-state':panel,'#load-progress':message,'#retry-preview':retry};let reloads=0;
 const document={body,querySelector:selector=>elements[selector],querySelectorAll:()=>controls};
 const loading=attachPreviewLoading({document,reload:()=>{reloads++;}});
 return {loading,body,panel,message,retry,controls,classes,attributes,reloads:()=>reloads};
}

test('loading disables asset controls and reports the current file without a fake percentage',()=>{
 const {loading,body,panel,message,retry,controls,attributes,reloads}=setup();
 assert.equal(body.dataset.loadState,'loading');assert.equal(attributes['aria-busy'],'true');
 assert.ok(controls.every(control=>control.disabled));assert.equal(retry.hidden,true);
 retry.dispatchEvent(new Event('click'));assert.equal(reloads(),0);
 loading.progress('./%E9%9A%94%E8%88%B1/来源.glb','解析模型');
 assert.equal(message.textContent,'解析模型：隔舱/来源.glb');assert.equal(panel.attributes.role,'status');
});

test('success enables controls and late progress cannot overwrite the ready state',()=>{
 const {loading,body,message,controls,attributes,retry}=setup();loading.complete();
 assert.equal(body.dataset.loadState,'ready');assert.equal(attributes['aria-busy'],'false');
 assert.ok(controls.every(control=>!control.disabled));assert.equal(retry.hidden,true);
 const ready=message.textContent;loading.progress('./late.glb','解析模型');assert.equal(message.textContent,ready);
});

test('failure reveals the panel, locks stale controls and leaves a working retry button',()=>{
 const {loading,body,panel,message,retry,controls,classes,attributes,reloads}=setup();loading.complete();
 loading.fail(new Error('missing.glb：HTTP 404'));
 assert.equal(classes.has('clean'),false);assert.equal(body.dataset.loadState,'error');assert.equal(panel.attributes.role,'alert');
 assert.equal(attributes['aria-busy'],'false');assert.equal(retry.hidden,false);assert.ok(controls.every(control=>control.disabled));
 const error=message.textContent;loading.progress('./late.glb','解析模型');loading.complete();assert.equal(message.textContent,error);
 retry.dispatchEvent(new Event('click'));assert.equal(reloads(),1);
});

test('graphics failures and cleanup errors remain readable outside the collapsible details',()=>{
 const {loading,message}=setup();loading.fail(new Error('图形上下文已中断'),[new Error('cleanup')]);
 assert.match(message.textContent,/图形上下文已中断/);assert.match(message.textContent,/部分资源释放失败/);
});
