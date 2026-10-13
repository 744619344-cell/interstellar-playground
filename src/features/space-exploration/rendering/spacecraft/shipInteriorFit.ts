import { Box3, Group, Matrix4, Mesh, Vector3 } from 'three'

/** Correct the frozen assembly's outward-facing service covers, retaining geometry, UVs and bounds. */
export function fitShipInteriorModules(model: Group) {
  if (!model.getObjectByName('Ship_Adapted') || model.userData.interiorFitted) return
  model.updateMatrixWorld(true)
  const walls = new Map<string, Mesh[]>()
  model.traverse(o => {
    if (!(o instanceof Mesh) || !['rear-cabin-wall', 'airlock-wall'].includes(o.userData.module)) return
    const group = walls.get(o.userData.label) ?? []
    group.push(o); walls.set(o.userData.label, group)
  })
  for (const group of walls.values()) {
    const box = new Box3(); group.forEach(m => box.union(new Box3().setFromObject(m)))
    const center = box.getCenter(new Vector3())
    const turn = new Matrix4().makeTranslation(center.x, center.y, center.z)
      .multiply(new Matrix4().makeRotationY(Math.PI))
      .multiply(new Matrix4().makeTranslation(-center.x, -center.y, -center.z))
    for (const mesh of group) {
      const parent = mesh.parent!.matrixWorld
      mesh.applyMatrix4(parent.clone().invert().multiply(turn).multiply(parent))
    }
  }
  model.userData.interiorFitted = true
  model.updateMatrixWorld(true)
}
