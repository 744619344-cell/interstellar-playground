import { Box3, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three'

function moduleBounds(meshes: Mesh[], module: string, inverse: Matrix4) {
  const box = new Box3()
  for (const mesh of meshes.filter(m => m.userData.module === module))
    box.union(new Box3().setFromObject(mesh).applyMatrix4(inverse))
  if (box.isEmpty()) throw new Error(`Missing pressure liner source: ${module}`)
  return box
}

function pressureQuad(model: Group, name: string, zone: string, vertices: number[][]) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(vertices.flat(), 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3]); geometry.computeVertexNormals()
  const mesh = new Mesh(geometry, new MeshStandardMaterial({ color: new Color(.075, .082, .09),
    metalness: .2, roughness: .7, side: DoubleSide }))
  mesh.name = name
  mesh.userData = { module: 'pressure-liner', label: `${zone}结构背衬`, zone, enclosure: true, cutaway: true }
  model.add(mesh)
}

/** Follow the real sloping ceiling's end sections rather than stretching a flat cabin plate over it. */
function cockpitBacking(model: Group, meshes: Mesh[], inverse: Matrix4, left: number, right: number, rear: Box3) {
  const floor = moduleBounds(meshes, 'cockpit-floor', inverse)
  const heights = [floor.min.z, floor.max.z].map(z => {
    let low = Infinity, high = -Infinity
    for (const mesh of meshes.filter(m => m.userData.module === 'cockpit-ceiling')) {
      const p = mesh.geometry.getAttribute('position'), transform = inverse.clone().multiply(mesh.matrixWorld)
      for (let i = 0; i < p.count; i++) {
        const v = new Vector3().fromBufferAttribute(p, i).applyMatrix4(transform)
        if (Math.abs(v.z - z) < .025) { low = Math.min(low, v.y); high = Math.max(high, v.y) }
      }
    }
    if (!Number.isFinite(low)) throw new Error('Missing cockpit roof end section')
    return (low + high) / 2 + .005
  })
  const z0 = floor.min.z - .005, z1 = floor.max.z + .005, bottom = (floor.min.y + floor.max.y) / 2
  const [h0, h1] = heights
  const faces = [
    [[left,bottom,z0],[right,bottom,z0],[right,bottom,z1],[left,bottom,z1]],
    [[left,h0,z0],[left,h1,z1],[right,h1,z1],[right,h0,z0]],
    [[left,bottom,z0],[left,bottom,z1],[left,h1,z1],[left,h0,z0]],
    [[right,bottom,z0],[right,h0,z0],[right,h1,z1],[right,bottom,z1]],
    [[left,h1,z1],[right,h1,z1],[right,rear.max.y,z1],[left,rear.max.y,z1]]
  ]
  faces.forEach((v,i) => pressureQuad(model, `Pressure_Liner_cockpit_${i}`, '驾驶区', v))
  // Small concealed collar joins the existing window reveal to the slab backing, all around its rear rim.
  const reveal = new Box3()
  for (const mesh of meshes.filter(m => m.userData.module === 'window-liner')) {
    const p = mesh.geometry.getAttribute('position'), transform = inverse.clone().multiply(mesh.matrixWorld)
    for (let i=0;i<p.count;i++) {
      const v = new Vector3().fromBufferAttribute(p,i).applyMatrix4(transform)
      if (Math.abs(v.z-floor.min.z)<.01) reveal.expandByPoint(v)
    }
  }
  if (reveal.isEmpty()) throw new Error('Missing window reveal rear rim')
  const inside = [[reveal.min.x,reveal.min.y,floor.min.z],[reveal.max.x,reveal.min.y,floor.min.z],
    [reveal.max.x,reveal.max.y,floor.min.z],[reveal.min.x,reveal.max.y,floor.min.z]]
  const outside = [[left,bottom,z0],[right,bottom,z0],[right,h0,z0],[left,h0,z0]]
  for (let i=0;i<4;i++) pressureQuad(model,`Pressure_Window_Collar_${i}`,'驾驶区',
    [inside[i],inside[(i+1)%4],outside[(i+1)%4],outside[i]])
}

/** Backing lies inside existing slab thickness; it does not replace their detailed visible surfaces. */
export function addShipPressureLiners(model: Group, meshes: Mesh[], inverse: Matrix4) {
  const walls = meshes.filter(m => m.userData.module === 'rear-cabin-wall')
    .map(m => new Box3().setFromObject(m).applyMatrix4(inverse))
    .filter(b => b.max.z - b.min.z > 7)
  if (walls.length !== 2) throw new Error('Missing continuous rear wall sources')
  const left = Math.min(...walls.map(b => (b.min.x + b.max.x) / 2))
  const right = Math.max(...walls.map(b => (b.min.x + b.max.x) / 2))
  // Preflight both zones before allocating derived resources.
  const zones = [['rear-cabin', '后舱'], ['airlock', '气闸']].map(([module, zone]) => {
    const floor = moduleBounds(meshes, `${module}-floor`, inverse)
    const roof = moduleBounds(meshes, `${module}-ceiling`, inverse)
    return { module, zone, box: new Box3(new Vector3(left, (floor.min.y + floor.max.y) / 2, floor.min.z - .005),
      new Vector3(right, (roof.min.y + roof.max.y) / 2, floor.max.z + .005)) }
  })
  const extent = new Box3()
  for (const { module, zone, box } of zones) {
    extent.union(box)
    const { min: a, max: b } = box
    const faces = [
      [[a.x, a.y, a.z], [b.x, a.y, a.z], [b.x, a.y, b.z], [a.x, a.y, b.z]],
      [[a.x, b.y, a.z], [a.x, b.y, b.z], [b.x, b.y, b.z], [b.x, b.y, a.z]],
      [[a.x, a.y, a.z], [a.x, a.y, b.z], [a.x, b.y, b.z], [a.x, b.y, a.z]],
      [[b.x, a.y, a.z], [b.x, b.y, a.z], [b.x, b.y, b.z], [b.x, a.y, b.z]]
    ]
    for (const [i, vertices] of faces.entries()) {
      pressureQuad(model, `Pressure_Liner_${module}_${i}`, zone, vertices)
    }
  }
  cockpitBacking(model, meshes, inverse, left, right, extent)
  return extent
}
