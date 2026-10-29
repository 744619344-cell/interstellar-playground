import { MeshPhysicalMaterial, type MeshStandardMaterial } from 'three'

/** Keep real transmission/thickness; prevent the studio reflection field from reading as a solid canopy. */
export function applyCurrentShipGlass(material: MeshStandardMaterial) {
  if (!(material instanceof MeshPhysicalMaterial) || material.transmission <= 0 || material.ior < 1.4) return
  material.envMapIntensity = .12
  material.specularIntensity = .35
  material.roughness = Math.min(material.roughness, .035)
}
