import * as T from 'three';

const directions={KeyW:[1,0,0],ArrowUp:[1,0,0],KeyS:[-1,0,0],ArrowDown:[-1,0,0],
 KeyA:[0,-1,0],ArrowLeft:[0,-1,0],KeyD:[0,1,0],ArrowRight:[0,1,0],KeyQ:[0,0,-1],KeyE:[0,0,1]};

function bindKeys(isReady) {
 const held=new Set(),aborter=new AbortController();
 const clear=()=>held.clear();
 window.addEventListener('keydown',event=>{
  if(!directions[event.code]||!isReady()||event.ctrlKey||event.altKey||event.metaKey)return;
  if(event.target?.isContentEditable||/^(INPUT|SELECT|TEXTAREA)$/.test(event.target?.tagName))return;
  event.preventDefault();held.add(event.code);
 },{signal:aborter.signal});
 window.addEventListener('keyup',event=>held.delete(event.code),{signal:aborter.signal});
 window.addEventListener('blur',clear,{signal:aborter.signal});
 return {held,clear,destroy(){clear();aborter.abort();}};
}

export function attachObservationMoves(camera, controls, {isReady=()=>true}={}) {
  const forward = new T.Vector3(), right = new T.Vector3();
  const keys=bindKeys(isReady),buttons=[...document.querySelectorAll('[data-move]')];
  function basis() {
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < .001) forward.set(0, 0, -1);
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();
  }
  function translate(delta){camera.position.add(delta);controls.target.add(delta);}
  function move(name) {
    if(!isReady())return;
    basis();
    const delta = new T.Vector3();
    if (name === '前移') delta.copy(forward).multiplyScalar(.2);
    if (name === '后移') delta.copy(forward).multiplyScalar(-.2);
    if (name === '左移') delta.copy(right).multiplyScalar(-.2);
    if (name === '右移') delta.copy(right).multiplyScalar(.2);
    if (name === '拉近' || name === '拉远') {
      const distance = camera.position.distanceTo(controls.target);
      const desired=T.MathUtils.clamp(distance*(name==='拉近'?.85:1.15),.08,40);
      const factor=desired/Math.max(distance,1e-8);
      camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
      if(distance<1e-8)camera.position.addScaledVector(forward,-.08);
    } else {
      translate(delta);
    }
    controls.update();
  }
  const handlers=buttons.map(button=>{const handler=()=>move(button.dataset.move);button.addEventListener('click',handler);return handler;});
  return {
   clear:keys.clear,
   update(seconds){
    if(!isReady()||!Number.isFinite(seconds)||seconds<=0)return;
    const positive=[false,false,false],negative=[false,false,false];
    for(const code of Object.keys(directions))if(keys.held.has(code)){
     const axis=directions[code];for(let i=0;i<3;i++){
      if(axis[i]>0)positive[i]=true;if(axis[i]<0)negative[i]=true;
     }
    }
    const axes=positive.map((value,i)=>Number(value)-Number(negative[i]));
    const length=Math.hypot(...axes);if(!length)return;
    basis();const step=.8*Math.min(seconds,.05)/length;
    const delta=forward.clone().multiplyScalar(axes[0]*step).addScaledVector(right,axes[1]*step);
    delta.y+=axes[2]*step;translate(delta);
   },
   destroy(){keys.destroy();buttons.forEach((button,i)=>button.removeEventListener('click',handlers[i]));}
  };
}
