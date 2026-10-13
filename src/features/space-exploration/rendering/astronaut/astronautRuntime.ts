import { Color, DirectionalLight, Group, HemisphereLight, PerspectiveCamera, PMREMGenerator, Scene, SkinnedMesh, type WebGLRenderer } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { disposeShipModel } from '../spacecraft/shipModelRuntime'

const url = new URL('../../../../assets/models/astronaut-rigged-v4.glb', import.meta.url).href
export function disposeAstronaut(model: Group) {
  const skeletons = new Set<SkinnedMesh['skeleton']>()
  model.traverse(node => { if (node instanceof SkinnedMesh) skeletons.add(node.skeleton) })
  skeletons.forEach(skeleton => skeleton.dispose())
  disposeShipModel(model)
}

/** Owns the character scene; borrows the application's single renderer. */
export class AstronautRuntime {
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(42, 1, .01, 30)
  status: 'loading' | 'ready' | 'failed' = 'loading'
  private model?: Group
  private destroyed = false
  private yaw = .28
  private pitch = .05
  private distance = 3.4
  private environment?: ReturnType<PMREMGenerator['fromScene']>

  constructor(renderer: WebGLRenderer,
    load = () => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url).then(asset => asset.scene)) {
    this.scene.background = new Color('#101923')
    const generator = new PMREMGenerator(renderer), room = new RoomEnvironment()
    try { this.environment = generator.fromScene(room); this.scene.environment = this.environment.texture }
    finally { room.dispose(); generator.dispose() }
    this.scene.add(new HemisphereLight(0xffffff, 0x4b5360, .7))
    const key = new DirectionalLight(0xffffff, 1.5)
    key.position.set(3, 4, 5); this.scene.add(key)
    void load().then(model => {
      if (this.destroyed) { disposeAstronaut(model); return }
      this.model = model; this.scene.add(model); this.status = 'ready'
    }).catch(() => { if (!this.destroyed) this.status = 'failed' })
  }

  orbit(dx: number, dy: number) {
    this.yaw -= dx * .008
    this.pitch = Math.max(-.65, Math.min(.65, this.pitch + dy * .006))
  }
  zoom(delta: number) { this.distance = Math.max(1.7, Math.min(6, this.distance * Math.exp(delta * .001))) }
  render(renderer: WebGLRenderer, aspect: number) {
    if (this.destroyed) return
    this.camera.aspect = aspect; this.camera.updateProjectionMatrix()
    const d = this.distance
    this.camera.position.set(Math.sin(this.yaw) * d * Math.cos(this.pitch), .95 + Math.sin(this.pitch) * d,
      Math.cos(this.yaw) * d * Math.cos(this.pitch))
    this.camera.lookAt(0, .95, 0)
    const exposure = renderer.toneMappingExposure
    try { renderer.toneMappingExposure = 1; renderer.render(this.scene, this.camera) }
    finally { renderer.toneMappingExposure = exposure }
  }
  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    if (this.model) disposeAstronaut(this.model)
    this.model = undefined; this.environment?.dispose(); this.scene.clear()
  }
}
