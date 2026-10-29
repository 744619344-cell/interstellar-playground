import { Mesh } from 'three'
import type { VisibilityState } from './shipVisibility'

const enclosure = /(?:floor|ceiling|wall|window-frame|window-liner)$/

/** Explicit asset metadata avoids treating Chinese mesh labels as legacy geometry names. */
export function adaptedShipVisible(mesh: Mesh, state: VisibilityState): boolean | undefined {
  // Current assembly is already the exact fitted preview: do not hide its glass, inner skin or crew.
  if (mesh.userData.currentShipPart) return true
  const { module, zone, part, cutaway, label } = mesh.userData
  if (mesh.userData.supersededByJoinery || mesh.userData.supersededByAtlas) return false
  const innerFrame = module === 'airlock-door-frame' && label === '气闸内门框'
  const outerFrame = module === 'airlock-door-frame' && label === '气闸外门框'
  const pressureBoundary = mesh.userData.enclosure === true
    || (module === 'mounting-fixture' && label === '气闸门框侧接板')
  if (!module) return undefined
  if (state.view === 'cutaway') return !part && !cutaway
  if (part === 'hull') return state.view === 'exterior'
  if (part === 'glass' && module === 'exterior-glass' && mesh.userData.masterInterior) return state.view === 'exterior'
  if (part === 'glass') return true
  if (state.view === 'exterior') {
    if (outerFrame || mesh.name === 'Pressure_Bulkhead_Outer' || (mesh.userData.masterInterior && mesh.name.startsWith('Door_Outer-bulkhead'))
      || ['airlock-outer-door', 'exit-liner'].includes(module)) return true
    return state.outerOpen && zone === '气闸'
  }
  if (state.view === 'cockpit') {
    return zone === '驾驶区' || zone === '后舱' || enclosure.test(module) || pressureBoundary
      || innerFrame || module === 'airlock-inner-door'
      || (state.innerOpen && zone === '气闸')
  }
  return zone === ({ cabin: '后舱', airlock: '气闸' } as const)[state.view]
    || (state.view === 'cabin' && zone === '驾驶区')
    || enclosure.test(module) || pressureBoundary || innerFrame || module === 'airlock-inner-door'
    || (state.view === 'airlock' && (outerFrame || module === 'airlock-outer-door')) || state.innerOpen
}
