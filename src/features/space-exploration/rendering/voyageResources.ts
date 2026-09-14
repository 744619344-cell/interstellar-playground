import { LinearMipmapLinearFilter, SRGBColorSpace, type Texture, type TextureLoader } from 'three'

export class VoyageResourceGate {
  private targetGeneration = 0
  private destroyed = false

  get currentTarget() {
    return this.targetGeneration
  }

  bumpTarget() {
    this.targetGeneration += 1
    return this.targetGeneration
  }

  isTargetCurrent(generation: number) {
    return !this.destroyed && generation === this.targetGeneration
  }

  isWorldCurrent() {
    return !this.destroyed
  }

  destroy() {
    this.destroyed = true
  }
}

export function colorTexture(texture: Texture) {
  texture.colorSpace = SRGBColorSpace
  texture.generateMipmaps = true
  texture.minFilter = LinearMipmapLinearFilter
  return texture
}

export function adoptTexture(
  current: boolean,
  texture: { dispose(): void },
  assign: () => void
) {
  if (!current) {
    texture.dispose()
    return false
  }
  assign()
  return true
}

export function loadGeneratedTexture(
  loader: TextureLoader,
  url: string,
  isCurrent: () => boolean,
  onReady: (texture: Texture) => void,
  onFail?: () => void
) {
  loader.load(
    url,
    (texture) => {
      adoptTexture(isCurrent(), texture, () => onReady(colorTexture(texture)))
    },
    undefined,
    () => {
      if (isCurrent()) onFail?.()
    }
  )
}

export function collectMaterialTextures(material: {
  map?: { dispose?: () => void } | null
  alphaMap?: { dispose?: () => void } | null
  emissiveMap?: { dispose?: () => void } | null
}) {
  return new Set([material.map, material.alphaMap, material.emissiveMap].filter(Boolean))
}

export function disposeObject(object: { traverse(callback: (child: any) => void): void }) {
  object.traverse((child: any) => {
    child.geometry?.dispose?.()
    const materials = Array.isArray(child.material) ? child.material : child.material ? [child.material] : []
    materials.forEach((material: any) => {
      collectMaterialTextures(material).forEach((texture) => texture?.dispose?.())
      material.dispose?.()
    })
  })
}
