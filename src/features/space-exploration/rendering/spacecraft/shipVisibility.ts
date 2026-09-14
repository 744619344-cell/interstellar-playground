import { Group, HemisphereLight, DirectionalLight, PointLight, Mesh, MeshStandardMaterial, Matrix4 } from 'three'
import { partitionInterior, type InteriorZone } from './shipInteriorPartition'

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
  private copies = new Map<MeshStandardMaterial, MeshStandardMaterial>()
  private targets: { mesh: Mesh; material: MeshStandardMaterial }[] = []
  constructor(models: Group[]) {
    this.sun.position.set(4, 8, 10)
    this.root.add(this.fill, this.sun, this.sun.target, ...this.cabin)
    for (const model of models) model.traverse(mesh => {
      if (!(mesh instanceof Mesh) || !(mesh.material instanceof MeshStandardMaterial)) return
      const original = mesh.material
      if (!this.copies.has(original)) this.copies.set(original, original.clone())
      this.targets.push({ mesh, material: original }); mesh.material = this.copies.get(original)!
    })
  }
  apply(view: ShipInteriorView) {
    const inside = !['exterior', 'cutaway'].includes(view)
    this.sun.intensity = inside ? 0 : 2
    this.fill.intensity = inside ? .5 : 2
    this.cabin.forEach(light => { light.visible = inside })
    this.copies.forEach(material => { material.envMapIntensity = inside ? .25 : 1 })
  }
  dispose() {
    this.root.removeFromParent()
    this.targets.forEach(({ mesh, material }) => { mesh.material = material })
    this.copies.forEach(material => material.dispose()); this.copies.clear(); this.targets = []
  }
}
