import { Box3, Group, Mesh, SkinnedMesh, Vector3 } from 'three'

/** Existing rigPoses.mjs seat pose and placement, unchanged from the approved local preview. */
export function placeCurrentShipCrew(model: Group) {
  model.updateMatrixWorld(true)
  const height = new Box3().setFromObject(model, true).getSize(new Vector3()).y
  if (!(height > 0 && Number.isFinite(height))) throw new Error('Invalid seated crew source')
  model.scale.multiplyScalar(1.85 / height)
  const joint = (name: string) => {
    const bone = model.getObjectByName(name)
    if (!bone) throw new Error(`Missing seated crew joint: ${name}`)
    return bone
  }
  joint('root').position.y = -.2
  joint('chest').rotation.z = Math.PI / 24
  for (const [side, sign] of [['L', 1], ['R', -1]] as const) {
    joint(`thigh_${side}`).rotation.z = Math.PI * 4 / 9
    joint(`shin_${side}`).rotation.z = -Math.PI * 5 / 12
    joint(`upper_arm_${side}`).rotation.x = sign * Math.PI / 5
    joint(`forearm_${side}`).rotation.y = sign * Math.PI / 5
  }
  const instance = new Group()
  instance.name = 'ExistingAstronautInPilotSeat'
  instance.rotation.y = Math.PI / 2
  instance.position.set(-.8999969244, -1.5027, -4.5)
  instance.add(model); instance.updateMatrixWorld(true)
  model.traverse(object => {
    if (object instanceof SkinnedMesh) object.skeleton.update()
    if (object instanceof Mesh) Object.assign(object.userData, { currentShipPart: 'crew', masterInterior: true })
  })
  return instance
}
