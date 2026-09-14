import type { SystemBodyId } from '../domain/registry'

export interface VoyageTextureSet {
  surface: Record<SystemBodyId, string>
  earthNight: string
  earthClouds: string
  saturnRing: string
  milkyWay: string
}
