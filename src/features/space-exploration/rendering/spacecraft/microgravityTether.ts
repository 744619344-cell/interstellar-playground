import { BoxGeometry, BufferAttribute, BufferGeometry, CylinderGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, Quaternion, TorusGeometry, Vector3 } from 'three'
import { CabinTriangleField } from './cabinTriangleField'

const name = 'MicrogravityTetherAssembly', rings = 24, sides = 6, radius = .004
/** Explicitly authorized local tether, structural mount and reel. The hull and existing door are untouched. */
export class MicrogravityTether {
  private root: Group
  private rope: Mesh<BufferGeometry>
  private segments: Mesh<BufferGeometry>[] = []
  private clip: Mesh
  readonly anchor: Vector3
  constructor(private model: Group) {
    const existing = model.getObjectByName(name)
    if (existing instanceof Group) this.root = existing
    else { this.root = this.create(); model.add(this.root) }
    this.rope = this.root.getObjectByName('EvaSafetyCord') as Mesh<BufferGeometry>
    this.root.traverse(o => { if (o instanceof Mesh && o.name.startsWith('EvaSafetyCord')) this.segments.push(o as Mesh<BufferGeometry>) })
    this.clip = this.root.getObjectByName('EvaHarnessClip') as Mesh
    this.anchor = new Vector3().fromArray(this.root.userData.anchor)
    this.update(undefined)
  }
  private create() {
    const bulkhead = this.model.getObjectByName('InteractiveAftBulkhead'), meshes: Mesh[] = []
    bulkhead?.traverse(o => { if (o instanceof Mesh && o.name !== 'AftDoorLeaf') meshes.push(o) })
    if (!meshes.length) throw Error('Missing original structure for tether mounting')
    const field = new CabinTriangleField(this.model, meshes), hit = field.cast(new Vector3(-.96, .28, 6.25), new Vector3(-.96, .28, 7))
    field.dispose()
    if (!hit || hit.point.z < 6.6 || hit.point.z > 6.8) throw Error('No verified structural surface for tether reel')
    const root = new Group(); root.name = name; root.userData.authorizedLocalProduction = 'Tether, structural anchor and reel'; root.userData.currentShipPart = 'equipment'
    const normal = new Vector3().copy(hit.normal), up = new Vector3(0, 1, 0).addScaledVector(normal, -normal.y).normalize(), right = up.clone().cross(normal).normalize()
    const mount = new Group(); mount.position.copy(hit.point); mount.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(right, up, normal)); root.add(mount)
    const metal = new MeshStandardMaterial({ color: 0x8a9698, metalness: .72, roughness: .39 }), dark = new MeshStandardMaterial({ color: 0x20373d, metalness: .25, roughness: .65 }), cord = new MeshStandardMaterial({ color: 0xe2bd70, roughness: .85 })
    const part = (geometry: BufferGeometry, material: MeshStandardMaterial, x: number, y: number, z: number) => { const mesh = new Mesh(geometry, material); mesh.position.set(x, y, z); mount.add(mesh); return mesh }
    part(new BoxGeometry(.15, .22, .018), dark, 0, 0, .01)
    const drum = part(new CylinderGeometry(.062, .062, .075, 24), dark, 0, -.012, .065); drum.rotation.x = Math.PI / 2
    for (const z of [.028, .102]) { const flange = part(new CylinderGeometry(.077, .077, .008, 24), metal, 0, -.012, z); flange.rotation.x = Math.PI / 2 }
    const coil = new TorusGeometry(.064, .004, 6, 40)
    for (let i = 0; i < 7; i++) part(coil, cord, 0, -.012, .036 + i * .009)
    const bolt = new CylinderGeometry(.005, .005, .008, 8)
    for (const x of [-.057, .057]) for (const y of [-.087, .087]) part(bolt, metal, x, y, .023).rotation.x = Math.PI / 2
    const eye = part(new TorusGeometry(.023, .006, 8, 24), metal, 0, .15, .048); eye.name = 'EvaStructuralEye'
    root.updateWorldMatrix(true, true)
    const center = eye.position.clone().applyMatrix4(mount.matrix), outward = new Vector3(1, 0, -.1).normalize(), p = eye.geometry.getAttribute('position')
    let outlet = center.clone(), best = -Infinity
    for (let i = 0; i < p.count; i++) { const point = new Vector3().fromBufferAttribute(p, i).applyMatrix4(eye.matrixWorld), score = point.clone().sub(center).dot(outward); if (score > best) { best = score; outlet = point } }
    outlet.addScaledVector(outward, radius + .002)
    root.userData.anchor = outlet.toArray(); root.userData.mountedSourcePoint = { ...hit.point }
    const geometry = new BufferGeometry(), vertices = (rings + 1) * sides, indices: number[] = []
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices * 3), 3)); geometry.setAttribute('normal', new BufferAttribute(new Float32Array(vertices * 3), 3))
    for (let i = 0; i < rings; i++) for (let j = 0; j < sides; j++) { const a = i * sides + j, b = i * sides + (j + 1) % sides; indices.push(a, b, a + sides, b, b + sides, a + sides) }
    geometry.setIndex(indices)
    const rope = new Mesh(geometry, cord); rope.name = 'EvaSafetyCord'; rope.userData.nonSolid = true; rope.frustumCulled = false; root.add(rope)
    const clip = new Mesh(new TorusGeometry(.014, .004, 8, 20), metal); clip.name = 'EvaHarnessClip'; clip.userData.nonSolid = true; root.add(clip)
    return root
  }
  update(attachment: Vector3 | undefined, path?: readonly Vector3[]) {
    this.segments.forEach(s => s.visible = false); this.clip.visible = !!attachment
    if (!attachment) return
    const points = path ?? [this.anchor, attachment]
    if (points.length > 17) throw Error('Cable route exceeds the bounded renderer capacity')
    for (let i = 1; i < points.length; i++) {
      let segment = this.segments[i - 1]
      if (!segment) { segment = new Mesh(this.rope.geometry.clone(), this.rope.material); segment.name = `EvaSafetyCord:${i}`; segment.userData.nonSolid = true; segment.frustumCulled = false; this.root.add(segment); this.segments.push(segment) }
      segment.visible = true; this.drawSegment(segment, points[i - 1], points[i])
    }
    const tangent = attachment.clone().sub(points[points.length - 2]).normalize()
    this.clip.position.copy(attachment); this.clip.quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), tangent))
  }
  private drawSegment(rope: Mesh<BufferGeometry>, from: Vector3, to: Vector3) {
    const delta = to.clone().sub(from), length = delta.length(), tangent = delta.clone().normalize()
    const normal = new Vector3(0, 1, 0); if (Math.abs(tangent.dot(normal)) > .95) normal.set(1, 0, 0)
    normal.addScaledVector(tangent, -normal.dot(tangent)).normalize()
    const binormal = tangent.clone().cross(normal).normalize(), positions = rope.geometry.getAttribute('position'), normals = rope.geometry.getAttribute('normal')
    for (let i = 0; i <= rings; i++) for (let j = 0; j < sides; j++) {
      const angle = j / sides * Math.PI * 2, radial = normal.clone().multiplyScalar(Math.cos(angle)).addScaledVector(binormal, Math.sin(angle)), point = from.clone().addScaledVector(delta, i / rings).addScaledVector(radial, Math.min(radius, length / 10)), index = i * sides + j
      positions.setXYZ(index, point.x, point.y, point.z); normals.setXYZ(index, radial.x, radial.y, radial.z)
    }
    positions.needsUpdate = normals.needsUpdate = true
  }
  dispose() { this.update(undefined) /* Assembly owner releases shared geometry/materials, also after hide/reload. */ }
}

