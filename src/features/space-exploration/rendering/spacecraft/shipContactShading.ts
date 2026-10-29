import { Color, NoToneMapping, NormalBlending, PerspectiveCamera, Vector2, WebGLRenderTarget,
  HalfFloatType, type Scene, type Camera, type WebGLRenderer, Mesh, MeshPhysicalMaterial } from 'three'
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

/** Local cabin contact shading; transparent output preserves the already-rendered universe. */
export class ShipContactShading {
  private target?: WebGLRenderTarget
  private sao?: SAOPass
  private output?: OutputPass
  private camera = new PerspectiveCamera()
  private size = new Vector2()
  private width = 0
  private height = 0
  constructor(private scene: Scene) {}
  render(renderer: WebGLRenderer, source: Camera, refined = false) {
    if (!(source instanceof PerspectiveCamera)) { renderer.render(this.scene, source); return }
    this.camera.copy(source, false); this.camera.near = .025; this.camera.far = 45
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld(true)
    renderer.getDrawingBufferSize(this.size)
    this.ensure(this.size.x, this.size.y)
    Object.assign(this.sao!.params, { saoBias: refined ? .5 : .65, saoIntensity: refined ? .018 : .009,
      saoKernelRadius: refined ? 9 : 12, saoBlurRadius: refined ? 3 : 4 })
    const oldTarget = renderer.getRenderTarget(), oldClear = renderer.autoClear
    const oldTone = renderer.toneMapping, oldColor = renderer.getClearColor(new Color()), oldAlpha = renderer.getClearAlpha()
    const oldOverride = this.scene.overrideMaterial
    const glazing: Mesh[] = []
    try {
      renderer.toneMapping = NoToneMapping; renderer.autoClear = false
      renderer.setRenderTarget(this.target!); renderer.setClearColor(0, 0); renderer.clear()
      renderer.render(this.scene, this.camera)
      this.scene.traverse(o => { if (o instanceof Mesh && o.visible && (o.userData.part === 'glass' ||
        (Array.isArray(o.material) ? o.material : [o.material]).some(m => m instanceof MeshPhysicalMaterial && m.transmission > 0 || m.transparent && m.opacity < .8))) { glazing.push(o); o.visible = false } })
      const shadows = renderer.shadowMap.enabled; renderer.shadowMap.enabled = false
      try { this.sao!.render(renderer, this.target!, this.target!, 0, false) }
      finally { renderer.shadowMap.enabled = shadows }
      glazing.forEach(o => { o.visible = true })
      renderer.toneMapping = oldTone; renderer.setRenderTarget(oldTarget)
      // OutputPass writes without a clear and composites with the scene underneath.
      this.output!.renderToScreen = !oldTarget
      this.output!.render(renderer, oldTarget ?? this.target!, this.target!, 0, false)
    } finally {
      glazing.forEach(o => { o.visible = true })
      renderer.setRenderTarget(oldTarget); renderer.setClearColor(oldColor, oldAlpha)
      renderer.autoClear = oldClear; renderer.toneMapping = oldTone
      this.scene.overrideMaterial = oldOverride
    }
  }
  private ensure(width: number, height: number) {
    if (!this.target) {
      this.target = new WebGLRenderTarget(width, height, { type: HalfFloatType, samples: 2 })
      this.sao = new SAOPass(this.scene, this.camera)
      Object.assign(this.sao.params, { saoBias: .5, saoIntensity: .018, saoScale: 1,
        saoKernelRadius: 9, saoBlurRadius: 3, saoBlurStdDev: 2, saoBlurDepthCutoff: .002 })
      this.output = new OutputPass(); this.output.clear = false
      this.output.material.transparent = true; this.output.material.blending = NormalBlending
      this.output.material.depthTest = false; this.output.material.depthWrite = false
    }
    if (width === this.width && height === this.height) return
    this.width = width; this.height = height; this.target.setSize(width, height)
    this.sao!.setSize(Math.ceil(width * .6), Math.ceil(height * .6))
  }
  dispose() {
    this.target?.dispose(); this.sao?.dispose(); this.output?.dispose()
    this.target = undefined; this.sao = undefined; this.output = undefined
    this.width = 0; this.height = 0
  }
}
