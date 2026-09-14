import {
  AdditiveBlending, BackSide, BufferGeometry, Color, DoubleSide, EllipseCurve, Group,
  Line, LineBasicMaterial, Mesh, MeshBasicMaterial, MeshStandardMaterial, RingGeometry,
  SphereGeometry, TextureLoader, Vector3
} from 'three'
import { bodyWorldPosition } from '../../domain/layout'
import { SYSTEM_BODIES, type SystemBodyId } from '../../domain/registry'
import { visualScale } from '../../domain/visualScale'
import type { VoyageTextureSet } from '../voyagePublicTypes'
import { collectMaterialTextures, loadGeneratedTexture, type VoyageResourceGate } from '../voyageResources'

export interface BodyVisual {
  id: SystemBodyId
  group: Group
  mesh: Mesh
  lod2Geometry: SphereGeometry
  lod1Geometry?: SphereGeometry
  extras: Mesh[]
}

const LOD2_SEG = { w: 48, h: 32 }
const LOD1_SEG = { w: 128, h: 96 }
const FALLBACK: Record<SystemBodyId, number> = {
  sun: 0xffc07a, mercury: 0xb9a48c, venus: 0xe0b56a, earth: 0x3f8fd6, moon: 0xcfc8bb,
  mars: 0xc46a48, jupiter: 0xd7b48a, saturn: 0xe6c98a, uranus: 0x7fd3d4, neptune: 0x4b78e6
}

export function createSystemContent(
  textures: VoyageTextureSet,
  loader: TextureLoader,
  gate: VoyageResourceGate
) {
  const root = new Group()
  const bodies = new Map<SystemBodyId, BodyVisual>()
  const orbits = new Map<SystemBodyId, Line>()
  for (const record of SYSTEM_BODIES) {
    const visual = createBody(record.id, textures, loader, gate)
    root.add(visual.group)
    bodies.set(record.id, visual)
    if (record.parentId) {
      const orbit = createOrbit(record.id, record.parentId)
      root.add(orbit)
      orbits.set(record.id, orbit)
    }
  }
  return { root, bodies, orbits }
}

export function setBodyLod(
  visual: BodyVisual,
  level: 'lod2' | 'lod1',
  textures: VoyageTextureSet,
  loader: TextureLoader,
  isCurrent: () => boolean
) {
  const scale = visualScale(visual.id)
  if (level === 'lod2') {
    const retained = visual.extras.filter((extra) => extra.userData.persistentOverview)
    visual.extras.filter((extra) => !extra.userData.persistentOverview).forEach((extra) => {
      extra.parent?.remove(extra)
      extra.geometry.dispose()
      const material: any = extra.material
      collectMaterialTextures(material).forEach((texture) => texture?.dispose?.())
      material.dispose?.()
    })
    visual.extras = retained
    if (visual.lod1Geometry) {
      visual.lod1Geometry.dispose()
      visual.lod1Geometry = undefined
    }
    visual.mesh.geometry = visual.lod2Geometry
    const material = visual.mesh.material as MeshStandardMaterial
    if ('emissiveIntensity' in material) {
      material.emissiveMap?.dispose()
      material.emissiveIntensity = 0
      material.emissiveMap = null
      // Switch away from the emissive-map shader variant. Without this flag,
      // Three.js keeps the old uniform reference and uploads the disposed
      // texture again on the next render.
      material.needsUpdate = true
    }
    return
  }
  if (!visual.lod1Geometry) {
    visual.lod1Geometry = new SphereGeometry(scale.radius, LOD1_SEG.w, LOD1_SEG.h)
  }
  visual.mesh.geometry = visual.lod1Geometry
  if (visual.id === 'earth') addEarthExtras(visual, textures, loader, isCurrent)
  if (visual.id === 'saturn') addSaturnRing(visual, textures, loader, isCurrent)
  if (visual.id === 'sun') addSunGlow(visual)
  else addFocusRim(visual)
}

function createBody(
  id: SystemBodyId,
  textures: VoyageTextureSet,
  loader: TextureLoader,
  gate: VoyageResourceGate
): BodyVisual {
  const scale = visualScale(id)
  const position = bodyWorldPosition(id)
  const group = new Group()
  group.position.set(position.x, position.y, position.z)
  const geometry = new SphereGeometry(scale.radius, LOD2_SEG.w, LOD2_SEG.h)
  const material = id === 'sun'
    ? new MeshBasicMaterial({ color: FALLBACK[id] })
    : new MeshStandardMaterial({ color: FALLBACK[id], roughness: 0.72, metalness: 0.02 })
  const mesh = new Mesh(geometry, material)
  mesh.userData.bodyId = id
  group.add(mesh)
  loadGeneratedTexture(loader, textures.surface[id], () => gate.isWorldCurrent(), (texture) => {
    material.map = texture
    material.color = new Color(0xffffff)
    material.needsUpdate = true
  })
  const visual = { id, group, mesh, lod2Geometry: geometry, extras: [] } as BodyVisual
  if (id === 'saturn') addSaturnRing(visual, textures, loader, () => gate.isWorldCurrent())
  if (id === 'sun') addSunGlow(visual)
  return visual
}

function createOrbit(id: SystemBodyId, parentId: SystemBodyId) {
  const radius = visualScale(id).orbitRadius
  const curve = new EllipseCurve(0, 0, radius, radius, 0, Math.PI * 2, false, 0)
  const points = curve.getPoints(128).map((point) => new Vector3(point.x, 0, point.y))
  const geometry = new BufferGeometry().setFromPoints(points)
  const line = new Line(geometry, new LineBasicMaterial({
    color: 0xa8bfd0,
    transparent: true,
    opacity: 0.25
  }))
  const parent = bodyWorldPosition(parentId)
  line.position.set(parent.x, parent.y, parent.z)
  return line
}

function addEarthExtras(
  visual: BodyVisual,
  textures: VoyageTextureSet,
  loader: TextureLoader,
  isCurrent: () => boolean
) {
  if (visual.extras.length) return
  const radius = visualScale('earth').radius
  const clouds = new MeshStandardMaterial({ transparent: true, opacity: 0.5, depthWrite: false, roughness: 1 })
  const cloudMesh = new Mesh(new SphereGeometry(radius * 1.02, LOD1_SEG.w, LOD1_SEG.h), clouds)
  const atmosphere = new Mesh(
    new SphereGeometry(radius * 1.05, 96, 64),
    new MeshBasicMaterial({ color: 0x4aa9ff, side: BackSide, transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false })
  )
  visual.mesh.add(cloudMesh, atmosphere)
  visual.extras.push(cloudMesh, atmosphere)
  loadGeneratedTexture(loader, textures.earthClouds, isCurrent, (texture) => {
    clouds.map = texture
    clouds.alphaMap = texture
    clouds.needsUpdate = true
  })
  loadGeneratedTexture(loader, textures.earthNight, isCurrent, (texture) => {
    const material = visual.mesh.material as MeshStandardMaterial
    material.emissive = new Color(0x1b3d66)
    material.emissiveMap = texture
    material.emissiveIntensity = 0.85
    material.needsUpdate = true
  })
}

function addSaturnRing(visual: BodyVisual, textures: VoyageTextureSet, loader: TextureLoader, isCurrent: () => boolean) {
  if (visual.extras.length) return
  const scale = visualScale('saturn')
  const geometry = new RingGeometry(scale.ringInner ?? 6, scale.ringOuter ?? 10, 96)
  const positions = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  const inner = geometry.parameters.innerRadius
  const outer = geometry.parameters.outerRadius
  for (let i = 0; i < positions.count; i += 1) {
    const radius = Math.hypot(positions.getX(i), positions.getY(i))
    uv.setXY(i, (radius - inner) / (outer - inner), 0.5)
  }
  const material = new MeshBasicMaterial({
    color: 0xd6b77f, side: DoubleSide, transparent: true, opacity: 0.9, depthWrite: false,
    toneMapped: false
  })
  const ring = new Mesh(geometry, material)
  ring.name = 'saturn-ring'
  ring.userData.persistentOverview = true
  ring.rotation.x = 1.2
  ring.rotation.z = -0.18
  visual.group.add(ring)
  visual.extras.push(ring)
  loadGeneratedTexture(loader, textures.saturnRing, isCurrent, (texture) => {
    material.map = texture
    material.color.set(0xffffff)
    material.needsUpdate = true
  })
}

function addSunGlow(visual: BodyVisual) {
  if (visual.extras.length) return
  const nearGlow = new Mesh(
    new SphereGeometry(visualScale('sun').radius * 1.18, 96, 64),
    new MeshBasicMaterial({
      color: 0xffa04c, transparent: true, opacity: 0.035, blending: AdditiveBlending, depthWrite: false
    })
  )
  nearGlow.name = 'sun-near-glow'
  nearGlow.userData.persistentOverview = true
  const farGlow = new Mesh(
    new SphereGeometry(visualScale('sun').radius * 1.45, 72, 48),
    new MeshBasicMaterial({
      color: 0xff6b2d, transparent: true, opacity: 0.012, blending: AdditiveBlending, depthWrite: false
    })
  )
  farGlow.name = 'sun-far-glow'
  farGlow.userData.persistentOverview = true
  visual.mesh.add(nearGlow, farGlow)
  visual.extras.push(nearGlow, farGlow)
}

function addFocusRim(visual: BodyVisual) {
  if (visual.extras.some((extra) => extra.name === 'focus-rim')) return
  const rim = new Mesh(
    new SphereGeometry(visualScale(visual.id).radius * 1.035, 96, 64),
    new MeshBasicMaterial({
      color: visual.id === 'earth' ? 0x4aa9ff : 0xb8d8ff,
      side: BackSide,
      transparent: true,
      opacity: 0.1,
      blending: AdditiveBlending,
      depthWrite: false
    })
  )
  rim.name = 'focus-rim'
  visual.mesh.add(rim)
  visual.extras.push(rim)
}
