import { Group, HemisphereLight, DirectionalLight, PointLight, Mesh, MeshStandardMaterial, Matrix4 } from 'three'
import { partitionInterior, type InteriorZone } from './shipInteriorPartition'
import { adaptedShipVisible } from './adaptedShipVisibility'
import { shipInteriorFinish, applyShipInteriorFinish, type InteriorFinish } from './shipInteriorFinish'
import { applyCurrentShipGlass } from './currentShipGlass'
import { MicrogravitySurfaceFinish, microgravitySurface, useRefinedCabin } from './microgravitySurfaceFinish'

export type ShipInteriorView = 'exterior' | 'cockpit' | 'cabin' | 'airlock' | 'cutaway'
export interface VisibilityState { view: ShipInteriorView; outerOpen: boolean; innerOpen: boolean; conservativeInterior?: boolean }
const interior = /^(Furniture|Ceiling|Walls|Console_Bar|Door_Inner|Door_Outer_Liner)/
const partitioned = /^(Furniture_Atlas|Ceiling_Atlas|Walls_Interior_Ceramic)$/

/** Owns derived meshes/materials only; caller owns loaded models and their textures. */
export class ShipVisibility {
  private originals: { mesh: Mesh; visible: boolean }[] = []
  private derived: Mesh[] = []
  private meshes: { mesh: Mesh; visible: boolean; zone?: InteriorZone }[] = []
  private destroyed = false

  constructor(private model: Group) {
    model.updateMatrixWorld(true)
    const inverse = model.matrixWorld.clone().invert()
    const sources: Mesh[] = []
    model.traverse(o => { if (o instanceof Mesh) sources.push(o) })
    for (const mesh of sources) {
      if (!partitioned.test(mesh.name)) { this.meshes.push({ mesh, visible: mesh.visible }); continue }
      this.originals.push({ mesh, visible: mesh.visible }); mesh.visible = false
      const matrix = new Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)
      for (const { zone, geometry } of partitionInterior(mesh.geometry, matrix)) {
        const part = new Mesh(geometry, mesh.material)
        part.name = `${mesh.name}_${zone}`
        part.position.copy(mesh.position); part.quaternion.copy(mesh.quaternion); part.scale.copy(mesh.scale)
        mesh.parent!.add(part); this.derived.push(part)
        this.meshes.push({ mesh: part, visible: true, zone })
      }
    }
  }

  apply(state: VisibilityState) {
    if (this.destroyed) return
    for (const item of this.meshes) {
      const adapted = adaptedShipVisible(item.mesh, state)
      if (adapted !== undefined) { item.mesh.visible = item.visible && adapted; continue }
      const name = item.mesh.name
      const inside = interior.test(name)
      let visible = true
      if (state.view === 'exterior') visible = !inside || state.outerOpen
      else if (state.view === 'cutaway') visible = !/^(Exterior_|Canopy|Ceiling|Walls|AftFrame)/.test(name)
      else {
        visible = !/^(Exterior_|Canopy|ThrusterPlume|AftFrame|Door_Outer$|OuterDoorCore|MovingOuterSeal)/.test(name)
        if (item.zone) visible &&= item.zone === 'shared' || state.innerOpen || !!state.conservativeInterior || item.zone === state.view
        if (name.startsWith('Console_Bar')) visible &&= state.view === 'cockpit' || state.innerOpen
      }
      item.mesh.visible = item.visible && visible
    }
  }

  snapshot() {
    const visible = this.meshes.filter(item => item.mesh.visible)
    return { meshes: visible.length, triangles: visible.reduce((n, { mesh }) =>
      n + (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3, 0) }
  }

  currentDetail(near: boolean) {
    if (this.destroyed) return
    for (const { mesh, visible } of this.meshes) {
      const part = mesh.userData.currentShipPart
      if (part === 'equipment' || part === 'crew') mesh.visible = visible && near
    }
  }

  dispose() {
    if (this.destroyed) return
    this.destroyed = true
    for (const mesh of this.derived) { mesh.removeFromParent(); mesh.geometry.dispose() }
    for (const { mesh, visible } of [...this.meshes, ...this.originals]) mesh.visible = visible
    this.derived = []; this.meshes = []; this.originals = []
  }
}

/** Lighting for the isolated review scene, never installed into the solar-system scene. */
export class ShipReviewLighting {
  readonly root = new Group()
  private fill = new HemisphereLight(0xc9e5ef, 0x302c25, 1)
  private sun = new DirectionalLight(0xffffff, 2)
  private cabin = [-4, 1, 6].map(z => {
    const light = new PointLight(0xffebcb, 3, 6, 2)
    light.position.set(0, .65, z); return light
  })
  private copies = new Map<MeshStandardMaterial, Map<string, MeshStandardMaterial>>()
  private targets: { mesh: Mesh; material: MeshStandardMaterial; profile: InteriorFinish }[] = []
  private adapted = false
  private master = false
  private current = false
  private micro = false
  private refined = false
  private surface?: MicrogravitySurfaceFinish
  private key?: DirectionalLight
  private shadows: { mesh: Mesh; cast: boolean; receive: boolean }[] = []
  constructor(models: Group[]) {
    this.micro = models.some(model => model.userData.microgravityCandidate === true)
    this.refined = this.micro && useRefinedCabin()
    if (this.refined) {
      this.surface = new MicrogravitySurfaceFinish(); this.key = new DirectionalLight(0xe6edf0, 1.5)
      this.key.name = 'CabinCeilingKey'
      this.key.position.set(-.6, .95, -1.6); this.key.target.position.set(-.3, -.4, 2)
      this.key.castShadow = true; this.key.shadow.mapSize.set(1024, 1024)
      Object.assign(this.key.shadow.camera, { left: -4, right: 4, top: 6, bottom: -6, near: .05, far: 20 })
      this.key.shadow.bias = -.00025; this.key.shadow.normalBias = .006; this.key.shadow.radius = 2
      this.root.add(this.key, this.key.target)
    }
    this.current = this.micro || models.some(model => model.userData.currentFittedAssembly === true)
    this.adapted = models.some(model => !!model.getObjectByName('Ship_Adapted'))
    this.master = models.some(model => model.getObjectByName('Ship_Adapted')?.userData.masterInterior === true)
    if (this.master) {
      const extra = new PointLight(0xffebcb, 4, 7, 2); extra.position.set(0, .69, -1); this.cabin.push(extra)
      this.cabin[1].position.z = 2
      this.cabin.forEach(light => { light.position.y = .69; light.distance = 7 })
    }
    this.sun.position.set(4, 8, 10)
    if (this.current) {
      this.sun.position.set(3, 8, -4)
      this.cabin.forEach((light, index) => { light.position.set(0, 1, [-5, 0, 5, 2][index]); light.distance = 10 })
    }
    this.root.add(this.fill, this.sun, this.sun.target, ...this.cabin)
    for (const model of models) model.traverse(mesh => {
      if (!(mesh instanceof Mesh) || !(mesh.material instanceof MeshStandardMaterial)) return
      const original = mesh.material
      const profile = shipInteriorFinish(mesh, original)
      const surface = this.refined ? microgravitySurface(mesh, original) : 'original'
      const variant = this.refined ? `${profile}:${surface}` : profile
      const variants = this.copies.get(original) ?? new Map<string, MeshStandardMaterial>()
      if (!variants.has(variant)) { const copy = original.clone(); this.surface?.apply(copy, surface); variants.set(variant, copy) }
      this.copies.set(original, variants)
      this.targets.push({ mesh, material: original, profile }); mesh.material = variants.get(variant)!
      if (this.refined) {
        this.shadows.push({ mesh, cast: mesh.castShadow, receive: mesh.receiveShadow })
        const opaque = !('transmission' in original && Number(original.transmission) > 0) && !original.transparent
        // Source modules are dense: keep dynamic crew projection, use AO for static fittings.
        mesh.castShadow = opaque && mesh.userData.currentShipPart === 'crew'
        mesh.receiveShadow = opaque
      }
    })
  }
  apply(view: ShipInteriorView, cabinMode: 'normal' | 'rest' = 'normal') {
    if (this.current) {
      const rest = cabinMode === 'rest' ? .24 : 1
      const outside = view === 'exterior' || view === 'cutaway'
      this.sun.intensity = this.refined ? outside ? 2 : .18 : this.micro ? .4 : 2
      this.fill.intensity = this.refined ? outside ? .35 : .18 : this.micro ? .45 : .7
      if (this.key) { this.key.visible = !outside; this.key.intensity = 1.5 * rest }
      this.cabin.forEach((light, i) => { light.visible = true; light.intensity = this.refined ? [1.6, 1.3, 1.1, 1][i] * rest : this.micro ? 4.5 * rest : 7 })
      this.copies.forEach(variants => variants.forEach(material => {
        material.envMapIntensity = this.refined ? outside ? .75 : .38 : this.micro ? .45 : .7; applyCurrentShipGlass(material)
      }))
      return // Preserve the current GLB's physical transmission, opacity and material channels.
    }
    const inside = !['exterior', 'cutaway'].includes(view)
    this.sun.intensity = inside ? (this.master ? 0 : this.adapted ? .15 : 0) : 2
    this.fill.intensity = inside ? (this.master ? .65 : this.adapted ? .8 : .5) : 2
    this.cabin.forEach(light => { light.visible = inside; light.intensity = this.adapted ? 4 : 3 })
    this.copies.forEach(variants => variants.forEach(material => {
      material.envMapIntensity = inside ? (this.master ? .28 : this.adapted ? .2 : .25) : 1
    }))
    for (const { mesh, material: original, profile } of this.targets) {
      if (!(mesh.material instanceof MeshStandardMaterial)) continue
      const material = mesh.material
      applyShipInteriorFinish(material, original, profile, inside, this.adapted)
      if (mesh.userData.part === 'glass') material.opacity = inside ? .12 : .92
    }
  }
  surfaceSnapshot() { return { refined: this.refined, ...this.surface?.snapshot() } }
  dispose() {
    this.root.removeFromParent()
    this.targets.forEach(({ mesh, material }) => { mesh.material = material })
    this.shadows.forEach(({ mesh, cast, receive }) => { mesh.castShadow = cast; mesh.receiveShadow = receive }); this.shadows = []
    this.surface?.dispose(); this.surface = undefined; this.key?.shadow.dispose(); this.key = undefined
    this.copies.forEach(variants => variants.forEach(material => material.dispose())); this.copies.clear(); this.targets = []
  }
}
