import profile from '../../../../assets/models/microgravity-cabin-20261025/sleep-fit-v2.json'
import scope from '../../../../assets/models/microgravity-cabin-20261025/sleep-fit-v2-mask.json'
import sideFit from '../../../../assets/models/microgravity-cabin-20261025/sleep-fit-v3.json'
import expandedFit from '../../../../assets/models/microgravity-cabin-20261025/sleep-fit-v4.json'

const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Existing module coordinates only. The source head/rear/frame regions receive exactly zero movement. */
export function sleepFabricDisplacement(point: { x: number; y: number; z: number }, moduleScale: number, vertex: number, sideConnections = false, wideRight = false) {
  if (!Number.isFinite(moduleScale) || moduleScale <= 0) throw Error('Invalid sleep module scale')
  const right = wideRight ? expandedFit.rightConnection : sideConnections ? sideFit.rightConnection : profile.rightConnection
  const side = smooth(...profile.leftConnection as [number, number], point.x) * (1 - smooth(...right as [number, number], point.x))
  const height = smooth(...profile.bottomConnection as [number, number], point.y) * (1 - smooth(...profile.neckOpening as [number, number], point.y))
  const front = smooth(...profile.rearConnection as [number, number], point.z)
  return profile.maximumCabinDisplacementM / moduleScale * side * height * front * scope.weights[vertex] / 255
}
