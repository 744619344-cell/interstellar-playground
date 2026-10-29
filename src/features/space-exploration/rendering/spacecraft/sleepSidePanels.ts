import { BufferAttribute, BufferGeometry, DoubleSide, Group, Material, Matrix4, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Vector3 } from 'three'
import profile from '../../../../assets/models/microgravity-cabin-20261025/sleep-side-v3.json'
import expanded from '../../../../assets/models/microgravity-cabin-20261025/sleep-side-v4.json'
import finish from '../../../../assets/models/microgravity-cabin-20261025/sleep-side-v5.json'

export type SleepSideVersion = 'v3' | 'v4' | 'v5'
export type SleepSideAnchor = { front: number; frontTriangle?: number[]; frontWeights?: number[]; rear: number[]; weights: number[] }

/** Only the six explicitly authorized strips; endpoints stay on actual source vertices or triangles. */
export function createSleepSideGeometries(source: BufferGeometry, matrix: Matrix4, moduleScale: number, version: SleepSideVersion = 'v3') {
  const selected = version === 'v3' ? profile : expanded
  if (source.getAttribute('position').count !== profile.sourceVertices || Math.abs(moduleScale - profile.moduleScale) > 1e-7) throw Error('Unverified sleep side source/scale')
  const base = source.getAttribute('position'), target = source.morphAttributes.position?.[0], columns = profile.columns
  if (!target || source.morphTargetsRelative) throw Error('Sleep side strips require the existing absolute bag pose')
  const panels: { name: string; anchors: SleepSideAnchor[] }[] = selected.panels
  return panels.map(panel => {
    const maximumDepth = version === 'v3' ? profile.maximumDepthM : expanded.maximumDepthBySideM[panel.name as 'left' | 'right']
    const positions: number[] = [], opened: number[] = [], uv: number[] = [], indices: number[] = [], [u0, v0, u1, v1] = profile.clothUv
    panel.anchors.forEach(({ front, frontTriangle = [front], frontWeights = [1], rear, weights }, row) => {
      const a = new Vector3(), next = new Vector3(), b = new Vector3(), rearPose = new Vector3()
      frontTriangle.forEach((vertex, i) => { a.addScaledVector(new Vector3().fromBufferAttribute(base, vertex).applyMatrix4(matrix), frontWeights[i]); next.addScaledVector(new Vector3().fromBufferAttribute(target, vertex).applyMatrix4(matrix), frontWeights[i]) })
      rear.forEach((vertex, i) => { b.addScaledVector(new Vector3().fromBufferAttribute(base, vertex).applyMatrix4(matrix), weights[i]); rearPose.addScaledVector(new Vector3().fromBufferAttribute(target, vertex).applyMatrix4(matrix), weights[i]) })
      if (b.distanceTo(rearPose) > 1e-7 || next.distanceTo(b) * moduleScale > maximumDepth + 1e-6) throw Error('Sleep side anchor exceeds authorized range')
      for (let column = 0; column < columns; column++) {
        const t = column / (columns - 1), h = row / (panel.anchors.length - 1), closed = a.clone().lerp(b, t), open = next.clone().lerp(b, t)
        if (version === 'v5' && panel.name === 'right') {
          const wave = Math.sin(Math.PI * t) * Math.sin(Math.PI * h) / moduleScale, ripple = finish.rippleM * Math.cos(h * Math.PI * 10)
          closed.x += wave * (finish.closedBowM + ripple); open.x += wave * (finish.openBowM + ripple)
        }
        closed.toArray(positions, positions.length); open.toArray(opened, opened.length)
        const phase = version === 'v5' ? h * finish.verticalTextureRepeats : h, fraction = phase - Math.floor(phase), v = version !== 'v5' ? h : Math.floor(phase) % 2 ? 1 - fraction : fraction
        uv.push(u0 + (u1 - u0) * t, v0 + (v1 - v0) * v)
        if (row && column) { const d = row * columns + column, c = d - 1, a = c - columns, b = d - columns; indices.push(a, c, b, b, c, d) }
      }
    })
    const geometry = new BufferGeometry(); geometry.name = `sleep-side-${panel.name}`
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3)); geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2)); geometry.setIndex(indices); geometry.computeVertexNormals()
    const posed = geometry.clone(); posed.setAttribute('position', new BufferAttribute(new Float32Array(opened), 3)); posed.computeVertexNormals()
    geometry.morphTargetsRelative = false; geometry.morphAttributes.position = [posed.getAttribute('position')]; geometry.morphAttributes.normal = [posed.getAttribute('normal')]
    geometry.userData = { microSleepFabric: true, microSleepSidePanel: true, profile: version === 'v5' ? finish.version : selected.version, side: panel.name }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere(); posed.dispose()
    return geometry
  })
}

export class SleepSidePanels {
  private geometries?: BufferGeometry[]
  private material?: Material
  private meshes: Mesh[] = []
  constructor(private version: SleepSideVersion = 'v3') {}
  attach(root: Group, source: Mesh) {
    const matrix = root.matrixWorld.clone().invert().multiply(source.matrixWorld)
    this.geometries ??= createSleepSideGeometries(source.geometry, matrix, root.scale.x, this.version)
    if (!this.material) {
      this.material = (Array.isArray(source.material) ? source.material[0] : source.material).clone(); this.material.name = `SleepSideCloth_${this.version}`; this.material.side = DoubleSide
      if (this.version === 'v5' && this.material instanceof MeshStandardMaterial) {
        this.material.metalness = finish.cloth.metalness; this.material.roughness = finish.cloth.roughness; this.material.normalScale.setScalar(finish.cloth.normalScale)
        if (this.material instanceof MeshPhysicalMaterial) { this.material.specularIntensity = finish.cloth.specularIntensity; this.material.specularColor.setRGB(finish.cloth.specularColor, finish.cloth.specularColor, finish.cloth.specularColor) }
      }
    }
    return this.geometries.map(geometry => {
      const mesh = new Mesh(geometry, this.material); mesh.name = `${root.name}:${geometry.name}`
      mesh.userData = { microSleepSidePanel: true, nonSolid: true, currentShipPart: 'equipment', masterInterior: true }
      mesh.updateMorphTargets(); root.add(mesh); this.meshes.push(mesh); return mesh
    })
  }
  dispose() {
    for (const mesh of this.meshes) mesh.removeFromParent()
    this.meshes = []; this.geometries?.forEach(geometry => geometry.dispose()); this.geometries = undefined
    // Texture maps remain owned by the unchanged source material/model.
    this.material?.dispose(); this.material = undefined
  }
}
