/** Replace compatible assets here; flight, navigation and map entry share this one source. */
// Current assembly uses the reviewed skins and separately owned existing furniture/crew.
export const SHIP_MODEL_ASSETS = Object.freeze({
  assembly: new URL('../../../../assets/models/current-ship-20261022/hull-g12.glb', import.meta.url).href,
  exterior: new URL('../../../../assets/models/current-ship-20261022/hull-g12.glb', import.meta.url).href,
  legacyAssembly: new URL('../../../../assets/models/spacecraft-master-lod0.glb', import.meta.url).href,
  crew: new URL('../../../../assets/models/current-ship-20261022/crew.glb', import.meta.url).href,
  attribution: new URL('../../../../assets/models/current-ship-20261022/ATTRIBUTION.md', import.meta.url).href
})

export const CURRENT_SHIP_PART_ASSETS = Object.freeze({
  floor: new URL('../../../../assets/models/current-ship-20261022/floor.glb', import.meta.url).href,
  'folding-berth': new URL('../../../../assets/models/current-ship-20261022/folding-berth.glb', import.meta.url).href,
  'rear-workbench': new URL('../../../../assets/models/current-ship-20261022/rear-workbench.glb', import.meta.url).href,
  'storage-cabinet': new URL('../../../../assets/models/current-ship-20261022/storage-cabinet.glb', import.meta.url).href,
  'dual-suit-locker': new URL('../../../../assets/models/current-ship-20261022/dual-suit-locker.glb', import.meta.url).href,
  seat: new URL('../../../../assets/models/current-ship-20261022/seat.glb', import.meta.url).href,
  'main-console': new URL('../../../../assets/models/current-ship-20261022/main-console.glb', import.meta.url).href,
  'aft-bulkhead': new URL('../../../../assets/models/current-ship-20261022/aft-door-d2.glb', import.meta.url).href
})
