import { DataTexture, NoColorSpace, RGBAFormat, Texture } from 'three'

export interface SurfaceRange { roughMin: number; roughMax: number; metalMax: number }
/** Remap numerical ORM only; base color, normals, geometry and source images remain intact. */
export function remapSurfaceOrm(data: Uint8ClampedArray, range: SurfaceRange, roughness = 1, metalness = 1) {
  const result = new Uint8Array(data)
  for (let i = 0; i < data.length; i += 4) {
    const rough = Math.max(0, Math.min(1, data[i + 1] / 255 * roughness))
    result[i + 1] = Math.round(255 * (range.roughMin + (range.roughMax - range.roughMin) * rough))
    result[i + 2] = Math.round(Math.min(255, data[i + 2] * metalness * range.metalMax))
  }
  return result
}

export class ShipSurfaceTextures {
  private samplers = new Map<Texture, Texture>()
  private orm = new Map<Texture, Map<string, Texture | undefined>>()
  sampler(source: Texture) {
    let copy = this.samplers.get(source)
    if (!copy) { copy = source.clone(); copy.anisotropy = 8; copy.needsUpdate = true; this.samplers.set(source, copy) }
    return copy
  }
  numerical(source: Texture, range: SurfaceRange, roughness: number, metalness: number) {
    const key = JSON.stringify([range, roughness, metalness]), variants = this.orm.get(source) ?? new Map<string, Texture | undefined>()
    this.orm.set(source, variants)
    if (variants.has(key)) return variants.get(key)
    let result: Texture | undefined
    const image = source.image as { width?: number; height?: number } | undefined
    if (typeof document !== 'undefined' && image?.width && image.height) {
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
      try {
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (context) {
          context.drawImage(image as CanvasImageSource, 0, 0)
          const data = context.getImageData(0, 0, canvas.width, canvas.height).data
          const texture = new DataTexture(remapSurfaceOrm(data, range, roughness, metalness), canvas.width, canvas.height, RGBAFormat)
          for (const property of ['wrapS', 'wrapT', 'magFilter', 'minFilter', 'channel', 'flipY', 'generateMipmaps'] as const) texture[property] = source[property] as never
          texture.offset.copy(source.offset); texture.repeat.copy(source.repeat); texture.center.copy(source.center)
          texture.rotation = source.rotation; texture.matrixAutoUpdate = source.matrixAutoUpdate; texture.matrix.copy(source.matrix)
          texture.colorSpace = NoColorSpace; texture.anisotropy = 8; texture.needsUpdate = true; result = texture
        }
      } finally { canvas.width = canvas.height = 0 }
    }
    variants.set(key, result); return result
  }
  snapshot() {
    const textures = [...this.orm.values()].flatMap(variants => [...variants.values()])
    return { samplers: this.samplers.size, numericalMaps: textures.filter(Boolean).length, fallbacks: textures.filter(t => !t).length }
  }
  dispose() {
    this.samplers.forEach(texture => texture.dispose()); this.samplers.clear()
    this.orm.forEach(variants => variants.forEach(texture => texture?.dispose())); this.orm.clear()
  }
}
