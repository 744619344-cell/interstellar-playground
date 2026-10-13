import { Group, Mesh } from 'three'

/** Require an exact triangle/normal match before replacing a frozen mesh's material mapping. */
export function sameShipSurface(original: Mesh, replacement: Mesh) {
  const a = original.geometry, b = replacement.geometry
  const count = a.index?.count ?? a.getAttribute('position')?.count
  if (count === undefined || count !== (b.index?.count ?? b.getAttribute('position')?.count)) return false
  for (const name of ['position', 'normal']) {
    const left = a.getAttribute(name), right = b.getAttribute(name)
    if (!left || !right) return false
    for (let i = 0; i < count; i++) for (let j = 0; j < 3; j++) {
      const delta = left.getComponent(a.index ? a.index.getX(i) : i, j) - right.getComponent(b.index ? b.index.getX(i) : i, j)
      if (!Number.isFinite(delta) || Math.abs(delta) > 1e-6) return false
    }
  }
  return true
}

/** The parent model owns both the hidden original and replacement, including their textures. */
export function installShipCeilingRepair(model: Group, repair: Group) {
  if (!model.getObjectByName('Ship_Adapted') || model.userData.ceilingRepaired) return false
  const originals: Mesh[] = [], replacements: Mesh[] = []
  model.traverse(o => { if (o instanceof Mesh && o.userData.module === 'cockpit-ceiling') originals.push(o) })
  repair.traverse(o => { if (o instanceof Mesh) replacements.push(o) })
  if (originals.length !== 1 || replacements.length !== 1 || !sameShipSurface(originals[0], replacements[0])) return false
  const original = originals[0], replacement = replacements[0]
  replacement.position.copy(original.position); replacement.quaternion.copy(original.quaternion); replacement.scale.copy(original.scale)
  replacement.userData = { ...original.userData, label: '驾驶顶板材质修正' }
  original.parent!.add(replacement); original.visible = false; original.userData.supersededByAtlas = true
  model.userData.ceilingRepaired = true
  return true
}
