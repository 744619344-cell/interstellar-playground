import { Group, Mesh } from 'three'
import { sameShipSurface } from './shipCeilingRepair'

const modules = ['rear-cabin-floor', 'airlock-floor']

/** Validate the entire set before transferring any mesh; main owns all transferred resources. */
export function installShipFloorRepair(model: Group, repair: Group) {
  if (!model.getObjectByName('Ship_Adapted') || model.userData.floorsRepaired) return false
  const sources: Mesh[] = [], replacements: Mesh[] = []
  model.traverse(o => { if (o instanceof Mesh && modules.includes(o.userData.module)) sources.push(o) })
  repair.traverse(o => { if (o instanceof Mesh) replacements.push(o) })
  if (sources.length !== modules.length || replacements.length !== modules.length) return false
  const pairs: { original: Mesh; replacement: Mesh }[] = []
  for (const module of modules) {
    const originals = sources.filter(o => o.userData.module === module)
    const candidates = replacements.filter(o => o.userData.module === module)
    if (originals.length !== 1 || candidates.length !== 1 || !sameShipSurface(originals[0], candidates[0])) return false
    pairs.push({ original: originals[0], replacement: candidates[0] })
  }
  for (const { original, replacement } of pairs) {
    replacement.position.copy(original.position); replacement.quaternion.copy(original.quaternion); replacement.scale.copy(original.scale)
    replacement.userData = { ...original.userData, materialRepair: 'source-floor-projection' }
    original.parent!.add(replacement); original.visible = false; original.userData.supersededByAtlas = true
  }
  model.userData.floorsRepaired = true
  return true
}
