import { Group, Mesh } from 'three'
import { loadShipAsset } from './shipAssetLoader'
import { ShipReviewLighting } from './shipVisibility'
import { SHIP_MODEL_ASSETS } from './shipModelAssets'
import { prepareCurrentShipSkins } from './currentShipAssembly'

/** Hysteresis prevents flicker; any interior or moving-door view keeps the real animated assembly. */
export function distantExterior(distance: number, previous: boolean, cockpit: boolean, doorsOpen: boolean) {
  return !cockpit && !doorsOpen && Number.isFinite(distance) && distance > (previous ? 18 : 22)
}

/** Owns the static exterior and its material copies; the runtime's existing lights illuminate it. */
export class ShipExteriorDetail {
  readonly root = new Group()
  private model?: Group
  private materials?: ShipReviewLighting
  private destroyed = false
  private selected = false
  private triangles = 0
  private meshes = 0
  private aborter?: AbortController
  private generation = 0
  private wanted = false
  private failed = false

  constructor(private releaseModel: (model: Group) => void,
    private load: (signal: AbortSignal) => Promise<Group> = signal => loadShipAsset(SHIP_MODEL_ASSETS.exterior, signal, true).then(gltf => {
      prepareCurrentShipSkins(gltf.scene); return gltf.scene
    })) {
    this.root.visible = false
  }

  private startLoading() {
    const generation = ++this.generation
    this.aborter = new AbortController()
    void this.load(this.aborter.signal).then(model => {
      if (this.destroyed || !this.wanted || generation !== this.generation) { this.releaseModel(model); return }
      this.model = model; this.materials = new ShipReviewLighting([model])
      this.materials.apply('exterior')
      model.traverse(o => {
        if (!(o instanceof Mesh)) return
        this.meshes++; this.triangles += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3
      })
      this.root.add(model)
    }).catch(() => {
      if (this.destroyed || generation !== this.generation) return
      this.release(); this.failed = true
    }) // Full-quality assembly remains the fallback.
  }

  apply(distance: number, cockpit: boolean, doorsOpen: boolean, disabled = false) {
    const wanted = !this.destroyed && !disabled && distantExterior(distance, this.wanted, cockpit, doorsOpen)
    if (!wanted) {
      if (this.wanted) this.release()
      this.failed = false
    }
    this.wanted = wanted
    if (wanted && !this.model && !this.aborter && !this.failed) this.startLoading()
    this.selected = wanted && !!this.model
    this.root.visible = this.selected
    return this.selected
  }
  snapshot() { return this.selected ? { meshes: this.meshes, triangles: this.triangles } : undefined }
  private release() {
    this.generation++; this.aborter?.abort(); this.aborter = undefined
    this.materials?.dispose()
    if (this.model) { this.releaseModel(this.model); this.model.removeFromParent() }
    this.model = undefined; this.materials = undefined
    this.meshes = 0; this.triangles = 0; this.selected = false; this.root.visible = false
  }
  dispose() {
    if (this.destroyed) return
    this.destroyed = true; this.wanted = false
    this.release(); this.root.removeFromParent()
  }
}
