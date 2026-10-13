import { Group, Mesh, Scene, Texture, Vector3,
  type AnimationClip, type Material, type WebGLRenderer, type Camera } from 'three'
import { loadShipMaster } from './shipMasterLoader'
import { ShipReviewLighting, ShipVisibility } from './shipVisibility'
import { SHIP_PROTECTION } from '../../domain/shipNavigation'
import type { ShipCameraSubject } from '../../application/shipCameraRig'
import type { Vec3 } from '../../domain/vec3'
import { SHIP_INTERACTION_ANCHORS, SHIP_INTERACTION_NODE,
  type ShipInteractionAnchor, type ShipInteractionState } from '../../domain/shipInteraction'
import { ShipMechanisms } from './shipMechanisms'
import { ShipHighPolyPreview } from './shipHighPolyPreview'
import { ShipModelEnvironment } from './shipModelEnvironment'
import { ShipExteriorDetail } from './shipExteriorDetail'
import { addShipPressureBoundaries } from './shipPressureBoundary'
import { fitShipInteriorModules } from './shipInteriorFit'
import { addShipInteriorJoinery } from './shipInteriorJoinery'
import { shipCabinObstacles } from './shipCabinCamera'
import { shipMasterCabinVolume } from './shipCabinVolume'
import { ShipContactShading } from './shipContactShading'

export interface ShipModelAsset { scene: Group; animations: readonly AnimationClip[] }
/** The protection sphere contains geometry, including child transforms, rather than empty box corners. */
export function shipModelRadius(model: Group) {
  model.updateMatrixWorld(true)
  const point = new Vector3()
  let radiusSquared = 0
  model.traverse(item => {
    if (!(item instanceof Mesh)) return
    const positions = item.geometry.getAttribute('position')
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(item.matrixWorld)
      radiusSquared = Math.max(radiusSquared, point.lengthSq())
    }
  })
  return Math.sqrt(radiusSquared)
}
type ShipModelSource = Group | ShipModelAsset
const modelAsset = (source: ShipModelSource): ShipModelAsset => source instanceof Group
  ? { scene: source, animations: [] } : source

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
  private environment = new ShipModelEnvironment(this.scene)
  private contact = new ShipContactShading(this.scene)
  private model?: Group
  private visibility?: ShipVisibility
  private lighting?: ShipReviewLighting
  private mechanisms?: ShipMechanisms
  private highPoly?: ShipHighPolyPreview
  private exterior?: ShipExteriorDetail
  private cockpit = false
  private doorsOpen = false
  private suspended = false
  private generation = 0
  private aborter?: AbortController
  private destroyed = false
  private status: 'loading' | 'ready' | 'failed' = 'loading'
  private plumes: Mesh[] = []
  private anchors: ShipInteractionAnchor[] = []

  constructor(private seatLoaded: (seat: Vec3, pitchOffset?: number, standing?: Vec3) => void,
    private load: (signal: AbortSignal) => Promise<ShipModelSource> = signal => loadShipMaster(signal, disposeShipModel)) {
    this.scene.add(this.root)
    this.startLoading()
  }

  private startLoading() {
    const generation = ++this.generation
    this.aborter = new AbortController()
    this.status = 'loading'
    void this.load(this.aborter.signal).then(source => {
      const asset = modelAsset(source)
      if (this.destroyed || this.suspended || generation !== this.generation) { disposeShipModel(asset.scene); return }
      this.install(asset)
    }).catch(() => {
      if (!this.destroyed && !this.suspended && generation === this.generation) { this.release(); this.status = 'failed' }
    })
  }

  private install(asset: ShipModelAsset) {
    const model = asset.scene
    if (this.destroyed) { disposeShipModel(model); return }
    this.model = model
    if (!model.getObjectByName('Ship_Adapted')?.userData.masterInterior) {
      fitShipInteriorModules(model)
      addShipPressureBoundaries(model)
      addShipInteriorJoinery(model)
    }
    model.updateMatrixWorld(true)
    const radius = shipModelRadius(model)
    if (radius > SHIP_PROTECTION.radius) throw new Error('Ship exceeds protection envelope')
    this.anchors = SHIP_INTERACTION_ANCHORS.filter(id => !!model.getObjectByName(SHIP_INTERACTION_NODE[id]))
    if (this.anchors.length !== SHIP_INTERACTION_ANCHORS.length) throw new Error('Missing ship interaction anchor')
    const anchor = model.getObjectByName(SHIP_INTERACTION_NODE.cockpit)!
    const seat = model.worldToLocal(anchor.getWorldPosition(new Vector3()))
    this.mechanisms = new ShipMechanisms(model, asset.animations)
    this.visibility = new ShipVisibility(model)
    this.lighting = new ShipReviewLighting([model])
    model.traverse(item => { if (item instanceof Mesh && item.name.startsWith('ThrusterPlume')) this.plumes.push(item) })
    this.root.add(model, this.lighting.root)
    if (model.getObjectByName('Ship_Adapted')) {
      this.exterior = new ShipExteriorDetail(disposeShipModel); this.root.add(this.exterior.root)
    }
    if (typeof window !== 'undefined' && import.meta.env.DEV
      && new URLSearchParams(window.location.search).has('hunyuanPreview')) {
      this.highPoly = new ShipHighPolyPreview()
      this.root.add(this.highPoly.root)
      void this.highPoly.load()
    }
    const pitch = model.getObjectByName('Ship_Adapted')?.userData.pilotPitchOffset
    const standing = model.getObjectByName('Ship_Adapted')?.userData.masterInterior
      ? model.worldToLocal(model.getObjectByName(SHIP_INTERACTION_NODE['stand-up'])!.getWorldPosition(new Vector3())) : undefined
    this.seatLoaded({ x: seat.x, y: seat.y, z: seat.z }, typeof pitch === 'number' ? pitch : undefined,
      standing ? { x: standing.x, y: standing.y, z: standing.z } : undefined)
    this.status = 'ready'
  }

  update(subject: ShipCameraSubject, origin: Vec3, cockpit: boolean, visible: boolean, thrust: number,
    interaction: ShipInteractionState) {
    this.root.position.set(origin.x + subject.position.x, origin.y + subject.position.y, origin.z + subject.position.z)
    this.root.quaternion.copy(subject.orientation)
    this.root.visible = visible && !this.suspended
    this.cockpit = cockpit
    this.doorsOpen = interaction.doors.outer.progress > 0 || interaction.doors.inner.progress > 0
    const view = cockpit ? 'cockpit' : 'exterior'
    this.mechanisms?.apply(interaction)
    this.visibility?.apply({ view, outerOpen: interaction.doors.outer.progress > 0,
      innerOpen: interaction.doors.inner.progress > 0, conservativeInterior: cockpit })
    this.highPoly?.setCockpit(cockpit)
    if (cockpit && this.highPoly?.snapshot().status === 'ready') modelCockpitHidden(this.model)
    this.lighting?.apply(view)
    this.plumes.forEach(mesh => mesh.scale.setScalar(thrust > 0 ? .3 + thrust * .7 : .001))
  }

  render(renderer: WebGLRenderer, camera: Camera) {
    if (this.status === 'ready' && this.root.visible && !this.destroyed && !this.suspended) {
      if (this.model) this.model.visible = !this.exterior?.apply(camera.position.distanceTo(this.root.position),
        this.cockpit, this.doorsOpen, !!this.highPoly)
      this.environment.ensure(renderer)
      if (this.cockpit && this.model?.userData.masterInterior) this.contact.render(renderer, camera)
      else renderShipLayer(renderer, this.scene, camera)
    }
  }
  snapshot() { return { status: this.status, suspended: this.suspended, anchors: [...this.anchors],
    meshes: 0, triangles: 0, ...this.visibility?.snapshot(),
    ...this.exterior?.snapshot(),
    cockpitFov: this.model?.getObjectByName('Ship_Adapted') ? 55 : 75,
    highPoly: this.highPoly?.snapshot() } }
  cabinObstacles() { return this.model ? shipCabinObstacles(this.model) : [] }
  cabinVolume() { return this.model ? shipMasterCabinVolume(this.model) : undefined }
  suspend(hidden: boolean) {
    if (this.destroyed || hidden === this.suspended) return
    this.suspended = hidden
    if (hidden) {
      this.generation++; this.aborter?.abort(); this.aborter = undefined
      this.release(); this.status = 'loading'; this.root.visible = false
    } else this.startLoading()
  }
  private release() {
    this.contact.dispose()
    this.environment.dispose()
    this.exterior?.dispose(); this.exterior = undefined
    this.highPoly?.dispose(); this.highPoly = undefined
    this.mechanisms?.dispose(); this.lighting?.dispose(); this.visibility?.dispose()
    if (this.model) disposeShipModel(this.model)
    this.model = undefined; this.mechanisms = undefined; this.visibility = undefined; this.lighting = undefined
    this.plumes = []; this.anchors = []
  }
  dispose() {
    if (this.destroyed) return
    this.destroyed = true; this.generation++; this.aborter?.abort(); this.aborter = undefined
    this.release(); this.root.removeFromParent()
  }
}

function modelCockpitHidden(model?: Group) {
  model?.traverse(item => {
    if (item instanceof Mesh && /^(Furniture_Atlas_cockpit|Ceiling_Atlas_cockpit|Walls_Interior_Ceramic_cockpit|Console_Bar)/.test(item.name))
      item.visible = false
  })
}
