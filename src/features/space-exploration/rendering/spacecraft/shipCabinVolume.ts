import type { Group, Vector3 } from 'three'
import type { Vec3 } from '../../domain/vec3'

export interface ShipCabinVolume {
  floor: number; halfWidth: number; front: number; tail: number; habitatEnd: number
  aperture: { halfWidth: number; bottom: number; top: number; bevel: number }
  doorLeafOffset?: number; doorLeafThickness?: number
}

/** Dimensions come from the exported master, and fail closed if the manifest is malformed. */
export function shipMasterCabinVolume(model: Group): ShipCabinVolume | undefined {
  const root = model.getObjectByName('Ship_Adapted')
  if (!root?.userData.masterInterior) return undefined
  const value = root.userData.pressureSection as ShipCabinVolume | undefined
  if (!value || !value.aperture || ![value.floor, value.halfWidth, value.front, value.tail,
    value.habitatEnd, ...Object.values(value.aperture)].every(Number.isFinite)) throw new Error('Invalid master cabin volume')
  return value
}

export function masterRoofHeight(z: number) {
  const slope = .85 / 3.3, start = -2.8, end = -2.35
  if (z <= start) return .25 + (z + 5.9) * slope
  if (z >= end) return 1.12
  const t = (z - start) / (end - start), h = .25 + (start + 5.9) * slope
  return (2*t**3-3*t*t+1)*h+(t**3-2*t*t+t)*(end-start)*slope+(-2*t**3+3*t*t)*1.12
}

export function insideMasterCabin(point: Vector3, volume: ShipCabinVolume, radius: number, innerOpen: boolean) {
  const outerInset = (volume.doorLeafOffset ?? .074) + (volume.doorLeafThickness ?? .078)/2
  if (Math.abs(point.x) > volume.halfWidth-radius || point.z < volume.front+radius
    || point.z > volume.tail-outerInset-radius || point.y < volume.floor+radius
    || point.y > masterRoofHeight(point.z)-radius) return false
  if (Math.abs(point.z-volume.habitatEnd) > .20+radius) return true
  if (!innerOpen) return false
  const { halfWidth, bottom, top, bevel } = volume.aperture
  if (point.y < bottom+radius || point.y > top-radius || Math.abs(point.x) > halfWidth-radius) return false
  // Distance from a bevelled corner plane, including the spherical camera radius.
  const corner = Math.max(bottom+bevel-point.y, point.y-(top-bevel))
  return Math.abs(point.x)+corner <= halfWidth-radius*Math.SQRT2
}

/** Conservative hinge sweep, including the observation sphere and the leaf hardware. */
export function insideMasterInnerSweep(point: Vec3, volume: ShipCabinVolume) {
  const radius = .12, hingeX = -volume.aperture.halfWidth
  const hingeZ = volume.habitatEnd+(volume.doorLeafOffset ?? .074)
  if (point.y < volume.aperture.bottom-radius || point.y > volume.aperture.top+radius) return false
  if (point.z < hingeZ-.16-radius || point.x < hingeX-.16-radius) return false
  return Math.hypot(point.x-hingeX,point.z-hingeZ) < volume.aperture.halfWidth*2+.16+radius
}
