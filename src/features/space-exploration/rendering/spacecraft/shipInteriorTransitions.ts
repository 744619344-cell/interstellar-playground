import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three'

type Point = [number, number, number]
type Surface = (along: number, across: number) => Point

/** A shared grid keeps the surface and shading continuous across every loft station. */
function loft(root: Group, name: string, zone: string, material: MeshStandardMaterial,
  surface: Surface, length = 24, width = 8, connects: string[] = []) {
  const positions: number[] = [], normals: number[] = [], uv: number[] = [], indices: number[] = []
  for (let i = 0; i <= length; i++) for (let j = 0; j <= width; j++) {
    const u = i / length, v = j / width, epsilon = .00001
    const tangent = new Vector3(...surface(u+epsilon,v)).sub(new Vector3(...surface(u-epsilon,v)))
    const across = new Vector3(...surface(u,v+epsilon)).sub(new Vector3(...surface(u,v-epsilon)))
    positions.push(...surface(u,v)); normals.push(...tangent.cross(across).normalize().toArray()); uv.push(u,v)
  }
  for (let i = 0; i < length; i++) for (let j = 0; j < width; j++) {
    const a = i * (width + 1) + j, b = a + width + 1
    indices.push(a, b, a + 1, a + 1, b, b + 1)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2)); geometry.setIndex(indices)
  const flat = geometry.toNonIndexed(); geometry.dispose()
  const mesh = new Mesh(flat, material); mesh.name = name
  mesh.userData = { module: 'interior-joinery', label: name, zone, enclosure: true, cutaway: true, connects }
  root.add(mesh)
}

/** Hermite blend changes slope gradually from the tapered cockpit to the level rear ceiling. */
export function continuousRoofHeight(z: number) {
  const start = -2.6, end = -2.35, slope = .85 / 3.3
  const h0 = .27 + (start + 5.9) * slope, h1 = 1.198
  if (z < start) return .27 + (z + 5.9) * slope
  if (z > end) return h1
  const t = (z - start) / (end - start)
  return (2*t**3-3*t*t+1)*h0 + (t**3-2*t*t+t)*(end-start)*slope + (-2*t**3+3*t*t)*h1
}

function coves(root: Group, coat: MeshStandardMaterial) {
  const zones = [['驾驶区', -5.9, -2.6], ['后舱', -2.6, 4.96], ['气闸', 4.96, 7.16]] as const
  for (const [zone, front, back] of zones) for (const side of [-1, 1]) for (const top of [false, true]) {
    const radius = top ? .045 : .025, sign = top ? 1 : -1
    loft(root, `${zone}${top ? '墙顶' : '墙地'}连续弧面${side}`, zone, coat, (u, v) => {
      const z = top && zone === '后舱'
        ? u <= .25 ? front+u/.25*.25 : -2.35+(u-.25)/.75*(back+2.35)
        : front + u * (back - front)
      const height = top ? continuousRoofHeight(z) : -1.598
      const angle = v * Math.PI / 2
      return [side * (1.782-radius+radius*Math.cos(angle)), height-sign*radius+sign*radius*Math.sin(angle), z]
    }, top && zone !== '气闸' ? 12 : 1, 8, [zone === '驾驶区' ? 'cockpit-sidewall' : zone === '后舱' ? 'rear-cabin-wall' : 'airlock-wall',
      `${zone === '驾驶区' ? 'cockpit' : zone === '后舱' ? 'rear-cabin' : 'airlock'}-${top ? 'ceiling' : 'floor'}`])
  }
  loft(root, '驾驶斜顶至后舱平顶曲率过渡', '后舱', coat,
    (u, v) => [-1.737+v*3.474, continuousRoofHeight(-2.68+u*.33), -2.68+u*.33], 16, 1,
    ['cockpit-ceiling', 'rear-cabin-ceiling'])
}

/** Rounded corners are part of one formed flange rather than overlapping rectangular bars. */
function roundedOutline(width: number, bottom: number, top: number, radius: number, t: number): [number, number] {
  t = ((t % 1)+1)%1
  const corners = [[width-radius, top-radius], [-width+radius, top-radius],
    [-width+radius, bottom+radius], [width-radius, bottom+radius]]
  const quadrant = Math.min(3, Math.floor(t*4)), local = t*4-quadrant
  const [x, y] = corners[quadrant]
  // Each quadrant includes its following straight span, with a common tangent at the corner.
  if (local < .35) return [x+radius*Math.cos(quadrant*Math.PI/2+local/.35*Math.PI/2), y+radius*Math.sin(quadrant*Math.PI/2+local/.35*Math.PI/2)]
  const next = corners[(quadrant+1)%4], a = (quadrant+1)*Math.PI/2, s = (local-.35)/.65
  return [x+radius*Math.cos(a)+(next[0]-x)*s, y+radius*Math.sin(a)+(next[1]-y)*s]
}

function formedPortal(root: Group, coat: MeshStandardMaterial, z: number, roof: number, zone: string) {
  loft(root, `一体成形舱段收口${z}`, zone, coat, (u, v) => {
    const inset = .025*Math.sin(v*Math.PI/2), depth = .014*(1-Math.cos(v*Math.PI/2))
    const [x, y] = roundedOutline(1.782-inset, -1.598+inset, roof-inset, .045, u)
    return [x, y, z-depth]
  }, 64, 6, z === -5.9 ? ['cockpit-sidewall','cockpit-floor','cockpit-ceiling','window-liner']
    : ['airlock-wall','airlock-floor','airlock-ceiling','airlock-door-frame','pressure-bulkhead'])
}

function equipmentSockets(model: Group, root: Group, coat: MeshStandardMaterial) {
  const boxes = new Map<string, { box: Box3; module: string; zone: string }>()
  model.updateMatrixWorld(true)
  model.traverse(o => {
    if (!(o instanceof Mesh) || !['rear-workbench','storage-cabinet','dual-suit-locker','folding-berth','airlock-pressure-panel'].includes(o.userData.module)) return
    const row = boxes.get(o.userData.label) ?? { box: new Box3(), module: o.userData.module, zone: o.userData.zone }
    row.box.union(new Box3().setFromObject(o)); boxes.set(o.userData.label, row)
  })
  for (const [name, { box, module, zone }] of boxes) {
    const side = box.getCenter(new Vector3()).x < 0 ? -1 : 1
    const centerZ = (box.min.z+box.max.z)/2, halfZ = (box.max.z-box.min.z)/2+.016
    loft(root, `${name}贴墙圆角安装口`, zone, coat, (u, v) => {
      const inset = .03*v, [z, y] = roundedOutline(halfZ-inset, box.min.y-.016+inset, box.max.y+.016-inset, .05, u)
      return [side*(1.781-.016*Math.sin(v*Math.PI/2)), y, centerZ+z]
    }, 48, 4, [module, zone === '气闸' ? 'airlock-wall' : 'rear-cabin-wall'])
  }
}

/** Curves lie inside existing enclosure boundaries and become part of the single joinery owner. */
export function addShipInteriorTransitions(model: Group, root: Group, coat: MeshStandardMaterial) {
  coves(root, coat)
  for (const [z, height, zone] of [[4.9,1.198,'气闸'],[7.22,1.198,'气闸']] as const)
    formedPortal(root, coat, z, height, zone)
  equipmentSockets(model, root, coat)
}
