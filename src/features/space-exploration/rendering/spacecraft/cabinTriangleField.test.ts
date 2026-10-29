import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Group, Mesh, Ray, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { CabinTriangleField } from './cabinTriangleField'
import { disposeShipModel } from './shipModelRuntime'

test('triangle field agrees with actual indexed hull surfaces, retains source arrays and releases its cache', async () => {
  const bytes = await readFile(new URL('../../../../assets/models/current-ship-20261022/hull-g12.glb', import.meta.url))
  const loader = new GLTFLoader()
  loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'geometry_only' } })
  const { scene } = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const meshes: Mesh[] = []; scene.traverse(o => { if (o instanceof Mesh) meshes.push(o) })
  const references = meshes.map(m => [m.geometry.getAttribute('position').array, m.geometry.index?.array])
  const field = new CabinTriangleField(scene, meshes), a = new Vector3(), b = new Vector3(), c = new Vector3()
  try {
    assert(field.snapshot().triangles > 1000)
    let checked = 0
    for (const mesh of meshes) {
      const pos = mesh.geometry.getAttribute('position'), index = mesh.geometry.index
      for (let i = 0; i < (index?.count ?? pos.count); i += 333) {
        a.fromBufferAttribute(pos, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld)
        b.fromBufferAttribute(pos, index ? index.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld)
        c.fromBufferAttribute(pos, index ? index.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld)
        const normal = b.clone().sub(a).cross(c.clone().sub(a))
        if (normal.lengthSq() < 1e-12) continue
        normal.normalize(); const center = a.clone().add(b).add(c).divideScalar(3)
        const from = center.clone().addScaledVector(normal, .025), to = center.clone().addScaledVector(normal, -.025)
        const actual = field.cast(from, to); assert(actual)
        assert(actual.distance <= .025001)
        assert(actual.normal.x * normal.x + actual.normal.y * normal.y + actual.normal.z * normal.z > -.001)
        const hit = new Ray(from, to.clone().sub(from).normalize()).intersectTriangle(a, b, c, false, new Vector3())
        assert(hit); assert(hit.distanceTo(center) < 1e-7); checked++
      }
    }
    assert(checked > 100)
    meshes.forEach((m, i) => { assert.equal(m.geometry.getAttribute('position').array, references[i][0]); assert.equal(m.geometry.index?.array, references[i][1]) })
    scene.position.set(500, -23, 90); scene.rotation.y = .7; scene.updateMatrixWorld(true)
    assert(field.cast({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }))
    assert.equal(field.cast({ x: NaN, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }), undefined)
    field.dispose(); assert.deepEqual(field.snapshot(), { triangles: 0, cells: 0, bytes: 0 })
    assert.equal(field.cast({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }), undefined)
    const empty = new CabinTriangleField(new Group(), []); assert.equal(empty.cast(a, b), undefined); empty.dispose()
  } finally { field.dispose(); disposeShipModel(scene) }
})
