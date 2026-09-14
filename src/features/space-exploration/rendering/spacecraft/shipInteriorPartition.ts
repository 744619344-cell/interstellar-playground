import { BufferGeometry, Float32BufferAttribute, Matrix4 } from 'three'

export type InteriorZone = 'cockpit' | 'cabin' | 'airlock' | 'shared'
export function interiorZone(z: number): InteriorZone {
  // Keep bulkhead frames and thresholds visible from both adjoining rooms.
  if (Math.abs(z + 2.65) <= .4 || Math.abs(z - 4.45) <= .4) return 'shared'
  return z < -2.65 ? 'cockpit' : z > 4.45 ? 'airlock' : 'cabin'
}

/** Conservative partition: crossing faces stay intact in a shared group. */
export function partitionInterior(source: BufferGeometry, local: Matrix4) {
  const buckets = new Map<InteriorZone, number[]>()
  const position = source.getAttribute('position')
  const count = source.index?.count ?? position.count
  const m = local.elements
  for (let i = 0; i < count; i += 3) {
    const indices = [0, 1, 2].map(k => source.index?.getX(i + k) ?? i + k)
    const zones = indices.map(v => interiorZone(m[2] * position.getX(v) + m[6] * position.getY(v)
      + m[10] * position.getZ(v) + m[14]))
    const zone = zones.every(z => z === zones[0]) ? zones[0] : 'shared'
    const list = buckets.get(zone) ?? []
    list.push(...indices); buckets.set(zone, list)
  }
  return [...buckets].map(([zone, indices]) => ({ zone, geometry: compactGeometry(source, indices) }))
}

function compactGeometry(source: BufferGeometry, indices: number[]) {
  const unique = [...new Set(indices)]
  const mapping = new Map(unique.map((old, index) => [old, index]))
  const geometry = new BufferGeometry()
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const values = unique.flatMap(index => Array.from({ length: attribute.itemSize },
      (_, component) => attribute.getComponent(index, component)))
    geometry.setAttribute(name, new Float32BufferAttribute(values, attribute.itemSize))
  }
  geometry.setIndex(indices.map(index => mapping.get(index)!))
  geometry.computeBoundingBox(); geometry.computeBoundingSphere()
  return geometry
}
