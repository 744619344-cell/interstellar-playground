import * as T from 'three';

export function attachObservationMoves(camera, controls) {
  const forward = new T.Vector3(), right = new T.Vector3();
  function move(name) {
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < .001) forward.set(0, 0, -1);
    forward.normalize();
    right.crossVectors(forward, camera.up).normalize();
    const delta = new T.Vector3();
    if (name === '前移') delta.copy(forward).multiplyScalar(.2);
    if (name === '后移') delta.copy(forward).multiplyScalar(-.2);
    if (name === '左移') delta.copy(right).multiplyScalar(-.2);
    if (name === '右移') delta.copy(right).multiplyScalar(.2);
    if (name === '拉近' || name === '拉远') {
      const distance = camera.position.distanceTo(controls.target);
      const factor = name === '拉近' ? .85 : 1.15;
      camera.position.sub(controls.target).multiplyScalar(factor).add(controls.target);
      if (distance < .08 && name === '拉近') camera.position.addScaledVector(forward, -.08);
    } else {
      camera.position.add(delta);
      controls.target.add(delta);
    }
    controls.update();
  }
  document.querySelectorAll('[data-move]').forEach(button => {
    button.onclick = () => move(button.dataset.move);
  });
}
