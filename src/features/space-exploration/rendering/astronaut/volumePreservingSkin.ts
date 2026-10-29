import { Matrix4, Quaternion, SkinnedMesh, Vector2, Vector3, Vector4, type Material } from 'three'
import { volumeSkinVertexShader } from './volumeSkinShader'

interface Joint { rotation: Quaternion; dual: Quaternion; scale: number }
interface Binding { mesh: SkinnedMesh; joints: Joint[]; material: Material | Material[]; transform: SkinnedMesh['applyBoneTransform']; upperArms: number[] }

/** CPU source contacts and visible GPU skin use the same dual-quaternion blend. */
export class VolumePreservingSkin {
  private bindings: Binding[] = []
  private clones = new Set<Material>()
  constructor(meshes: readonly SkinnedMesh[], private armBlend = 0) {
    for (const mesh of meshes) {
      const upperArms = ['upper_arm_L', 'upper_arm_R'].map(name => mesh.skeleton.bones.findIndex(b => b.name === name))
      const binding: Binding = { mesh, joints: mesh.skeleton.bones.map(() => ({ rotation: new Quaternion(), dual: new Quaternion(0, 0, 0, 0), scale: 1 })), material: mesh.material, transform: mesh.applyBoneTransform, upperArms }
      const customize = (original: Material) => {
        const material = original.clone(), compile = original.onBeforeCompile.bind(original)
        material.onBeforeCompile = (shader, renderer) => { compile(shader, renderer); shader.uniforms.microUpperArms = { value: new Vector2(upperArms[0], upperArms[1]) }; shader.uniforms.microArmBlend = { value: this.armBlend }; shader.vertexShader = volumeSkinVertexShader(shader.vertexShader) }
        material.customProgramCacheKey = () => `${original.customProgramCacheKey()}:micro-dq-arm-v2`
        this.clones.add(material); return material
      }
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(customize) : customize(mesh.material)
      mesh.applyBoneTransform = this.bindTransform(binding)
      this.bindings.push(binding)
    }
    this.update()
  }
  private bindTransform(binding: Binding): SkinnedMesh['applyBoneTransform'] {
    const skin = this
    function apply(index: number, point: Vector3): Vector3
    function apply(index: number, point: Vector4): Vector4
    function apply(index: number, point: Vector3 | Vector4): Vector3 | Vector4
    function apply(index: number, point: Vector3 | Vector4): Vector3 | Vector4 {
      if (point instanceof Vector3) return skin.transform(binding, index, point)
      const position = skin.transform(binding, index, new Vector3(point.x, point.y, point.z))
      if (point.w !== 1) position.addScaledVector(skin.transform(binding, index, new Vector3()), point.w - 1)
      return point.set(position.x, position.y, position.z, point.w)
    }
    return apply
  }
  update() {
    const matrix = new Matrix4(), translation = new Vector3(), scale = new Vector3()
    for (const binding of this.bindings) binding.mesh.skeleton.bones.forEach((bone, i) => {
      const joint = binding.joints[i]
      matrix.multiplyMatrices(bone.matrixWorld, binding.mesh.skeleton.boneInverses[i]).decompose(translation, joint.rotation, scale)
      if (Math.max(Math.abs(scale.x - scale.y), Math.abs(scale.y - scale.z)) > 1e-4) throw Error('Volume skin requires uniform source bone scale')
      joint.scale = scale.x; joint.dual.set(translation.x, translation.y, translation.z, 0).multiply(joint.rotation)
      joint.dual.set(joint.dual.x * .5, joint.dual.y * .5, joint.dual.z * .5, joint.dual.w * .5)
    })
  }
  private transform(binding: Binding, index: number, point: Vector3) {
    const indices = binding.mesh.geometry.getAttribute('skinIndex'), weights = binding.mesh.geometry.getAttribute('skinWeight'), ids = [indices.getX(index), indices.getY(index), indices.getZ(index), indices.getW(index)], ws = [weights.getX(index), weights.getY(index), weights.getZ(index), weights.getW(index)]
    const amount = this.armBlend * ids.reduce((sum, id, k) => sum + (binding.upperArms.includes(id) ? ws[k] : 0), 0)
    const linear = amount ? binding.transform.call(binding.mesh, index, point.clone()) : undefined
    const reference = binding.joints[ids[0]].rotation, q = new Quaternion(0, 0, 0, 0), d = new Quaternion(0, 0, 0, 0)
    for (let k = 0; k < 4; k++) {
      const joint = binding.joints[ids[k]], w = ws[k] * (reference.dot(joint.rotation) < 0 ? -1 : 1)
      q.set(q.x + joint.rotation.x * w, q.y + joint.rotation.y * w, q.z + joint.rotation.z * w, q.w + joint.rotation.w * w)
      d.set(d.x + joint.dual.x * w, d.y + joint.dual.y * w, d.z + joint.dual.z * w, d.w + joint.dual.w * w)
    }
    const length = q.length(); q.normalize(); d.set(d.x / length, d.y / length, d.z / length, d.w / length)
    const dot = q.dot(d); d.set(d.x - q.x * dot, d.y - q.y * dot, d.z - q.z * dot, d.w - q.w * dot)
    const translation = d.multiply(q.clone().conjugate())
    const result = point.applyMatrix4(binding.mesh.bindMatrix).multiplyScalar(binding.joints[ids[0]].scale).applyQuaternion(q)
      .add(new Vector3(translation.x, translation.y, translation.z).multiplyScalar(2)).applyMatrix4(binding.mesh.bindMatrixInverse)
    return linear ? result.lerp(linear, amount) : result
  }
  dispose() { for (const b of this.bindings) { b.mesh.material = b.material; b.mesh.applyBoneTransform = b.transform } this.clones.forEach(m => m.dispose()); this.clones.clear(); this.bindings = [] }
}
