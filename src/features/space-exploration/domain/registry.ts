export type SystemBodyId =
  | 'sun'
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'moon'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'

export type SystemBodyKind = 'star' | 'planet' | 'satellite'

export interface SystemBodyRecord {
  id: SystemBodyId
  kind: SystemBodyKind
  parentId: SystemBodyId | null
  order: number
  displayName: string
}

export const SYSTEM_BODY_IDS: readonly SystemBodyId[] = [
  'sun', 'mercury', 'venus', 'earth', 'moon', 'mars',
  'jupiter', 'saturn', 'uranus', 'neptune'
]

export const SYSTEM_BODIES: readonly SystemBodyRecord[] = [
  { id: 'sun', kind: 'star', parentId: null, order: 0, displayName: '太阳' },
  { id: 'mercury', kind: 'planet', parentId: 'sun', order: 1, displayName: '水星' },
  { id: 'venus', kind: 'planet', parentId: 'sun', order: 2, displayName: '金星' },
  { id: 'earth', kind: 'planet', parentId: 'sun', order: 3, displayName: '地球' },
  { id: 'moon', kind: 'satellite', parentId: 'earth', order: 4, displayName: '月球' },
  { id: 'mars', kind: 'planet', parentId: 'sun', order: 5, displayName: '火星' },
  { id: 'jupiter', kind: 'planet', parentId: 'sun', order: 6, displayName: '木星' },
  { id: 'saturn', kind: 'planet', parentId: 'sun', order: 7, displayName: '土星' },
  { id: 'uranus', kind: 'planet', parentId: 'sun', order: 8, displayName: '天王星' },
  { id: 'neptune', kind: 'planet', parentId: 'sun', order: 9, displayName: '海王星' }
]

const BY_ID = new Map(SYSTEM_BODIES.map((body) => [body.id, body]))

export const KIND_LABEL: Record<SystemBodyKind, string> = {
  star: '恒星',
  planet: '行星',
  satellite: '卫星'
}

export function getSystemBody(id: SystemBodyId) {
  const body = BY_ID.get(id)
  if (!body) throw new Error(`unknown system body: ${id}`)
  return body
}

export function isSystemBodyId(value: unknown): value is SystemBodyId {
  return typeof value === 'string' && BY_ID.has(value as SystemBodyId)
}

export function childrenOf(parentId: SystemBodyId) {
  return SYSTEM_BODIES.filter((body) => body.parentId === parentId)
}
