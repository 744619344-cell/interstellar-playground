import { Group, Mesh, Object3D, type AnimationClip } from 'three'
import layout from '../../../../assets/models/current-ship-20261022/layout.json'
import manifest from '../../../../assets/models/current-ship-20261022/manifest.json'
import { SHIP_MODEL_ASSETS, CURRENT_SHIP_PART_ASSETS } from './shipModelAssets'
import { loadShipAsset } from './shipAssetLoader'
import { placeCurrentShipCrew } from './currentShipCrew'
import type { ShipAssetObserver, ShipLoadObserver } from './shipLoadProgress'
import { loadShipSources, releaseShipSources } from './shipSourceQueue'

type Asset = { scene: Group; animations: readonly AnimationClip[] }
export type ShipPreviewObserver = (asset?: Asset) => void
type Loader = (url: string, signal: AbortSignal, observe?: ShipAssetObserver) => Promise<Asset>
export const CURRENT_SHIP_ANCHORS = ['cockpit', 'stand-up'] as const

/** Tag the actual current skins, preserving physical glazing and every source vertex. */
export function prepareCurrentShipSkins(scene: Group) {
  scene.userData.currentFittedAssembly = true
  scene.traverse(object => {
    if (object instanceof Mesh) Object.assign(object.userData, { currentShipPart: 'skin', masterInterior: true })
  })
}

function installNavigation(scene: Group) {
  const root = scene.children.find(object => object.userData.masterInterior)
  if (!root) throw new Error('Missing current ship skin metadata')
  root.name = 'Ship_Adapted'
  root.userData.pilotPitchOffset = -.13
  scene.userData.masterInterior = true
  for (const [name, position] of [
    ['Anchor_CockpitCamera', [.9, -.25, -4.55]],
    ['Anchor_StandUp', [0, -.05, -2.6]]
  ] as const) {
    const anchor = new Object3D(); anchor.name = name
    anchor.position.set(position[0], position[1], position[2]); scene.add(anchor)
  }
}

function placeParts(scene: Group, sources: Map<string, Group>) {
  for (const part of layout.parts) {
    const original = sources.get(part.source), placement = part.placement
    if (!original || !(placement.uniformScale > 0) || Math.abs(Math.hypot(...placement.quaternion) - 1) > 1e-6)
      throw new Error('Invalid existing furniture placement')
    const wrapper = new Group(); wrapper.name = part.name
    wrapper.userData.partType = part.type; wrapper.userData.partSource = part.source
    wrapper.quaternion.fromArray(placement.quaternion); wrapper.scale.setScalar(placement.uniformScale)
    wrapper.position.fromArray(placement.offset)
    const instance = original.clone(true)
    instance.traverse(object => {
      if (object instanceof Mesh) Object.assign(object.userData, {
        currentShipPart: 'equipment', masterInterior: true, module: part.source
      })
    })
    wrapper.add(instance); scene.add(wrapper)
  }
}

function prepareHull(scene: Group) { prepareCurrentShipSkins(scene); installNavigation(scene) }

async function stagedSources(jobs: { id: string; url: string; bytes: number }[], signal: AbortSignal,
  load: Loader, release: (scene: Group) => void, observe: ShipLoadObserver | undefined, preview: ShipPreviewObserver) {
  const sources = new Map<string, Group>(), totalBytes = jobs.reduce((sum, job) => sum + job.bytes, 0)
  try {
    const hull = await load(jobs[0].url, signal, (loadedBytes, phase) => observe?.({
      loadedBytes, totalBytes, completed: 0, total: jobs.length, phase, asset: '船体' }))
    sources.set('hull', hull.scene); signal.throwIfAborted(); prepareHull(hull.scene)
    preview({ scene: hull.scene, animations: [] })
    const rest = await loadShipSources(jobs.slice(1), signal, load, release, progress => observe?.({ ...progress,
      loadedBytes: progress.loadedBytes + jobs[0].bytes, totalBytes, completed: progress.completed + 1, total: jobs.length }))
    rest.forEach((scene, id) => sources.set(id, scene))
    return sources
  } catch (error) {
    preview(); releaseShipSources(sources.values(), release); throw error
  }
}

/** All requested sources share one owner on success; cancellation/failure releases each source once. */
export async function loadCurrentShipAssembly(signal: AbortSignal, release: (scene: Group) => void,
  load: Loader = (url, supplied, observe) => loadShipAsset(url, supplied, true, observe),
  observe?: ShipLoadObserver, preview?: ShipPreviewObserver): Promise<Asset> {
  const jobs = [
    { id: 'hull', url: SHIP_MODEL_ASSETS.assembly, bytes: manifest.assets.hull.bytes },
    ...Object.entries(CURRENT_SHIP_PART_ASSETS).map(([id, url]) => ({ id, url,
      bytes: manifest.assets[id as keyof typeof manifest.assets].bytes })),
    { id: 'crew', url: SHIP_MODEL_ASSETS.crew, bytes: manifest.assets.crew.bytes }
  ]
  const sources = preview ? await stagedSources(jobs, signal, load, release, observe, preview)
    : await loadShipSources(jobs, signal, load, release, observe)
  try {
    const scene = sources.get('hull')!
    if (!preview) prepareHull(scene)
    const seated = placeCurrentShipCrew(sources.get('crew')!)
    signal.throwIfAborted()
    placeParts(scene, sources); scene.add(seated)
    scene.updateMatrixWorld(true)
    preview?.() // End the borrowed preview before transferring the complete scene to its owner.
    return { scene, animations: [] }
  } catch (error) {
    preview?.()
    // A single disposal traversal deduplicates buffers shared by any partially installed clones.
    releaseShipSources(sources.values(), release)
    throw error
  }
}
