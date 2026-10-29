import manifest from '../../../../assets/models/current-ship-transfer-20261022/manifest.json'
import production from '../../../../assets/models/current-ship-20261022/manifest.json'
import { SHIP_MODEL_ASSETS, CURRENT_SHIP_PART_ASSETS } from './shipModelAssets'

const archives = {
  hull: new URL('../../../../assets/models/current-ship-transfer-20261022/hull-g12.glb.gz', import.meta.url).href,
  crew: new URL('../../../../assets/models/current-ship-transfer-20261022/crew.glb.gz', import.meta.url).href,
  floor: new URL('../../../../assets/models/current-ship-transfer-20261022/floor.glb.gz', import.meta.url).href,
  'folding-berth': new URL('../../../../assets/models/current-ship-transfer-20261022/folding-berth.glb.gz', import.meta.url).href,
  'rear-workbench': new URL('../../../../assets/models/current-ship-transfer-20261022/rear-workbench.glb.gz', import.meta.url).href,
  'storage-cabinet': new URL('../../../../assets/models/current-ship-transfer-20261022/storage-cabinet.glb.gz', import.meta.url).href,
  'dual-suit-locker': new URL('../../../../assets/models/current-ship-transfer-20261022/dual-suit-locker.glb.gz', import.meta.url).href,
  seat: new URL('../../../../assets/models/current-ship-transfer-20261022/seat.glb.gz', import.meta.url).href,
  'main-console': new URL('../../../../assets/models/current-ship-transfer-20261022/main-console.glb.gz', import.meta.url).href,
  'aft-bulkhead': new URL('../../../../assets/models/current-ship-transfer-20261022/aft-door-d2.glb.gz', import.meta.url).href
}
const originals = { hull: SHIP_MODEL_ASSETS.assembly, crew: SHIP_MODEL_ASSETS.crew, ...CURRENT_SHIP_PART_ASSETS }

export function shipTransferAsset(url: string) {
  const id = (Object.keys(archives) as (keyof typeof archives)[]).find(id => originals[id] === url)
  // A changed model must fall back to its new raw bytes until its matching archive is packaged.
  if (id && manifest.assets[id].originalSha256 === production.assets[id].sha256)
    return { url: archives[id], originalBytes: manifest.assets[id].originalBytes }
}
