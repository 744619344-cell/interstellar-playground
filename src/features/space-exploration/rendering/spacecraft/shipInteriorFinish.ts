import { Mesh, MeshStandardMaterial } from 'three'

export type InteriorFinish = 'original' | 'coat' | 'reveal' | 'equipment' | 'fabric' | 'hardware'
const equipment = new Set(['rear-workbench', 'storage-cabinet', 'dual-suit-locker', 'folding-berth'])
const hardware = new Set(['airlock-door-frame', 'airlock-inner-door', 'airlock-outer-door', 'airlock-handrail',
  'airlock-pressure-panel', 'pedals', 'joystick', 'throttle', 'mounting-fixture'])

/** Separate uses of a shared source material before changing its interior finish. */
export function shipInteriorFinish(mesh: Mesh, material: MeshStandardMaterial): InteriorFinish {
  if (mesh.userData.masterInterior) return 'original'
  const module = mesh.userData.module ?? ''
  if (module === 'window-liner') return 'reveal'
  if (/floor|wall|ceiling/.test(module)) return 'coat'
  if (module === 'seat') return material.name === 'seat_top' ? 'fabric' : 'equipment'
  if (equipment.has(module)) return 'equipment'
  return hardware.has(module) ? 'hardware' : 'original'
}

/** Keep source texture and emissive channels; tune paint/fabric/metal separately. */
export function applyShipInteriorFinish(material: MeshStandardMaterial, original: MeshStandardMaterial,
  profile: InteriorFinish, inside: boolean, adapted: boolean) {
  material.color.copy(original.color); material.metalness = original.metalness; material.roughness = original.roughness
  if (!inside || !adapted || profile === 'original') return
  const limits = profile === 'fabric' ? [.02, .9] : profile === 'equipment' ? [.18, .7]
    : profile === 'hardware' ? [.45, .6] : [.25, .55]
  material.metalness = Math.min(original.metalness, limits[0])
  material.roughness = Math.max(original.roughness, limits[1])
  if (profile === 'reveal') { material.color.setRGB(.68, .655, .59); material.metalness = .08; material.roughness = .72 }
}
