import { BufferGeometry, DataTexture, Float32BufferAttribute, Group, Points, PointsMaterial, RGBAFormat } from 'three'

// Screen-sized stars retain their fine edges through camera zoom and rotation.
export function createSystemStars() {
  const group = new Group()
  let seed = 73193
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const pixels = new Uint8Array(16 * 16 * 4)
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const offset = (y * 16 + x) * 4
      const radius = Math.hypot((x - 7.5) / 7.5, (y - 7.5) / 7.5)
      pixels.set([255, 255, 255, Math.round(255 * Math.max(0, 1 - radius) ** 1.5)], offset)
    }
  }
  const map = new DataTexture(pixels, 16, 16, RGBAFormat)
  map.needsUpdate = true
  for (const [count, size, opacity] of [[48000, 1.2, 0.5], [12000, 1.8, 0.7], [1600, 2.6, 0.85]]) {
    const positions: number[] = []
    const colors: number[] = []
    for (let i = 0; i < count; i += 1) {
      const z = random() * 2 - 1
      const angle = random() * Math.PI * 2
      const radius = Math.sqrt(1 - z * z) * 1500
      positions.push(radius * Math.cos(angle), z * 1500, radius * Math.sin(angle))
      const warm = random() < 0.18
      const brightness = (0.45 + random() * 0.55) * opacity
      colors.push(brightness * (warm ? 1 : 0.82), brightness * 0.9, brightness * (warm ? 0.78 : 1))
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
    const stars = new Points(geometry, new PointsMaterial({
      map, size, opacity, sizeAttenuation: false, vertexColors: true,
      alphaTest: 0.08, depthTest: false, depthWrite: false, toneMapped: false
    }))
    stars.renderOrder = -999
    group.add(stars)
  }
  return group
}
