import { Group, type AnimationClip } from 'three'
import { loadShipAsset } from './shipAssetLoader'
import { installShipCeilingRepair } from './shipCeilingRepair'
import { installShipFloorRepair } from './shipFloorRepair'

const modelUrl = new URL('../../../../assets/models/spacecraft-redesign-lod0.glb', import.meta.url).href
const ceilingUrl = new URL('../../../../assets/models/spacecraft-ceiling-repair.glb', import.meta.url).href
const floorUrl = new URL('../../../../assets/models/spacecraft-floor-repair.glb', import.meta.url).href
const repairs = [
  { url: ceilingUrl, install: installShipCeilingRepair, failed: 'ceilingRepairFailed' },
  { url: floorUrl, install: installShipFloorRepair, failed: 'floorRepairFailed' },
]
type Asset = { scene: Group; animations: readonly AnimationClip[] }
type Loader = (url: string, signal: AbortSignal) => Promise<Asset>

/** Transfer a validated repair to the main owner; failed optional repairs retain the original. */
export async function loadShipAssembly(signal: AbortSignal, release: (scene: Group) => void,
  load: Loader = loadShipAsset): Promise<Asset> {
  const main = await load(modelUrl, signal)
  try {
    signal.throwIfAborted()
    for (const item of repairs) {
      let repair: Asset | undefined
      try {
        repair = await load(item.url, signal)
        signal.throwIfAborted()
        if (!item.install(main.scene, repair.scene)) main.scene.userData[item.failed] = true
      } catch (error) {
        if (signal.aborted) throw error
        main.scene.userData[item.failed] = true
      } finally {
        // Successful installation moved its meshes into main; this root is then empty.
        if (repair) release(repair.scene)
      }
    }
    signal.throwIfAborted()
    return main
  } catch (error) {
    release(main.scene)
    throw error
  }
}
