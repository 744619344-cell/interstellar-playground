import type { SystemBodyId } from './registry'

export type LodLevel = 'lod2' | 'lod1'

export interface LodState {
  focusedId: SystemBodyId | null
  generation: number
}

export function initialLodState(): LodState {
  return { focusedId: null, generation: 0 }
}

export function lodForBody(id: SystemBodyId, state: LodState): LodLevel {
  return state.focusedId === id ? 'lod1' : 'lod2'
}

export function focusLod(state: LodState, id: SystemBodyId | null): LodState {
  return { focusedId: id, generation: state.generation + 1 }
}

export function isLodCurrent(state: LodState, generation: number) {
  return generation === state.generation
}

export function lod1Count(state: LodState) {
  return state.focusedId ? 1 : 0
}

export function acceptLateResource(state: LodState, requestedId: SystemBodyId, generation: number) {
  return isLodCurrent(state, generation) && state.focusedId === requestedId
}
