import type { ProjectedBody, Viewport } from './projection'

export interface LabelBox {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export function estimateLabelWidth(text: string) {
  let units = 0
  for (const character of text) units += /[\u3000-\u9fff]/.test(character) ? 1 : 0.55
  return Math.max(24, Math.ceil(units * 13 + 8))
}

export function placeLabels(bodies: ProjectedBody[], names: Record<string, string>, viewport: Viewport) {
  const placed: LabelBox[] = []
  const visible = bodies.filter((body) => body.visible).sort((a, b) => a.y - b.y || a.x - b.x)
  for (const body of visible) {
    const width = estimateLabelWidth(names[body.id] ?? body.id)
    const height = 16
    placed.push(findPlacement(body, width, height, placed, visible, viewport))
  }
  return placed
}

function findPlacement(
  body: ProjectedBody,
  width: number,
  height: number,
  placed: LabelBox[],
  bodies: ProjectedBody[],
  viewport: Viewport
) {
  const fromCenterX = body.x - viewport.width / 2
  const fromCenterY = body.y - viewport.height / 2
  const length = Math.hypot(fromCenterX, fromCenterY)
  const radial = length > 1 ? { x: fromCenterX / length, y: fromCenterY / length } : { x: 0, y: 1 }
  const directions = preferredDirections(body, bodies, radial)
  for (let step = 0; step <= 2; step += 1) {
    for (const direction of directions) {
      const labelExtent = Math.abs(direction.x) * width / 2 + Math.abs(direction.y) * height / 2
      const distance = body.radius + 8 + labelExtent + step * 6
      const box = clampToViewport({
        id: body.id,
        x: body.x + direction.x * distance,
        y: body.y + direction.y * distance - height / 2,
        width,
        height
      }, viewport)
      if (!overlaps(box, placed) && !overlapsBodies(box, bodies, body.id)) return box
    }
  }
  return clampToViewport({
    id: body.id,
    x: body.x,
    y: body.y + body.radius + 10,
    width,
    height
  }, viewport)
}

function preferredDirections(body: ProjectedBody, bodies: ProjectedBody[], radial: { x: number; y: number }) {
  const nearby = [
    { x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: -1 },
    { x: 0.7071, y: 0.7071 }, { x: -0.7071, y: 0.7071 },
    { x: 0.7071, y: -0.7071 }, { x: -0.7071, y: -0.7071 }
  ]
  if (body.id === 'moon') {
    const earth = bodies.find((candidate) => candidate.id === 'earth')
    if (earth) {
      const x = body.x - earth.x
      const y = body.y - earth.y
      const length = Math.hypot(x, y)
      if (length > 1) return [{ x: x / length, y: y / length }, ...nearby, radial]
    }
  }
  return [...nearby, radial]
}

function overlaps(box: LabelBox, placed: LabelBox[]) {
  const gap = 8
  return placed.some((other) => (
    Math.abs(box.x - other.x) < (box.width + other.width) / 2 + gap
    && Math.abs((box.y + box.height / 2) - (other.y + other.height / 2)) < (box.height + other.height) / 2 + gap
  ))
}

function overlapsBodies(box: LabelBox, bodies: ProjectedBody[], ownerId: string) {
  const left = box.x - box.width / 2
  const top = box.y
  return bodies.some((body) => {
    if (body.id === ownerId) return false
    const nearestX = Math.max(left, Math.min(body.x, left + box.width))
    const nearestY = Math.max(top, Math.min(body.y, top + box.height))
    return Math.hypot(body.x - nearestX, body.y - nearestY) < body.radius + 5
  })
}

function clampToViewport(box: LabelBox, viewport: Viewport) {
  const margin = 18
  return {
    ...box,
    x: Math.max(margin + box.width / 2, Math.min(viewport.width - margin - box.width / 2, box.x)),
    y: Math.max(margin, Math.min(viewport.height - margin - box.height, box.y))
  }
}
