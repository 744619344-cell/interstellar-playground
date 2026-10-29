import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Raycaster, Texture, Vector3, type Material } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import originalProfile from '../../../../assets/models/microgravity-cabin-20261025/sleep-side-v3.json'
import expandedProfile from '../../../../assets/models/microgravity-cabin-20261025/sleep-side-v4.json'
import layout from '../../../../assets/models/microgravity-cabin-20261025/layout-candidate.json'
import { MicrogravitySleepFabric } from './microgravitySleepFabric'
import { disposeShipModel } from './shipModelRuntime'
import type { SleepSideAnchor } from './sleepSidePanels'
import { createSleepSideGeometries } from './sleepSidePanels'
import tails from '../../../../assets/models/microgravity-cabin-20261025/sleep-tail-v5.json'

function checkTailClearance(root: Group, original: Mesh, panel: Mesh) {
  const normal = new Vector3(0, 0, 1).transformDirection(root.matrixWorld), ray = new Raycaster()
  for (const key of Object.keys(tails.offsetsM)) {
    const point = original.getVertexPosition(Number(key), new Vector3()).applyMatrix4(original.matrixWorld)
    ray.set(point.clone().addScaledVector(normal, .5), normal.clone().negate())
    const hit = ray.intersectObject(panel, false)[0]
    assert(hit, 'existing tail lost its actual cloth support')
    const clearance = point.clone().sub(hit.point).dot(normal)
    assert(clearance >= .0015, `tail clips or z-fights with side cloth: ${clearance}`)
  }
  const ids = new Set(Object.keys(tails.offsetsM).map(Number)), index = original.geometry.index!
  for (let i = 0; i < index.count; i += 3) {
    const vertices = [index.getX(i), index.getX(i + 1), index.getX(i + 2)]
    if (!vertices.some(id => ids.has(id))) continue
    const [a, b, c] = vertices.map(id => original.getVertexPosition(id, new Vector3()))
    assert(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-16, 'tail fitting collapsed a source face')
  }
}

for (const version of ['v3', 'v4', 'v5'] as const) test(`${version}: six source-anchored strips stay within their authorized depths, follow all poses and release only owned resources`, async () => {
  const profile = version === 'v3' ? originalProfile : expandedProfile
  assert.deepEqual(expandedProfile.panels[0], originalProfile.panels[0], 'left side must stay unchanged')
  const loader = new GLTFLoader(); loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'source_geometry' } })
  const bytes = await readFile(new URL('../../../../assets/models/microgravity-cabin-20261025/sleep-v1.glb', import.meta.url))
  const source = (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene
  const model = new Group(), roots: Group[] = []
  for (const placement of layout.placements.filter(p => p.id === 'sleep-v1')) {
    const root = new Group(); root.name = placement.name; root.position.fromArray(placement.offset); root.rotation.y = placement.yaw; root.scale.setScalar(placement.scale)
    root.add(source.clone(true)); model.add(root); roots.push(root)
  }
  let fabric = new MicrogravitySleepFabric(model, false, true, true, version)
  try {
    const panels: Mesh[] = []; model.traverse(object => { if (object instanceof Mesh && object.userData.microSleepSidePanel) panels.push(object) })
    assert.equal(panels.length, 6); assert.equal(new Set(panels.map(p => p.geometry)).size, 2); assert.equal(new Set(panels.map(p => p.material)).size, 1)
    for (const amount of [0, .05, .12, .2, .35, .7, 1]) {
      fabric.apply('micro-sleep-2', amount); model.updateMatrixWorld(true)
      for (const root of roots) {
        let original: Mesh | undefined; root.traverse(object => { if (object instanceof Mesh && !object.userData.microSleepSidePanel) original = object })
        assert(original)
        if (version === 'v5' && amount === 0) {
          const matrix = root.matrixWorld.clone().invert().multiply(original.matrixWorld), previous = createSleepSideGeometries(original.geometry, matrix, root.scale.x, 'v4')
          const left = panels.find(p => p.parent === root && p.geometry.userData.side === 'left')!.geometry
          assert.deepEqual(left.getAttribute('position').array, previous[0].getAttribute('position').array)
          assert.deepEqual(left.morphAttributes.position![0].array, previous[0].morphAttributes.position![0].array)
          previous.forEach(g => g.dispose())
        }
        for (const panel of panels.filter(p => p.parent === root)) {
          assert.equal(panel.userData.nonSolid, true); assert.equal(panel.morphTargetInfluences![0], original.morphTargetInfluences![0])
          const definition = profile.panels.find(p => p.name === panel.geometry.userData.side)!
          definition.anchors.forEach((anchor: SleepSideAnchor, row) => {
            const { front, frontTriangle = [front], frontWeights = [1], rear, weights } = anchor
            assert(frontWeights.every(w => w >= -1e-8)); assert(Math.abs(frontWeights.reduce((sum, w) => sum + w, 0) - 1) < 1e-8)
            assert(weights.every(w => w >= -1e-8)); assert(Math.abs(weights.reduce((sum, w) => sum + w, 0) - 1) < 1e-8)
            if (version !== 'v3' && definition.name === 'right') {
              const sourceIndex = original!.geometry.index!
              for (const ids of [frontTriangle, rear]) {
                let triangleFound = false
                for (let i = 0; i < sourceIndex.count; i += 3) if (ids.every((vertex, k) => vertex === sourceIndex.getX(i + k))) { triangleFound = true; break }
                assert(triangleFound, 'anchor must be on an actual source triangle')
              }
            }
            const a = panel.getVertexPosition(row * profile.columns, new Vector3()).applyMatrix4(panel.matrixWorld)
            const b = panel.getVertexPosition(row * profile.columns + profile.columns - 1, new Vector3()).applyMatrix4(panel.matrixWorld)
            const frontPoint = frontTriangle.reduce((sum, vertex, i) => sum.addScaledVector(original!.getVertexPosition(vertex, new Vector3()).applyMatrix4(original!.matrixWorld), frontWeights[i]), new Vector3())
            assert(a.distanceTo(frontPoint) < 1e-6)
            const rearPoint = rear.reduce((sum, vertex, i) => sum.addScaledVector(original!.getVertexPosition(vertex, new Vector3()).applyMatrix4(original!.matrixWorld), weights[i]), new Vector3())
            assert(b.distanceTo(rearPoint) < 1e-6)
            const limit = version !== 'v3' && definition.name === 'right' ? .32 : .22
            assert(a.distanceTo(b) <= limit + .000001)
            let curveLength = 0, previous = a
            for (let column = 1; column < profile.columns; column++) {
              const point = panel.getVertexPosition(row * profile.columns + column, new Vector3()).applyMatrix4(panel.matrixWorld)
              curveLength += point.distanceTo(previous); previous = point
            }
            assert(curveLength <= limit + .000001, 'curved cloth exceeds authorized depth')
          })
          const index = panel.geometry.index!
          for (let i = 0; i < index.count; i += 3) {
            const a = panel.getVertexPosition(index.getX(i), new Vector3()), b = panel.getVertexPosition(index.getX(i + 1), new Vector3()), c = panel.getVertexPosition(index.getX(i + 2), new Vector3())
            assert(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-16, 'collapsed cloth face')
          }
          if (version === 'v5') {
            const material = panel.material; assert(material instanceof MeshStandardMaterial)
            const sourceMaterial: Material = Array.isArray(original.material) ? original.material[0] : original.material; assert(sourceMaterial instanceof MeshStandardMaterial)
            for (const key of ['map', 'normalMap', 'metalnessMap', 'roughnessMap'] as const) assert.equal(material[key], sourceMaterial[key])
            assert.equal(material.metalness, 0); assert.equal(material.roughness, .9)
            assert(material instanceof MeshPhysicalMaterial); assert.equal(material.specularIntensity, .35)
            if (panel.geometry.userData.side === 'right') checkTailClearance(root, original, panel)
          }
        }
      }
    }
    let geometriesFreed = 0, materialsFreed = 0, texturesFreed = 0
    for (const geometry of new Set(panels.map(p => p.geometry))) geometry.addEventListener('dispose', () => geometriesFreed++)
    const material = panels[0].material; assert(!Array.isArray(material)); material.addEventListener('dispose', () => materialsFreed++)
    for (const value of Object.values(material)) if (value instanceof Texture) value.addEventListener('dispose', () => texturesFreed++)
    fabric.dispose(); assert.equal(geometriesFreed, 2); assert.equal(materialsFreed, 1); assert.equal(texturesFreed, 0); assert(panels.every(p => !p.parent))
    fabric = new MicrogravitySleepFabric(model, false, true, true, version)
    const restored: Mesh[] = []; model.traverse(object => { if (object instanceof Mesh && object.userData.microSleepSidePanel) restored.push(object) }); assert.equal(restored.length, 6)
  } finally { fabric.dispose(); disposeShipModel(model); disposeShipModel(source) }
})
