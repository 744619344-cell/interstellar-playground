import { Box3, Group, Mesh, Scene, Texture, Vector3, type Material, type WebGLRenderer, type Camera } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { ShipReviewLighting, ShipVisibility } from './shipVisibility'
import { SHIP_PROTECTION } from '../../domain/shipNavigation'
import type { ShipCameraSubject } from '../../application/shipCameraRig'
import type { Vec3 } from '../../domain/vec3'

const modelUrl = new URL('../../../../assets/models/spacecraft-pbr-lod1.glb', import.meta.url).href

/** Asset owner: derived resources are restored before this releases original resources. */
export function disposeShipModel(model: Group) {
  const geometries = new Set<Mesh['geometry']>(), materials = new Set<Material>(), textures = new Set<Texture>()
  model.traverse(item => {
    if (!(item instanceof Mesh)) return
    geometries.add(item.geometry)
    for (const material of Array.isArray(item.material) ? item.material : [item.material]) materials.add(material)
  })
  for (const material of materials) for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value)
  const images = new Set<{ close?: () => void }>() // Images may be shared by several texture slots.
  for (const texture of textures) { if (texture.image) images.add(texture.image); texture.dispose() }
  for (const image of images) (image as { close?: () => void }).close?.()
  geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose())
  model.removeFromParent()
}

export function renderShipLayer(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
  const autoClear = renderer.autoClear
  try { renderer.autoClear = false; renderer.render(scene, camera) }
  finally { renderer.autoClear = autoClear }
}

export class ShipModelRuntime {
  readonly scene = new Scene()
  readonly root = new Group()
  private model?: Group
  private visibility?: ShipVisibility
  private lighting?: ShipReviewLighting
  private destroyed = false
  private status: 'loading' | 'ready' | 'failed' = 'loading'
  private plumes: Mesh[] = []

  constructor(private seatLoaded: (seat: Vec3) => void,
    load: () => Promise<Group> = () => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(modelUrl).then(gltf => gltf.scene)) {
    this.scene.add(this.root)
    void load().then(model => this.install(model)).catch(() => {
      if (!this.destroyed) { this.release(); this.status = 'failed' }
    })
  }

  private install(model: Group) {
    if (this.destroyed) { disposeShipModel(model); return }
    this.model = model
    model.updateMatrixWorld(true)
    const bounds = new Box3().setFromObject(model, true)
    const radius = new Vector3(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)),
      Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y)), Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z))).length()
    if (radius > SHIP_PROTECTION.radius) throw new Error('Ship exceeds protection envelope')
    const anchor = model.getObjectByName('Anchor_CockpitCamera')
    if (!anchor) throw new Error('Missing cockpit camera anchor')
    const seat = model.worldToLocal(anchor.getWorldPosition(new Vector3()))
    this.visibility = new ShipVisibility(model)
    this.lighting = new ShipReviewLighting([model])
    model.traverse(item => { if (item instanceof Mesh && item.name.startsWith('ThrusterPlume')) this.plumes.push(item) })
    this.root.add(model, this.lighting.root)
    this.seatLoaded({ x: seat.x, y: seat.y, z: seat.z })
    this.status = 'ready'
  }

  update(subject: ShipCameraSubject, origin: Vec3, cockpit: boolean, visible: boolean, thrust: number) {
    this.root.position.set(origin.x + subject.position.x, origin.y + subject.position.y, origin.z + subject.position.z)
    this.root.quaternion.copy(subject.orientation)
    this.root.visible = visible
    const view = cockpit ? 'cockpit' : 'exterior'
    this.visibility?.apply({ view, outerOpen: false, innerOpen: false, conservativeInterior: cockpit })
    this.lighting?.apply(view)
    this.plumes.forEach(mesh => mesh.scale.setScalar(thrust > 0 ? .3 + thrust * .7 : .001))
  }

  render(renderer: WebGLRenderer, camera: Camera) {
    if (this.status === 'ready' && this.root.visible && !this.destroyed) renderShipLayer(renderer, this.scene, camera)
  }
  snapshot() { return { status: this.status, ...this.visibility?.snapshot() } }
  private release() {
    this.lighting?.dispose(); this.visibility?.dispose()
    if (this.model) disposeShipModel(this.model)
    this.model = undefined; this.visibility = undefined; this.lighting = undefined; this.plumes = []
  }
  dispose() { if (!this.destroyed) { this.destroyed = true; this.release(); this.root.removeFromParent() } }
}
