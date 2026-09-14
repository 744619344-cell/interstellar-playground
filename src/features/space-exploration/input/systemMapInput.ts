export interface PointerPoint {
  x: number
  y: number
  id: number
  pan?: boolean
}

export type SystemMapGesture =
  | { type: 'orbit'; dx: number; dy: number }
  | { type: 'pan'; dx: number; dy: number }
  | { type: 'zoom'; deltaY: number }
  | { type: 'tap'; x: number; y: number }
  | { type: 'doubletap'; x: number; y: number }

const DRAG_THRESHOLD = 5
const DOUBLE_MS = 320

export class SystemMapInput {
  private enabled = true
  private pointers = new Map<number, PointerPoint>()
  private dragOrigin?: PointerPoint
  private pinchDistance = 0
  private moved = false
  private lastTap = 0
  private lastTapX = 0
  private lastTapY = 0

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (!enabled) this.clear()
  }

  clear() {
    this.pointers.clear()
    this.pinchDistance = 0
    this.moved = false
    this.dragOrigin = undefined
  }

  pointerDown(point: PointerPoint) {
    if (!this.enabled) return
    this.pointers.set(point.id, point)
    this.dragOrigin = point
    this.moved = false
    if (this.pointers.size === 2) this.pinchDistance = currentPinch(this.pointers)
  }

  pointerMove(point: PointerPoint): SystemMapGesture[] {
    if (!this.enabled) return []
    const previous = this.pointers.get(point.id)
    if (!previous) return []
    this.pointers.set(point.id, point)
    if (this.pointers.size === 2) return this.pinchZoom()
    const from = this.moved ? previous : this.dragOrigin ?? previous
    const dx = point.x - from.x
    const dy = point.y - from.y
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) this.moved = true
    if (!this.moved) return []
    return [{ type: point.pan || previous.pan ? 'pan' : 'orbit', dx, dy }]
  }

  pointerUp(point: PointerPoint): SystemMapGesture[] {
    if (!this.enabled) return []
    const had = this.pointers.get(point.id)
    this.pointers.delete(point.id)
    this.dragOrigin = this.pointers.values().next().value
    this.pinchDistance = this.pointers.size === 2 ? currentPinch(this.pointers) : 0
    if (!had || this.moved || this.pointers.size > 0) return []
    const now = Date.now()
    const doubled = now - this.lastTap < DOUBLE_MS && Math.hypot(point.x - this.lastTapX, point.y - this.lastTapY) < 14
    this.lastTap = now
    this.lastTapX = point.x
    this.lastTapY = point.y
    return [{ type: doubled ? 'doubletap' : 'tap', x: point.x, y: point.y }]
  }

  wheel(deltaY: number): SystemMapGesture[] {
    if (!this.enabled) return []
    return [{ type: 'zoom', deltaY }]
  }

  private pinchZoom(): SystemMapGesture[] {
    const next = currentPinch(this.pointers)
    if (!this.pinchDistance || !next) return []
    const deltaY = (this.pinchDistance - next) * 4
    this.pinchDistance = next
    this.moved = true
    return [{ type: 'zoom', deltaY }]
  }
}

function currentPinch(pointers: Map<number, PointerPoint>) {
  const points = [...pointers.values()]
  if (points.length < 2) return 0
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
}
