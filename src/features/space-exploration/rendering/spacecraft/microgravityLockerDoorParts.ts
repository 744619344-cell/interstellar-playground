import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial } from 'three'

export const LOCKER_DOOR_FIT = Object.freeze({ x: 1.055, y: -.34, zMin: 1.96, zMax: 2.90, height: 2.02, width: .235, thickness: .014, angle: 85 * Math.PI / 180 })
export const LOCKER_LEAVES = ['LockerPortOuter', 'LockerPortInner', 'LockerStarboardOuter', 'LockerStarboardInner'] as const

/** Four leaves only, within the user's 2026-10-28 cabinet authorization. Source assets are never edited. */
function panelGeometry() {
  const h = LOCKER_DOOR_FIT.height / 2, w = (LOCKER_DOOR_FIT.width - .0025) / 2, bevel = .002
  const positions: number[] = [], indices: number[] = []
  for (const [x, inset] of [[-.007, bevel], [-.005, 0], [.005, 0], [.007, bevel]]) {
    const y = h - inset, z = w - inset, c = bevel
    for (const [a, b] of [[-y, -z + c], [-y + c, -z], [y - c, -z], [y, -z + c], [y, z - c], [y - c, z], [-y + c, z], [-y, z - c]]) positions.push(x, a, b)
  }
  for (let ring = 0; ring < 3; ring++) for (let j = 0; j < 8; j++) {
    const a = ring * 8 + j, b = ring * 8 + (j + 1) % 8; indices.push(a, a + 8, b, b, a + 8, b + 8)
  }
  for (let j = 1; j < 7; j++) { indices.push(0, j, j + 1); indices.push(24, 24 + j + 1, 24 + j) }
  for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]]
  const indexed = new BufferGeometry(); indexed.setAttribute('position', new Float32BufferAttribute(positions, 3)); indexed.setIndex(indices)
  const geometry = indexed.toNonIndexed(); indexed.dispose(); geometry.computeVertexNormals(); return geometry
}

export function createLockerDoorCandidate() {
  const fit = LOCKER_DOOR_FIT, root = new Group(); root.name = 'MicrogravityLockerDoorAssembly'
  Object.assign(root.userData, { currentShipPart: 'equipment', masterInterior: true, authorizedLocalProduction: 'Four bifold leaves, necessary hinges and local edging, 2026-10-28', candidate: 'locker-doors-v1' })
  const panel = panelGeometry(), pin = new CylinderGeometry(.0055, .0055, .1, 12)
  const coating = new MeshStandardMaterial({ color: 0xbfc9c8, metalness: .38, roughness: .43 }), metal = new MeshStandardMaterial({ color: 0x73868a, metalness: .72, roughness: .32 })
  for (const [side, sign] of [[0, 1], [1, -1]] as const) {
    const outer = new Group(), inner = new Group(); outer.name = LOCKER_LEAVES[side * 2]; inner.name = LOCKER_LEAVES[side * 2 + 1]
    outer.position.set(fit.x, fit.y, sign > 0 ? fit.zMin : fit.zMax); inner.position.z = sign * fit.width
    outer.userData.microDoorLeaf = inner.userData.microDoorLeaf = true
    for (const leaf of [outer, inner]) {
      const mesh = new Mesh(panel, coating); mesh.name = `${leaf.name}:Panel`; mesh.position.z = sign * fit.width / 2; leaf.add(mesh)
      for (const y of [-.79, .79]) { const hinge = new Mesh(pin, metal); hinge.name = `${leaf.name}:Hinge`; hinge.position.y = y; leaf.add(hinge) }
    }
    outer.add(inner); root.add(outer)
  }
  root.updateMatrixWorld(true); return root
}
