import { Line, TextureLoader } from 'three'
import { ShipCameraPreview, type ShipPreviewAction } from '../spacecraft/shipCameraPreview'
import { nextShipView } from '../spacecraft/shipViewCamera'
import {
  applyOrbitDrag, applyPan, applyZoom, cameraEye, cameraUp, focusPose, overviewPose,
  startTransition, stepTransition, type CameraPose, type CameraTransition
} from '../../domain/cameraModel'
import { placeLabels, type LabelBox } from '../../domain/labels'
import { KIND_LABEL, SYSTEM_BODIES, getSystemBody, type SystemBodyId } from '../../domain/registry'
import { visualDistance } from '../../domain/layout'
import { bodyPositionsAt, bodySpinAt } from '../../domain/orbitMotion'
import { projectPoint } from '../../domain/projection'
import { focusLod, initialLodState, lodForBody, type LodState } from '../../domain/lodModel'
import { visualScale } from '../../domain/visualScale'
import { SystemMapInput, type SystemMapGesture } from '../../input/systemMapInput'
import { VoyageFrameLoop, type FrameClock } from '../voyageFrameLoop'
import type { VoyageTextureSet } from '../voyagePublicTypes'
import { disposeObject, VoyageResourceGate } from '../voyageResources'
import { createSystemContent, setBodyLod, type BodyVisual } from './systemMapBodies'
import { pickProjectedBody } from './systemMapPick'
import { addSystemSky, createSystemMapWorld, type SystemMapWorld, type SystemMapWorldFactories } from './systemMapWorld'

export interface SystemMapSnapshot {
  selectedId: SystemBodyId | null
  focusedId: SystemBodyId | null
  transitioning: boolean
  mode: 'overview' | 'focus'
  name: string
  kind: string
  visualDistance: number
  labels: LabelBox[]
  failed?: string
  cameraPreview?: ReturnType<ShipCameraPreview['snapshot']>
}

interface Options {
  canvas: HTMLCanvasElement
  width: number
  height: number
  pixelRatio: number
  textures: VoyageTextureSet
  onSnapshot: (snapshot: SystemMapSnapshot) => void
  onFail?: (reason: string) => void
  cameraPreview?: boolean
}

export class SystemMapEngine {
  private world?: SystemMapWorld
  private sky?: ReturnType<typeof addSystemSky>
  private bodies = new Map<SystemBodyId, BodyVisual>()
  private orbits = new Map<SystemBodyId, Line>()
  private readonly loop: VoyageFrameLoop
  private readonly gate = new VoyageResourceGate()
  private readonly input = new SystemMapInput()
  private readonly loader: TextureLoader
  private pose: CameraPose = overviewPose()
  private lod: LodState = initialLodState()
  private transition?: CameraTransition
  private selectedId: SystemBodyId | null = null
  private destroyed = false
  private lastTime = 0
  private lastPublish = 0
  private simulationTime = 0
  private simulationPaused = false
  private trackFocusedBody = false
  private width: number
  private height: number
  private preview?: ShipCameraPreview
  private inputEnabled = true

  constructor(
    private readonly options: Options,
    clock: FrameClock = globalThis,
    factories?: SystemMapWorldFactories,
    loader?: TextureLoader
  ) {
    this.width = options.width
    this.height = options.height
    this.pose = overviewPose({ width: options.width, height: options.height })
    this.loop = new VoyageFrameLoop(clock)
    this.loader = loader ?? new TextureLoader()
    try {
      this.world = createSystemMapWorld(options.canvas, options.width, options.height, options.pixelRatio, factories)
      this.sky = addSystemSky(this.world.scene, options.textures.milkyWay, this.loader, this.gate)
      const content = createSystemContent(options.textures, this.loader, this.gate)
      this.world.scene.add(content.root)
      this.bodies = content.bodies
      this.orbits = content.orbits
      this.updateBodyMotion()
      this.applyPose()
      options.canvas.addEventListener('webglcontextlost', this.onContextLost)
      this.publish()
    } catch (error) {
      this.destroy()
      throw error
    }
  }

  start() { if (!this.destroyed) this.loop.start(this.tick) }
  stop() { this.loop.stop(); this.lastTime = 0 }
  setSimulationPaused(paused: boolean) { this.simulationPaused = paused; this.preview?.pause(paused) }
  setInputEnabled(enabled: boolean) { this.inputEnabled = enabled; this.input.setEnabled(enabled); this.preview?.suspend(!enabled) }
  clearInput() { this.input.clear(); this.preview?.clear() }
  previewAction(action: ShipPreviewAction) {
    if (!this.options.cameraPreview || this.destroyed || !this.world || !this.inputEnabled) return
    if (action === 'enter' && !this.preview) {
      this.transition = undefined
      this.setFocus(null)
      const earth = this.bodies.get('earth')!.group.position
      this.preview = new ShipCameraPreview(this.world, { x: earth.x, y: earth.y + 20, z: earth.z + 30 })
      this.preview.pause(this.simulationPaused)
    } else if (action === 'reset') this.preview?.reset()
    else if (action === 'obstacle') this.preview?.toggleObstacle()
    else if (action === 'follow' || action === 'cockpit' || action === 'free') this.preview?.mode(action)
    else this.preview?.navigate(action)
    this.clearInput(); this.publish()
  }
  previewKey(code: string, down: boolean) {
    if (!this.preview || !this.inputEnabled) return false
    if (code === 'KeyC') {
      if (down) this.preview.mode(nextShipView(this.preview.snapshot().mode))
      return true
    }
    return this.preview.key(code, down)
  }

  resize(width: number, height: number, pixelRatio: number) {
    if (!this.world || this.destroyed || width < 1 || height < 1) return
    const previousFit = overviewPose({ width: this.width, height: this.height }).distance
    const nextFit = overviewPose({ width, height }).distance
    if (!this.lod.focusedId) {
      const ratio = nextFit / previousFit
      this.pose = { ...this.pose, distance: this.pose.distance * ratio }
      if (this.transition) {
        this.transition.from.distance *= ratio
        this.transition.to.distance *= ratio
      }
    }
    this.width = width
    this.height = height
    this.world.camera.aspect = width / height
    this.world.camera.updateProjectionMatrix()
    this.world.renderer.setPixelRatio(pixelRatio)
    this.world.renderer.setSize(width, height, false)
    this.applyPose()
    this.world.renderer.render(this.world.scene, this.world.camera)
    this.preview?.render()
    this.publish()
  }

  handlePointerDown(x: number, y: number, id = 1, pan = false) { this.input.pointerDown({ x, y, id, pan }) }
  handlePointerMove(x: number, y: number, id = 1, pan = false) { this.applyGestures(this.input.pointerMove({ x, y, id, pan })) }
  handlePointerUp(x: number, y: number, id = 1, pan = false) { this.applyGestures(this.input.pointerUp({ x, y, id, pan })) }
  handleWheel(deltaY: number) { this.applyGestures(this.input.wheel(deltaY)) }

  select(id: SystemBodyId | null) {
    this.selectedId = id
    this.publish()
  }

  focus(id: SystemBodyId) {
    this.selectedId = id
    this.trackFocusedBody = true
    const position = this.bodies.get(id)?.group.position
    this.beginTransition(focusPose(id, this.pose, position), id)
  }

  overview() {
    this.preview?.destroy(); this.preview = undefined; this.clearInput()
    this.selectedId = null
    this.trackFocusedBody = false
    this.beginTransition(overviewPose({ width: this.width, height: this.height }), null)
  }

  zoomBy(deltaY: number) {
    if (this.preview) { this.preview.zoom(deltaY); return }
    this.transition = undefined
    this.pose = this.zoomPose(deltaY)
    this.applyPose()
    this.publish()
  }

  snapshot(): SystemMapSnapshot {
    const selected = this.selectedId ?? this.lod.focusedId
    const body = selected ? getSystemBody(selected) : null
    const target = selected ? this.bodies.get(selected)?.group.position : undefined
    const eye = cameraEye(this.pose)
    const viewport = { width: this.width, height: this.height }
    const names = Object.fromEntries(SYSTEM_BODIES.map((item) => [item.id, item.displayName]))
    return {
      selectedId: selected,
      focusedId: this.lod.focusedId,
      transitioning: !!this.transition,
      mode: this.lod.focusedId ? 'focus' : 'overview',
      name: body?.displayName ?? '太阳系',
      kind: body ? KIND_LABEL[body.kind] : '全景',
      visualDistance: target ? visualDistance(eye, { x: target.x, y: target.y, z: target.z }) : this.pose.distance,
      labels: this.preview ? [] : placeLabels(this.projectCurrentBodies(), names, viewport),
      cameraPreview: this.preview?.snapshot()
    }
  }

  rendererInfo() {
    return this.world?.renderer.info
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.loop.destroy()
    this.gate.destroy()
    this.input.clear()
    this.preview?.destroy(); this.preview = undefined
    this.options.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    if (!this.world) return
    disposeObject(this.world.scene)
    this.world.renderer.dispose()
    this.world = undefined
    this.sky = undefined
  }

  private beginTransition(to: CameraPose, focused: SystemBodyId | null) {
    this.transition = startTransition(this.pose, to, this.lod.generation + 1)
    this.setFocus(focused)
    this.publish()
  }

  private setFocus(id: SystemBodyId | null) {
    const previous = this.lod.focusedId
    this.lod = focusLod(this.lod, id)
    if (previous && previous !== id) this.applyLod(previous)
    if (id) this.applyLod(id)
  }

  private applyLod(id: SystemBodyId) {
    const visual = this.bodies.get(id)
    if (!visual) return
    const generation = this.lod.generation
    setBodyLod(
      visual,
      lodForBody(id, this.lod),
      this.options.textures,
      this.loader,
      () => !this.destroyed && this.lod.focusedId === id && this.lod.generation === generation
    )
  }

  private applyGestures(gestures: SystemMapGesture[]) {
    for (const gesture of gestures) {
      if (this.preview) {
        if (gesture.type === 'orbit' || gesture.type === 'pan') this.preview.orbit(gesture.dx, gesture.dy)
        if (gesture.type === 'zoom') this.preview.zoom(gesture.deltaY)
        continue
      }
      if (gesture.type === 'orbit') {
        this.transition = undefined
        this.pose = applyOrbitDrag(this.pose, gesture.dx, gesture.dy)
      } else if (gesture.type === 'pan') {
        this.transition = undefined
        this.trackFocusedBody = false
        this.pose = applyPan(this.pose, gesture.dx, gesture.dy, this.height)
      } else if (gesture.type === 'zoom') {
        this.transition = undefined
        this.pose = this.zoomPose(gesture.deltaY)
      } else if (gesture.type === 'tap') this.select(this.pick(gesture.x, gesture.y))
      else this.focusFromTap(gesture.x, gesture.y)
    }
    this.applyPose()
    this.publish()
  }

  private focusFromTap(x: number, y: number) {
    // Planets keep moving between the two clicks. Reuse the body selected by
    // the first click when the second click lands just outside its hit radius.
    const id = this.pick(x, y) ?? this.selectedId
    if (id) this.focus(id)
  }

  private zoomPose(deltaY: number) {
    const zoomed = applyZoom(this.pose, deltaY)
    if (this.lod.focusedId) return zoomed
    const overviewDistance = overviewPose({ width: this.width, height: this.height }).distance
    return { ...zoomed, distance: Math.min(zoomed.distance, overviewDistance * 1.35) }
  }

  private pick(x: number, y: number) {
    const minRadius = 14
    return pickProjectedBody(x, y, this.projectCurrentBodies(), minRadius)
  }

  private applyPose() {
    if (!this.world) return
    if (this.preview) { this.sky?.position.copy(this.world.camera.position); return }
    const eye = cameraEye(this.pose)
    const up = cameraUp(this.pose)
    this.world.camera.position.set(eye.x, eye.y, eye.z)
    this.sky?.position.copy(this.world.camera.position)
    this.world.camera.up.set(up.x, up.y, up.z)
    this.world.camera.lookAt(this.pose.target.x, this.pose.target.y, this.pose.target.z)
  }

  private readonly tick = (time: number) => {
    if (this.destroyed || !this.world) return
    const dt = this.lastTime ? Math.min(0.05, (time - this.lastTime) / 1000) : 0
    this.lastTime = time
    if (!this.simulationPaused) this.simulationTime += dt
    this.updateBodyMotion()
    this.updateTrackedTarget()
    this.preview?.update(dt, SYSTEM_BODIES.map((body) => ({
      id: body.id, center: this.bodies.get(body.id)!.group.position, radius: visualScale(body.id).ringOuter ?? visualScale(body.id).radius
    })))
    if (this.transition) {
      const stepped = stepTransition(this.transition, dt)
      this.pose = stepped.pose
      this.transition = stepped.done ? undefined : stepped.next
    }
    this.applyPose()
    this.world.renderer.render(this.world.scene, this.world.camera)
    this.preview?.render()
    if (time - this.lastPublish > 120) this.publish(time)
  }

  private publish(time = 0) {
    this.lastPublish = time
    this.options.onSnapshot(this.snapshot())
  }

  private projectCurrentBodies() {
    const viewport = { width: this.width, height: this.height }
    return SYSTEM_BODIES.map((body) => {
      const position = this.bodies.get(body.id)?.group.position
      const projected = projectPoint(
        position ? { x: position.x, y: position.y, z: position.z } : { x: 0, y: 0, z: 0 },
        this.pose,
        viewport,
        visualScale(body.id).radius
      )
      return { ...projected, id: body.id }
    })
  }

  private updateBodyMotion() {
    const positions = bodyPositionsAt(this.simulationTime)
    for (const body of SYSTEM_BODIES) {
      const position = positions.get(body.id)
      const visual = this.bodies.get(body.id)
      if (position && visual) {
        visual.group.position.set(position.x, position.y, position.z)
        visual.mesh.rotation.y = bodySpinAt(body.id, this.simulationTime)
      }
      const orbit = this.orbits.get(body.id)
      const parentId = body.parentId
      const parent = parentId ? positions.get(parentId) : undefined
      if (orbit && parent) orbit.position.set(parent.x, parent.y, parent.z)
    }
  }

  private updateTrackedTarget() {
    if (!this.trackFocusedBody || !this.lod.focusedId) return
    const position = this.bodies.get(this.lod.focusedId)?.group.position
    if (!position) return
    const target = { x: position.x, y: position.y, z: position.z }
    if (this.transition) this.transition.to.target = target
    else this.pose = { ...this.pose, target }
  }

  private readonly onContextLost = (event: Event) => {
    event.preventDefault()
    this.stop()
    this.options.onFail?.('context-lost')
  }
}
