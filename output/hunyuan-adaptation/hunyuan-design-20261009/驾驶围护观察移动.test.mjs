import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {attachObservationMoves} from './驾驶围护观察移动.mjs';

function setup(isReady=()=>true){
 globalThis.window=new EventTarget();
 const buttons=['前移','拉近','拉远'].map(move=>Object.assign(new EventTarget(),{dataset:{move}}));
 globalThis.document={querySelectorAll:()=>buttons};
 const camera=new T.PerspectiveCamera();camera.position.set(0,0,2);
 const controls={target:new T.Vector3(),update(){camera.lookAt(this.target);camera.updateMatrixWorld();}};
 controls.update();const input=attachObservationMoves(camera,controls,{isReady});
 const press=(code,extras={})=>{
  const event=new Event('keydown',{cancelable:true});Object.assign(event,{code,...extras});
  window.dispatchEvent(event);return event;
 };
 const release=code=>window.dispatchEvent(Object.assign(new Event('keyup'),{code}));
 return {input,camera,controls,buttons,press,release};
}

test('diagonal observation has the same speed and preserves orbit distance',()=>{
 const {input,camera,controls,press}=setup();press('KeyW');press('KeyD');
 const before=camera.position.clone();for(let i=0;i<20;i++)input.update(.05);
 assert.ok(Math.abs(camera.position.distanceTo(before)-.8)<1e-10);
 assert.ok(Math.abs(camera.position.distanceTo(controls.target)-2)<1e-10);
 assert.equal(camera.position.y,0);input.destroy();
});

test('aliases do not multiply movement and opposing intent cancels',()=>{
 const {input,camera,press,release}=setup();press('KeyW');press('ArrowUp');input.update(.05);
 assert.ok(Math.abs(camera.position.z-1.96)<1e-10);
 press('KeyS');const before=camera.position.clone();input.update(.05);
 assert.deepEqual(camera.position,before);release('KeyS');release('KeyW');release('ArrowUp');
 press('KeyE');input.update(.05);assert.ok(Math.abs(camera.position.y-.04)<1e-10);input.destroy();
});

test('blur and disposal stop held movement and remove button input',()=>{
 const {input,camera,press,buttons}=setup();press('KeyW');window.dispatchEvent(new Event('blur'));
 const before=camera.position.clone();input.update(.05);assert.deepEqual(camera.position,before);
 input.destroy();press('KeyW');input.update(.05);buttons[0].dispatchEvent(new Event('click'));
 assert.deepEqual(camera.position,before);
});

test('not-ready and modified keys are ignored; invalid time cannot move camera',()=>{
 let ready=false;const {input,camera,press}=setup(()=>ready);press('KeyW');input.update(.05);
 assert.equal(camera.position.z,2);ready=true;press('KeyW',{ctrlKey:true});input.update(.05);
 assert.equal(camera.position.z,2);press('KeyW');input.update(NaN);input.update(-1);
 assert.equal(camera.position.z,2);input.update(5);assert.ok(Math.abs(camera.position.z-1.96)<1e-10);input.destroy();
});

test('zoom buttons have a stable minimum and maximum distance',()=>{
 const {input,camera,controls,buttons}=setup();
 for(let i=0;i<60;i++)buttons[1].dispatchEvent(new Event('click'));
 assert.ok(Math.abs(camera.position.distanceTo(controls.target)-.08)<1e-10);
 for(let i=0;i<90;i++)buttons[2].dispatchEvent(new Event('click'));
 assert.ok(Math.abs(camera.position.distanceTo(controls.target)-40)<1e-10);input.destroy();
});
