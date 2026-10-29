import { Group, Mesh, SkinnedMesh, Scene, Texture, Vector3,
  type AnimationClip, type Material, type WebGLRenderer, type Camera } from 'three'
import { loadCurrentShipAssembly, CURRENT_SHIP_ANCHORS, type ShipPreviewObserver } from './currentShipAssembly'
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
import { ShipWorldBackdrop } from './shipWorldBackdrop'
import type { ShipLoadObserver, ShipLoadProgress } from './shipLoadProgress'
import { CurrentCabinRuntime, type CabinHandAction, type CabinSavedState } from './currentCabinRuntime'
import type { CabinMove } from '../../domain/cabinCrewMotion'
import type { CabinFloatFrame } from '../../domain/cabinFloatMotion'
import { loadMicrogravityAssembly } from './microgravityAssembly'
import { MicrogravityCabinRuntime, type MicrogravitySaved } from './microgravityCabinRuntime'
import type { CabinEvaAction } from '../../domain/cabinEvaControls'
import type { CabinEquipmentAction } from '../../domain/cabinEquipmentCatalog'
import { useMicrogravityCabin } from '../../domain/cabinMode'
import { useRefinedCabin } from './microgravitySurfaceFinish'

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
  const skeletons = new Set<SkinnedMesh['skeleton']>()
  model.traverse(item => {
    if (item instanceof SkinnedMesh) skeletons.add(item.skeleton)
    if (!(item instanceof Mesh)) return
    geometries.add(item.geometry)
    for (const material of Array.isArray(item.material) ? item.material : [item.material]) materials.add(material)
  })
  for (const material of materials) for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value)
  const images = new Set<{ close?: () => void }>() // Images may be shared by several texture slots.
  for (const texture of textures) { if (texture.image) images.add(texture.image); texture.dispose() }
  for (const image of images) (image as { close?: () => void }).close?.()
  geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose())
  skeletons.forEach(item => item.dispose())
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
  private backdrop = new ShipWorldBackdrop(this.scene)
  private model?: Group
  private ownsModel = true
  private visibility?: ShipVisibility
  private lighting?: ShipReviewLighting
  private mechanisms?: ShipMechanisms
  private cabin?: CurrentCabinRuntime
  private micro?: MicrogravityCabinRuntime
  private microSaved?: MicrogravitySaved
  private cabinSaved?: CabinSavedState
  private highPoly?: ShipHighPolyPreview
  private exterior?: ShipExteriorDetail
  private cockpit = false
  private refined = false
  private doorsOpen = false
  private suspended = false
  private generation = 0
  private aborter?: AbortController
  private destroyed = false
  private status: 'loading' | 'ready' | 'failed' = 'loading'
  private plumes: Mesh[] = []
  private anchors: ShipInteractionAnchor[] = []
  private loadProgress?: ShipLoadProgress
  private loadError?: string
  private loadingTimer?: ReturnType<typeof setTimeout>

  constructor(private seatLoaded: (seat: Vec3, pitchOffset?: number, standing?: Vec3) => void,
    private load: (signal: AbortSignal, observe?: ShipLoadObserver, preview?: ShipPreviewObserver) => Promise<ShipModelSource> =
      (signal, observe, preview) => useMicrogravityCabin()
        ? loadMicrogravityAssembly(signal, disposeShipModel, undefined, observe, preview)
        : loadCurrentShipAssembly(signal, disposeShipModel, undefined, observe, preview),
    private stallMs = 90_000) {
    this.scene.add(this.root)
    this.startLoading()
  }

  private startLoading() {
    const generation = ++this.generation
    this.aborter = new AbortController()
    this.status = 'loading'
    this.loadError = undefined; this.loadProgress = undefined
    const observe: ShipLoadObserver = progress => {
      if (generation !== this.generation || this.destroyed || this.suspended) return
      this.loadProgress = { ...progress }; this.watchLoading(generation)
    }
    this.watchLoading(generation)
    const preview: ShipPreviewObserver = asset => {
      if (generation !== this.generation || this.destroyed || this.suspended) return
      if (asset) this.install(asset, false)
      else this.release()
    }
    void this.load(this.aborter.signal, observe, preview).then(source => {
      const asset = modelAsset(source)
      if (this.destroyed || this.suspended || generation !== this.generation) { disposeShipModel(asset.scene); return }
      this.stopWatching()
      this.install(asset)
    }).catch(() => {
      if (!this.destroyed && !this.suspended && generation === this.generation) {
        this.stopWatching(); this.aborter?.abort(); this.release(); this.status = 'failed'
        this.loadError = '下载连接中断或模型解析失败，请重试'
      }
    })
  }

  private stopWatching() { clearTimeout(this.loadingTimer); this.loadingTimer = undefined }
  private watchLoading(generation: number) {
    this.stopWatching()
    this.loadingTimer = setTimeout(() => {
      if (generation !== this.generation || this.destroyed || this.suspended) return
      this.generation++; this.aborter?.abort(); this.release(); this.status = 'failed'; this.root.visible = false
      this.loadError = '加载已长时间没有进展，请重试或检查网络连接'
      this.loadingTimer = undefined
    }, this.stallMs)
    this.loadingTimer.unref?.()
  }

  private install(asset: ShipModelAsset, owned = true) {
    const model = asset.scene
    if (this.destroyed) { disposeShipModel(model); return }
    this.model = model
    this.ownsModel = owned
    if (!model.getObjectByName('Ship_Adapted')?.userData.masterInterior) {
      fitShipInteriorModules(model)
      addShipPressureBoundaries(model)
      addShipInteriorJoinery(model)
    }
    model.updateMatrixWorld(true)
    const radius = shipModelRadius(model)
    if (radius > SHIP_PROTECTION.radius) throw new Error('Ship exceeds protection envelope')
    this.anchors = SHIP_INTERACTION_ANCHORS.filter(id => !!model.getObjectByName(SHIP_INTERACTION_NODE[id]))
    const required = model.userData.currentFittedAssembly ? CURRENT_SHIP_ANCHORS : SHIP_INTERACTION_ANCHORS
    if (required.some(id => !this.anchors.includes(id))) throw new Error('Missing ship interaction anchor')
    const anchor = model.getObjectByName(SHIP_INTERACTION_NODE.cockpit)!
    const seat = model.worldToLocal(anchor.getWorldPosition(new Vector3()))
    if (!model.userData.currentFittedAssembly) this.mechanisms = new ShipMechanisms(model, asset.animations)
    this.visibility = new ShipVisibility(model)
    this.lighting = new ShipReviewLighting([model])
    this.refined = model.userData.microgravityCandidate === true && useRefinedCabin()
    if (owned && model.userData.microgravityCandidate) this.micro = new MicrogravityCabinRuntime(model, this.microSaved)
    else if (owned && model.userData.currentFittedAssembly && model.getObjectByName('InteractiveAftBulkhead'))
      this.cabin = new CurrentCabinRuntime(model,this.cabinSaved)
    model.traverse(item => { if (item instanceof Mesh && item.name.startsWith('ThrusterPlume')) this.plumes.push(item) })
    this.root.add(model, this.lighting.root)
    // The current exterior URL is the very same hull already resident in this assembly.
    if (model.getObjectByName('Ship_Adapted') && !model.userData.currentFittedAssembly) {
      this.exterior = new ShipExteriorDetail(disposeShipModel); this.root.add(this.exterior.root)
    }
    if (!model.userData.currentFittedAssembly && typeof window !== 'undefined' && import.meta.env.DEV
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
    this.status = owned ? 'ready' : 'loading'
  }

  update(subject: ShipCameraSubject, origin: Vec3, cockpit: boolean, visible: boolean, thrust: number,
    interaction: ShipInteractionState) {
    this.root.position.set(origin.x + subject.position.x, origin.y + subject.position.y, origin.z + subject.position.z)
    this.root.quaternion.copy(subject.orientation)
    this.root.visible = visible && !this.suspended
    this.cockpit = cockpit
    const innerOpen = this.micro ? this.micro.snapshot().door.progress > 0 : this.cabin ? this.cabin.snapshot().door.progress > 0 : interaction.doors.inner.progress > 0
    this.doorsOpen = interaction.doors.outer.progress > 0 || innerOpen
    const view = cockpit ? 'cockpit' : 'exterior'
    this.mechanisms?.apply(interaction)
    this.visibility?.apply({ view, outerOpen: interaction.doors.outer.progress > 0,
      innerOpen, conservativeInterior: cockpit })
    this.highPoly?.setCockpit(cockpit)
    if (cockpit && this.highPoly?.snapshot().status === 'ready') modelCockpitHidden(this.model)
    this.lighting?.apply(view, this.micro?.cabinLight)
    this.plumes.forEach(mesh => mesh.scale.setScalar(thrust > 0 ? .3 + thrust * .7 : .001))
  }

  render(renderer: WebGLRenderer, camera: Camera, universe?: Scene) {
    if (this.model && this.status !== 'failed' && this.root.visible && !this.destroyed && !this.suspended) {
      const distance = camera.position.distanceTo(this.root.position)
      // Reuse current skins at map distance, rather than loading a second copy of the same GLB.
      if (this.model?.userData.currentFittedAssembly) this.visibility?.currentDetail(this.cockpit || distance < 120)
      if (this.model) this.model.visible = !this.exterior?.apply(distance,
        this.cockpit, this.doorsOpen, !!this.highPoly)
      this.environment.ensure(renderer)
      if (this.model?.userData.currentFittedAssembly && universe) {
        const shadow = renderer.shadowMap?.enabled
        try {
          if (this.refined && this.cockpit) renderer.shadowMap.enabled = true
          this.backdrop.render(renderer, universe, camera, () => this.refined && this.cockpit
            ? this.contact.render(renderer, camera, true) : renderShipLayer(renderer, this.scene, camera))
        } finally { if (shadow !== undefined) renderer.shadowMap.enabled = shadow }
      }
      else if (this.cockpit && this.model?.userData.masterInterior) this.contact.render(renderer, camera)
      else renderShipLayer(renderer, this.scene, camera)
    }
  }
  snapshot() { return { status: this.status, suspended: this.suspended, anchors: [...this.anchors],
    surface: this.lighting?.surfaceSnapshot(),
    previewReady: !!this.model && !this.ownsModel,
    loadProgress: this.loadProgress ? { ...this.loadProgress } : undefined, loadError: this.loadError,
    currentFittedAssembly: this.model?.userData.currentFittedAssembly === true, cabin: this.micro?.snapshot() ?? this.cabin?.snapshot(),
    meshes: 0, triangles: 0, ...this.visibility?.snapshot(),
    ...this.exterior?.snapshot(),
    cockpitFov: this.model?.getObjectByName('Ship_Adapted') ? 55 : 75,
    highPoly: this.highPoly?.snapshot() } }
  cabinObstacles() { return this.model ? shipCabinObstacles(this.model) : [] }
  updateCabin(seconds: number, input: CabinMove, yaw: number, pitch: number, walking: boolean, seated: boolean, running: boolean, frame?: CabinFloatFrame) {
    if (this.micro) { this.micro.update(seconds, input, yaw, walking, seated, running, frame); return this.micro.camera(yaw, pitch) }
    this.cabin?.update(seconds, input, yaw, walking, seated, running)
    return this.cabin?.camera(yaw, pitch)
  }
  cabinAction(action: CabinHandAction) { return this.micro?.action(action) ?? this.cabin?.action(action) ?? false }
  cabinInteract(){return this.micro?.interact() ?? this.cabin?.interact()}
  cabinSeat(seated:boolean){return this.micro?.requestSeat(seated) ?? this.cabin?.requestSeat(seated) ?? true}
  cabinKey(code: string, down: boolean) { return this.micro?.key(code, down) ?? false }
  clearCabinInput() { this.micro?.clearInput() }
  cabinControls() { return this.micro?.toggleControls() ?? false }
  cabinEva(action: CabinEvaAction) { return this.micro?.evaAction(action) ?? false }
  cabinEquipment(id: string, action: CabinEquipmentAction) { return this.micro?.equipmentAction(id, action) ?? false }
  cabinNudge(forward: number, right: number) { this.micro?.nudgeMove(forward, right); this.cabin?.nudgeMove(forward, right) }
  hitCabinButton(camera: Camera, x: number, y: number, width: number, height: number) {
    return this.micro?.hitButton(camera, x, y, width, height) ?? this.cabin?.hitButton(camera, x, y, width, height) ?? false
  }
  cancelCabinAction(stand=false) { this.micro?.cancel(stand); this.cabin?.cancel(stand) }
  resetCabin() { this.microSaved=undefined;this.micro?.reset();this.cabinSaved=undefined;this.cabin?.reset() }
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
    this.stopWatching()
    this.backdrop.dispose()
    this.contact.dispose()
    this.environment.dispose()
    this.exterior?.dispose(); this.exterior = undefined
    this.highPoly?.dispose(); this.highPoly = undefined
    if(this.micro){this.microSaved=this.micro.save();this.micro.dispose();this.micro=undefined}
    if(this.cabin){this.cabinSaved=this.cabin.save();this.cabin.dispose();this.cabin=undefined}
    this.mechanisms?.dispose(); this.lighting?.dispose(); this.visibility?.dispose()
    if (this.model) {
      if (this.ownsModel) disposeShipModel(this.model)
      else this.model.removeFromParent()
    }
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
