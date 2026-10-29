import { Box3, Group, Mesh, Object3D, Vector3, type AnimationClip } from 'three'
import oldLayout from '../../../../assets/models/current-ship-20261022/layout.json'
import oldManifest from '../../../../assets/models/current-ship-20261022/manifest.json'
import layout from '../../../../assets/models/microgravity-cabin-20261025/layout-candidate.json'
import manifest from '../../../../assets/models/microgravity-cabin-20261025/manifest.json'
import { CURRENT_SHIP_PART_ASSETS, SHIP_MODEL_ASSETS } from './shipModelAssets'
import { loadShipAsset } from './shipAssetLoader'
import { loadShipSources, releaseShipSources } from './shipSourceQueue'
import { useRefinedCabin } from './microgravitySurfaceFinish'
import { prepareCurrentShipSkins, type ShipPreviewObserver } from './currentShipAssembly'
import type { ShipAssetObserver, ShipLoadObserver } from './shipLoadProgress'

type Asset = { scene: Group; animations: readonly AnimationClip[] }
type Loader = (url: string, signal: AbortSignal, observe?: ShipAssetObserver) => Promise<Asset>
// Explicit URLs keep Vite's production asset discovery deterministic.
export const MICROGRAVITY_ASSETS = {
  'liner-v2': new URL('../../../../assets/models/microgravity-cabin-20261025/liner-v2.glb', import.meta.url).href,
  'sleep-v1': new URL('../../../../assets/models/microgravity-cabin-20261025/sleep-v1.glb', import.meta.url).href,
  'work-v1': new URL('../../../../assets/models/microgravity-cabin-20261025/work-v1.glb', import.meta.url).href,
  'locker-v1': new URL('../../../../assets/models/microgravity-cabin-20261025/locker-v1.glb', import.meta.url).href,
  'starboard-liner-v1': new URL('../../../../assets/models/microgravity-cabin-20261025/starboard-liner-v1.glb', import.meta.url).href,
  'inner-airlock-closed-v7': new URL('../../../../assets/models/microgravity-cabin-20261025/inner-airlock-closed-v7.glb', import.meta.url).href,
  'liner-end-return-v1': new URL('../../../../assets/models/microgravity-cabin-20261025/liner-end-return-v1.glb', import.meta.url).href,
  'crew-rocketbox': new URL('../../../../assets/models/microgravity-cabin-20261025/crew-rocketbox.glb', import.meta.url).href
}
const legacyCrew = new URL('../../../../assets/models/microgravity-cabin-20261025/crew-bound-v6.glb', import.meta.url).href
const lockerDoorCandidate = new URL('../../../../assets/models/microgravity-cabin-20261025/candidates/locker-doors-v1-20261028/locker-doors-v1.glb', import.meta.url).href

function retainedParts(scene: Group, sources: Map<string, Group>) {
  for (const part of oldLayout.parts) {
    if (!['floor', 'seat', 'main-console', 'aft-bulkhead'].includes(part.source)) continue
    const source = sources.get(part.source)!, p = part.placement, wrapper = new Group()
    wrapper.name = part.name; wrapper.userData.partSource = part.source; wrapper.userData.partType = part.type
    wrapper.position.fromArray(p.offset); wrapper.quaternion.fromArray(p.quaternion); wrapper.scale.setScalar(p.uniformScale)
    const instance = source.clone(true)
    instance.traverse(o => { if (o instanceof Mesh) Object.assign(o.userData, { currentShipPart: 'equipment', masterInterior: true }) })
    wrapper.add(instance); scene.add(wrapper)
  }
}

function candidateParts(scene: Group, sources: Map<string, Group>) {
  for (const p of layout.placements) {
    const wrapper = new Group(), instance = sources.get(p.id)!.clone(true)
    wrapper.name = p.name; wrapper.userData.microgravityModule = p.id
    wrapper.position.fromArray(p.offset); wrapper.rotation.y = p.yaw; wrapper.scale.setScalar(p.scale)
    instance.traverse(o => { if (o instanceof Mesh) Object.assign(o.userData, { currentShipPart: 'equipment', masterInterior: true, microgravityModule: p.name }) })
    wrapper.add(instance); scene.add(wrapper)
  }
}

function crew(scene: Group, source: Group, name: string, height: number, rotation: number) {
  source.updateMatrixWorld(true)
  const box = new Box3().setFromObject(source, true), size = box.getSize(new Vector3()), scale = height / size.y
  const wrapper = new Group(); wrapper.name = name
  source.scale.multiplyScalar(scale); source.rotation.y += rotation
  const center = box.getCenter(new Vector3()).multiplyScalar(scale).applyAxisAngle(new Vector3(0, 1, 0), rotation)
  source.position.sub(center); wrapper.position.set(0, -.2, -2.3); wrapper.rotation.y = Math.PI
  source.traverse(o => { if (o instanceof Mesh) Object.assign(o.userData, { currentShipPart: 'crew', masterInterior: true }) })
  wrapper.add(source); scene.add(wrapper); return wrapper
}

/** Review assembly: rigid uniform source transforms only. Original sources/layout remain separate. */
export async function loadMicrogravityAssembly(signal: AbortSignal, release: (scene: Group) => void,
  load: Loader = (url, supplied, observe) => loadShipAsset(url, supplied, true, observe,
    url === MICROGRAVITY_ASSETS['crew-rocketbox'] || url === legacyCrew || useRefinedCabin() && Object.values(MICROGRAVITY_ASSETS).includes(url) ? 2048 : 1024),
  observe?: ShipLoadObserver, _preview?: ShipPreviewObserver, options?: { lockerDoors?: boolean }): Promise<Asset> {
  const jobs = [{ id: 'hull', url: SHIP_MODEL_ASSETS.assembly, bytes: 59312672 },
    ...(['floor', 'seat', 'main-console', 'aft-bulkhead'] as const).map(id => ({ id, url: CURRENT_SHIP_PART_ASSETS[id], bytes: oldManifest.assets[id].bytes })),
    { id: 'suit', url: SHIP_MODEL_ASSETS.crew, bytes: oldManifest.assets.crew.bytes },
    ...Object.entries(MICROGRAVITY_ASSETS).map(([id, url]) => ({ id, url, bytes: manifest.assets[id as keyof typeof manifest.assets].bytes }))]
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('crew') === 'legacy') {
    const job = jobs.find(job => job.id === 'crew-rocketbox')!; job.url = legacyCrew; job.bytes = manifest.assets['crew-bound-v6'].bytes
  }
  if (options?.lockerDoors || typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('lockerDoors') === 'v1') jobs.push({ id: 'locker-doors', url: lockerDoorCandidate, bytes: 10888 })
  const sources = await loadShipSources(jobs, signal, load, release, observe)
  try {
    const scene = sources.get('hull')!; prepareCurrentShipSkins(scene)
    const hull = scene.children.find(o => o.userData.masterInterior)!
    hull.name = 'Ship_Adapted'; hull.userData.pilotPitchOffset = -.13
    scene.userData.masterInterior = true; scene.userData.microgravityCandidate = true
    for (const [name, point] of [['Anchor_CockpitCamera', [.9, -.25, -4.55]], ['Anchor_StandUp', [0, -.2, -2.3]]] as const) {
      const anchor = new Object3D(); anchor.name = name; anchor.position.fromArray(point); scene.add(anchor)
    }
    retainedParts(scene, sources); candidateParts(scene, sources)
    crew(scene, sources.get('crew-rocketbox')!, 'MicrogravityCrew', 1.8, 0)
    const suited = crew(scene, sources.get('suit')!, 'MicrogravitySuit', 1.85, -Math.PI / 2); suited.visible = false
    const lockerDoors = sources.get('locker-doors'); if (lockerDoors) scene.add(lockerDoors)
    const library = new Group(); library.name = 'MicrogravitySourceOwnership'; library.visible = false
    for (const [id, source] of sources) if (!['hull', 'suit', 'crew-rocketbox', 'locker-doors'].includes(id)) library.add(source)
    scene.add(library)
    scene.updateMatrixWorld(true); signal.throwIfAborted()
    return { scene, animations: [] }
  } catch (error) { releaseShipSources(sources.values(), release); throw error }
}




