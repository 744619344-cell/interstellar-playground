import { HalfFloatType, LinearSRGBColorSpace, UnsignedByteType, Vector2, WebGLRenderTarget,
  type Camera, type Scene, type WebGLRenderer } from 'three'

/** Linear world texture for glass; copying the canvas into an sRGB texture is not WebGL-compatible. */
export class ShipWorldBackdrop {
  private target?: WebGLRenderTarget
  private size = new Vector2()
  constructor(private scene: Scene) {}
  render(renderer: WebGLRenderer, universe: Scene, camera: Camera, draw: () => void) {
    renderer.getDrawingBufferSize(this.size)
    const scale = Math.min(1, Math.sqrt(1_048_576 / Math.max(1, this.size.x * this.size.y)))
    this.size.set(Math.max(1, Math.floor(this.size.x * scale)), Math.max(1, Math.floor(this.size.y * scale)))
    if (!this.target) {
      const type = renderer.extensions.has('EXT_color_buffer_float') ? HalfFloatType : UnsignedByteType
      this.target = new WebGLRenderTarget(this.size.x, this.size.y, { type, depthBuffer: true })
      this.target.texture.colorSpace = LinearSRGBColorSpace
    }
    this.target.setSize(this.size.x, this.size.y)
    const previousTarget = renderer.getRenderTarget(), autoClear = renderer.autoClear
    const background = this.scene.background
    try {
      // Keep the original world depth on the canvas for planet/ship occlusion.
      // Render the same world separately in linear space; the glass pass supplies final tone mapping.
      renderer.setRenderTarget(this.target)
      renderer.autoClear = true
      renderer.render(universe, camera)
    } finally {
      renderer.setRenderTarget(previousTarget)
      renderer.autoClear = autoClear
    }
    try {
      this.scene.background = this.target.texture
      draw()
    } finally { this.scene.background = background }
  }
  dispose() { this.target?.dispose(); this.target = undefined }
}
