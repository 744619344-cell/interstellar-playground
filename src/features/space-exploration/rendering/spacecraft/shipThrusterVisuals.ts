import { AdditiveBlending, ConeGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import type { ShipFeedback } from '../../domain/shipFeedback'

export interface ThrusterVisuals {
  root: Group
  forward: Mesh<ConeGeometry, MeshBasicMaterial>
  reverse: Mesh<ConeGeometry, MeshBasicMaterial>
  left: Mesh<ConeGeometry, MeshBasicMaterial>
  right: Mesh<ConeGeometry, MeshBasicMaterial>
}

export function createThrusterVisuals(): ThrusterVisuals {
  const root = new Group()
  const forward = plume(0x38e9ff, [0, 0, 4], [Math.PI / 2, 0, 0])
  const reverse = plume(0x78bfff, [0, 0, -4], [-Math.PI / 2, 0, 0])
  const left = plume(0x8cf5ff, [2.6, 0, 0], [0, 0, -Math.PI / 2])
  const right = plume(0x8cf5ff, [-2.6, 0, 0], [0, 0, Math.PI / 2])
  root.add(forward, reverse, left, right)
  return { root, forward, reverse, left, right }
}

export function updateThrusterVisuals(thrusters: ThrusterVisuals, feedback: ShipFeedback) {
  setPlume(thrusters.forward, Math.max(feedback.forward, feedback.braking * 0.24))
  setPlume(thrusters.reverse, Math.max(feedback.reverse, feedback.braking * 0.45))
  setPlume(thrusters.left, feedback.strafeLeft)
  setPlume(thrusters.right, feedback.strafeRight)
}

function plume(color: number, position: [number, number, number], rotation: [number, number, number]) {
  const material = new MeshBasicMaterial({
    color, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, toneMapped: false
  })
  const mesh = new Mesh(new ConeGeometry(0.62, 3.6, 12, 1, true), material)
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.visible = false
  return mesh
}

function setPlume(mesh: Mesh<ConeGeometry, MeshBasicMaterial>, strength: number) {
  const value = Math.max(0, Math.min(1, strength))
  mesh.visible = value > 0.01
  mesh.material.opacity = value * 0.78
  mesh.scale.set(0.7 + value * 0.45, 0.4 + value * 1.1, 0.7 + value * 0.45)
}
