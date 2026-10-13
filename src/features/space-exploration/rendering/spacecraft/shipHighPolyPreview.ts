import { Box3, Group, Mesh, Texture, Vector3, type Material } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const base = '/output/hunyuan-adaptation/raw-glb/'
const seatUrl = '/assets-source/blender/spacecraft/redesign/hunyuan-adaptation/cockpit-reuse-study.glb'
const specs = [
  { id: 'floor', scale: 2.4, positions: [[0, .48, -2]] },
  { id: 'sidewall', scale: 2.45, positions: [[-1.18, 1.43, -2], [1.18, 1.43, -2]], mirror: true },
  { id: 'ceiling', scale: 2.7, positions: [[0, 2.25, -2]] },
  { id: 'main-console', scale: 1.9, heightScale: 1.2, positions: [[0, 1.02, -2.67]] },
  { id: 'center-console', scale: 1, positions: [[0, 1.03, -1.45]] },
  { id: 'throttle', scale: .7, positions: [[0, 1, -2.15]] },
  { id: 'joystick', scale: .65, positions: [[-.95, 1.16, -1.9], [.95, 1.16, -1.9]] },
  { id: 'pedals', scale: .65, positions: [[-.62, .75, -2.45], [.62, .75, -2.45]] }
] as const

function disposeGroup(root: Group, detach = true) {
  const geometries = new Set<Mesh['geometry']>(), materials = new Set<Material>(), textures = new Set<Texture>()
  root.traverse(item => {
    if (!(item instanceof Mesh)) return
    geometries.add(item.geometry)
    for (const material of Array.isArray(item.material) ? item.material : [item.material]) materials.add(material)
  })
  const images = new Set<{ close?: () => void }>()
  for (const material of materials) for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value)
  for (const texture of textures) { if (texture.image) images.add(texture.image); texture.dispose() }
  for (const image of images) image.close?.()
  geometries.forEach(geometry => geometry.dispose())
  materials.forEach(material => material.dispose())
  if (detach) root.removeFromParent()
}

/** Dev-only, opt-in visual test. The saved GLBs remain unchanged. */
export class ShipHighPolyPreview {
  readonly root = new Group()
  private readonly loader = new GLTFLoader()
  private aborter?: AbortController
  private generation = 0
  private disposed = false
  private suspended = false
  private cockpit = false
  private loaded = 0
  private status: 'loading' | 'ready' | 'failed' | 'suspended' = 'loading'

  constructor() { this.root.position.set(0, -1.25, -2.4) }

  snapshot() { return { status: this.status, loaded: this.loaded, total: specs.length } }
  setCockpit(cockpit: boolean) { this.cockpit = cockpit; this.root.visible = cockpit && this.status === 'ready' }

  suspend(hidden: boolean) {
    if (this.disposed || this.suspended === hidden) return
    this.suspended = hidden
    if (hidden) { this.clear(); this.status = 'suspended' }
    else void this.load()
  }

  private clear() {
    this.generation++
    this.aborter?.abort(); this.aborter = undefined
    disposeGroup(this.root, false)
    this.root.clear()
    this.loaded = 0; this.root.visible = false
  }

  private async fetchModel(url: string, current: number) {
    this.aborter = new AbortController()
    const response = await fetch(url, { signal: this.aborter.signal })
    if (!response.ok) throw new Error(`High-poly asset unavailable: ${response.status}`)
    const bytes = await response.arrayBuffer()
    if (current !== this.generation) return undefined
    const asset = await this.loader.parseAsync(bytes, url.slice(0, url.lastIndexOf('/') + 1))
    if (current !== this.generation) { disposeGroup(asset.scene); return undefined }
    return asset.scene
  }

  private place(model: Group, spec: (typeof specs)[number]) {
    const center = new Box3().setFromObject(model).getCenter(new Vector3())
    const copies = spec.positions.map((_, index) => index ? model.clone(true) : model)
    for (const [index, position] of spec.positions.entries()) {
      const holder = new Group(), copy = copies[index]
      copy.position.sub(center)
      holder.scale.set(spec.scale, 'heightScale' in spec ? spec.heightScale : spec.scale, spec.scale)
      if (index && 'mirror' in spec) holder.scale.x *= -1
      holder.position.set(position[0], position[1], position[2])
      holder.add(copy); this.root.add(holder)
    }
  }

  async load() {
    if (this.disposed || this.suspended) return
    this.clear(); this.status = 'loading'
    const current = this.generation
    try {
      const seats = await this.fetchModel(seatUrl, current)
      if (!seats) return
      seats.traverse(item => { if (item instanceof Mesh) item.visible = /^(Pilot_|Copilot_)/.test(item.name) })
      this.root.add(seats)
      for (const spec of specs) {
        const model = await this.fetchModel(base + spec.id + '.glb', current)
        if (!model) return
        this.place(model, spec)
        this.loaded++
      }
      if (current !== this.generation) return
      this.status = 'ready'
      this.root.visible = this.cockpit
    } catch {
      if (current !== this.generation) return
      this.clear(); this.status = 'failed'
    }
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.clear()
  }
}
