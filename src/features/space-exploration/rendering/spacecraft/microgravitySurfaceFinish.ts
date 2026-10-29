import { MeshPhysicalMaterial, MeshStandardMaterial, Mesh, Texture } from 'three'
import { ShipSurfaceTextures, type SurfaceRange } from './shipSurfaceTextures'

export type CabinSurface = 'paint' | 'equipment' | 'sleep' | 'fabric' | 'skin' | 'metal' | 'original'
const ranges: Record<Exclude<CabinSurface, 'original'>, SurfaceRange> = {
  paint: { roughMin: .55, roughMax: .83, metalMax: .09 },
  equipment: { roughMin: .32, roughMax: .82, metalMax: .82 },
  fabric: { roughMin: .73, roughMax: .98, metalMax: .16 },
  sleep: { roughMin: .5, roughMax: .96, metalMax: .6 },
  skin: { roughMin: .5, roughMax: .67, metalMax: 0 },
  metal: { roughMin: .29, roughMax: .6, metalMax: 1 }
}
export function useRefinedCabin(search = typeof window === 'undefined' ? '' : window.location.search) {
  return new URLSearchParams(search).get('surface') !== 'source'
}
export function microgravitySurface(mesh: Mesh, material: MeshStandardMaterial): CabinSurface {
  if (material instanceof MeshPhysicalMaterial && material.transmission > 0) return 'original'
  const name = material.name.toLowerCase()
  if (/glass|glazing|display|status|rubber|seal/.test(name)) return 'original'
  if (/f154_head|f154_opacity/.test(name)) return 'skin'
  if (/f154_body|mattress|woven|fabric|cloth|seat_top/.test(name) || name === 'mat0') return 'fabric'
  if (/titanium|alloy|合金|固定点|hinge/.test(name)) return 'metal'
  if (/ceramic|paint|ivory|涂层|暖白|perimeter/.test(name)) return 'paint'
  for (let node = mesh.parent; node; node = node.parent) {
    const module = String(node.userData.microgravityModule ?? '')
    if (/liner-v2|micro-port-liner|inner-airlock|micro-inner-airlock/.test(module)) return 'paint'
    if (/sleep/.test(module)) return 'sleep'
    if (/locker|work|starboard-liner/.test(module)) return 'equipment'
  }
  return 'original'
}

/** Owns sampling/ORM copies; ShipReviewLighting owns material variants and restores the sources. */
export class MicrogravitySurfaceFinish {
  private textures = new ShipSurfaceTextures()
  private profiles: Partial<Record<CabinSurface, number>> = {}
  apply(material: MeshStandardMaterial, profile: CabinSurface) {
    if (material instanceof MeshPhysicalMaterial && material.transmission > 0) return
    this.profiles[profile] = (this.profiles[profile] ?? 0) + 1
    if (material instanceof MeshPhysicalMaterial) {
      material.specularColor.setRGB(Math.min(1, material.specularColor.r), Math.min(1, material.specularColor.g), Math.min(1, material.specularColor.b))
      material.specularIntensity = Math.min(material.specularIntensity, profile === 'skin' ? .9 : .65)
    }
    for (const slot of ['map', 'normalMap', 'emissiveMap', 'specularColorMap'] as const) {
      const source = (material as MeshPhysicalMaterial)[slot]
      if (source instanceof Texture) (material as MeshPhysicalMaterial)[slot] = this.textures.sampler(source)
    }
    if (profile === 'original') return
    const range = ranges[profile], orm = material.roughnessMap
    if (orm && orm === material.metalnessMap) {
      const derived = this.textures.numerical(orm, range, material.roughness, material.metalness)
      if (derived) { material.roughnessMap = material.metalnessMap = derived; material.roughness = material.metalness = 1 }
      else { material.roughnessMap = material.metalnessMap = null; material.roughness = (range.roughMin + range.roughMax) / 2; material.metalness *= range.metalMax }
    } else {
      material.roughness = Math.max(range.roughMin, Math.min(range.roughMax, material.roughness))
      material.metalness *= range.metalMax
    }
    if (profile === 'paint') material.color.multiplyScalar(.94)
    if (profile === 'fabric') material.color.multiplyScalar(.92)
    material.userData.surfaceProfile = profile
  }
  snapshot() { return { variants: { ...this.profiles }, ...this.textures.snapshot() } }
  dispose() { this.textures.dispose() }
}
