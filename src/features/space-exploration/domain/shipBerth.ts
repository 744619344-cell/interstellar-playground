import { add3, type Vec3 } from './vec3'

// Visual-scale Earth berth; outside the existing ship and Moon protection envelopes.
const OFFSET = Object.freeze({ x: 0, y: 20, z: 30 })
export function shipBerthPosition(earth: Vec3): Vec3 { return add3(earth, OFFSET) }
