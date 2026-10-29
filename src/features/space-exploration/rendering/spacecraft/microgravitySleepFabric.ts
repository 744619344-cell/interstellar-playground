import { BufferAttribute, BufferGeometry, Group, Matrix4, Mesh, Vector3 } from 'three'
import weights from '../../../../assets/models/microgravity-cabin-20261025/sleep-fabric-weights.json'
import tails from '../../../../assets/models/microgravity-cabin-20261025/sleep-tail-v5.json'
import { sleepFabricDisplacement } from './sleepFabricFit'
import { SleepSidePanels, type SleepSideVersion } from './sleepSidePanels'

const selectedFit = () => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('sleepFit')
const tailOffsets: Record<string, number> = tails.offsetsM

/** Authorized deformation of the existing soft bag. Original positions, indices, UVs and frame remain intact. */
export class MicrogravitySleepFabric {
  private bags = new Map<string, Mesh[]>()
  private sides?: SleepSidePanels
  constructor(model: Group, legacy = !['v2', 'v3', 'v4', 'v5'].includes(selectedFit() ?? ''), connectSides = !legacy && ['v3', 'v4', 'v5'].includes(selectedFit() ?? ''), sideFold = connectSides, sideVersion: SleepSideVersion = selectedFit() === 'v5' ? 'v5' : selectedFit() === 'v4' ? 'v4' : 'v3') {
    if (connectSides) this.sides = new SleepSidePanels(sideVersion)
    const cache = new Map<BufferGeometry, BufferGeometry>()
    model.updateWorldMatrix(true, true)
    for (let i = 1; i <= 3; i++) {
      const id = `micro-sleep-${i}`, root = model.getObjectByName(id), meshes: Mesh[] = []
      root?.traverse(object => {
        if (!(object instanceof Mesh) || !root) return
        if (!object.geometry.userData.microSleepFabric) {
          let geometry = cache.get(object.geometry)
          if (!geometry) {
            const matrix = root.matrixWorld.clone().invert().multiply(object.matrixWorld)
            geometry = this.deform(object.geometry, matrix, root.scale.x, legacy, sideFold, sideVersion); cache.set(object.geometry, geometry)
          }
          object.geometry = geometry; object.updateMorphTargets()
        }
        meshes.push(object)
      })
      if (root instanceof Group && meshes[0] && this.sides) meshes.push(...this.sides.attach(root, meshes[0]))
      this.bags.set(id, meshes)
    }
  }
  private deform(source: BufferGeometry, matrix: Matrix4, moduleScale: number, legacy: boolean, sideFold: boolean, version: SleepSideVersion) {
    const positions = source.getAttribute('position')
    if (positions.count !== weights.vertices) throw Error('Sleep fabric source vertex mismatch')
    const geometry = source.clone(), target = new Float32Array(positions.count * 3), inverse = matrix.clone().invert(), moving = new Float32Array(positions.count)
    for (let i = 0; i < positions.count; i++) {
      const point = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix)
      const tail = version === 'v5' ? tailOffsets[i] : undefined
      const delta = legacy ? Math.max(0, weights.frontTargetZ - point.z) * weights.weights[i] / 255 : tail !== undefined ? tail / moduleScale : sleepFabricDisplacement(point, moduleScale, i, sideFold, version !== 'v3')
      moving[i] = legacy ? Math.min(1, weights.weights[i] / 128) : delta > 0 ? 1 : 0
      if (delta > 0) { point.z += delta; point.applyMatrix4(inverse).toArray(target, i * 3) }
      else new Vector3().fromBufferAttribute(positions, i).toArray(target, i * 3)
    }
    const posed = source.clone(); posed.setAttribute('position', new BufferAttribute(target, 3)); posed.computeVertexNormals()
    const originalNormals = source.getAttribute('normal'), deformedNormals = posed.getAttribute('normal'), normals = new Float32Array(positions.count * 3)
    for (let i = 0; i < positions.count; i++) {
      const original = new Vector3().fromBufferAttribute(originalNormals, i), changed = new Vector3().fromBufferAttribute(deformedNormals, i)
      if (moving[i]) original.lerp(changed, moving[i]).normalize()
      original.toArray(normals, i * 3)
    }
    geometry.morphTargetsRelative = false
    geometry.morphAttributes.position = [new BufferAttribute(target, 3)]
    geometry.morphAttributes.normal = [new BufferAttribute(normals, 3)]
    geometry.userData = { ...source.userData, microSleepFabric: true, microSleepProfile: legacy ? 'legacy' : version === 'v5' ? 'sleep-fit-v5-20261028' : version === 'v4' ? 'sleep-fit-v4-20261028' : sideFold ? 'sleep-fit-v3-20261027' : 'sleep-fit-v2-20261027' }
    geometry.computeBoundingBox(); geometry.computeBoundingSphere(); posed.dispose()
    return geometry
  }
  apply(id?: string, amount = 0) {
    const eased = Math.max(0, Math.min(1, amount / .35)), blend = eased * eased * (3 - 2 * eased)
    for (const [name, meshes] of this.bags) for (const mesh of meshes) if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[0] = name === id ? blend : 0
  }
  dispose() { this.apply(); this.bags.clear(); this.sides?.dispose(); this.sides = undefined }
}
