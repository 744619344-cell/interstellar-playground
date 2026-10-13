import { Box3, Color, DoubleSide, Group, Matrix4, Mesh, MeshStandardMaterial, Path,
  Shape, ShapeGeometry, Vector2, Vector3 } from 'three'
import { addShipPressureLiners } from './shipPressureLiner'

/** Union projected triangles at a height, retaining the connected main leaf rather than loose hinges. */
function rowSpan(triangles: Vector2[][], y: number, center: number) {
  const spans: number[][] = []
  for (const triangle of triangles) {
    const crosses: number[] = []
    for (let i = 0; i < 3; i++) {
      const a = triangle[i], b = triangle[(i + 1) % 3]
      if (a.y === b.y || y < Math.min(a.y, b.y) || y > Math.max(a.y, b.y)) continue
      crosses.push(a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y))
    }
    if (crosses.length > 1) spans.push([Math.min(...crosses), Math.max(...crosses)])
  }
  spans.sort((a, b) => a[0] - b[0])
  const merged: number[][] = []
  for (const span of spans) {
    const last = merged[merged.length - 1]
    if (last && span[0] <= last[1] + 1e-5) last[1] = Math.max(last[1], span[1])
    else merged.push([...span])
  }
  const main = merged.find(([left, right]) => left <= center && right >= center)
  if (!main || main[1] - main[0] < .05) throw new Error('Disconnected door silhouette')
  return main
}

/** A convex hull would span the missing corners next to fused hinges; retain the real leaf profile. */
function silhouette(meshes: Mesh[], inverse: Matrix4) {
  const point = new Vector3(), points: Vector2[] = [], triangles: Vector2[][] = []
  for (const mesh of meshes) {
    const transform = new Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)
    const positions = mesh.geometry.getAttribute('position'), local: Vector2[] = []
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(transform)
      local.push(new Vector2(point.x, point.y))
    }
    points.push(...local)
    const index = mesh.geometry.index
    for (let i = 0; i < (index?.count ?? local.length); i += 3)
      triangles.push([0, 1, 2].map(j => local[index ? index.getX(i + j) : i + j]))
  }
  const min = points.reduce((a, p) => a.min(p), new Vector2(Infinity, Infinity))
  const max = points.reduce((a, p) => a.max(p), new Vector2(-Infinity, -Infinity))
  const left: Vector2[] = [], right: Vector2[] = [], center = (min.x + max.x) / 2
  for (let i = 0; i <= 64; i++) {
    const y = min.y + .012 + (max.y - min.y - .024) * i / 64
    const [a, b] = rowSpan(triangles, y, center)
    left.push(new Vector2(a + .012, y)); right.push(new Vector2(b - .012, y))
  }
  return [...left, ...right.reverse()]
}

/** New derived resources become children of the existing model owner, including on failed install. */
export function addShipPressureBoundaries(model: Group) {
  if (!model.getObjectByName('Ship_Adapted') || model.getObjectByName('Pressure_Bulkhead_Inner')) return
  model.updateMatrixWorld(true)
  const inverse = model.matrixWorld.clone().invert(), meshes: Mesh[] = []
  model.traverse(o => { if (o instanceof Mesh) meshes.push(o) })
  const boundary = new Box3()
  for (const mesh of meshes.filter(m => m.userData.label === '气闸门框侧接板'))
    boundary.union(new Box3().setFromObject(mesh).applyMatrix4(inverse))
  if (boundary.isEmpty()) throw new Error('Missing structural bulkhead extent')
  const definitions = [
    ['Inner', 'airlock-inner-door', '气闸内门框'], ['Outer', 'airlock-outer-door', '气闸外门框']
  ].map(([suffix, module, label]) => {
    const leaves = meshes.filter(m => m.userData.module === module)
    const frame = meshes.find(m => m.userData.label === label)
    if (!leaves.length || !frame) throw new Error('Missing bulkhead frame or leaf')
    return { suffix, label, frame, outline: silhouette(leaves, inverse) }
  })
  boundary.union(addShipPressureLiners(model, meshes, inverse))
  for (const { suffix, label, frame, outline } of definitions) {
    const frameBox = new Box3().setFromObject(frame).applyMatrix4(inverse)
    const shape = new Shape([
      new Vector2(boundary.min.x - .005, boundary.min.y - .005),
      new Vector2(boundary.max.x + .005, boundary.min.y - .005),
      new Vector2(boundary.max.x + .005, boundary.max.y + .005),
      new Vector2(boundary.min.x - .005, boundary.max.y + .005)
    ])
    shape.holes.push(new Path(outline))
    const geometry = new ShapeGeometry(shape)
    geometry.translate(0, 0, (frameBox.min.z + frameBox.max.z) / 2)
    const panel = new Mesh(geometry, new MeshStandardMaterial({ color: new Color(.065, .075, .082),
      metalness: .18, roughness: .7, side: DoubleSide }))
    panel.name = `Pressure_Bulkhead_${suffix}`
    panel.userData = { module: 'pressure-bulkhead', label: `${label}封闭衬板`, zone: '气闸', enclosure: true }
    model.add(panel)
  }
}
