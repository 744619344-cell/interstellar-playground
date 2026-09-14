import { useEffect, useRef, useState } from 'react'
import { VoyageRunController } from '../application/voyageRunController'
import type { SystemBodyId } from '../domain/registry'
import type { ShipPreviewAction } from '../rendering/spacecraft/shipCameraPreview'
import { SystemMapEngine, type SystemMapSnapshot } from '../rendering/solar-system/systemMapEngine'
import { detectWebRenderQuality, limitWebPixelRatio } from '../../../engines/webRenderQuality'
import { VOYAGE_TEXTURES } from './voyageTextures'
import { ShipEffectsAudio } from '../audio/shipEffectsAudio'

const EMPTY: SystemMapSnapshot = {
  selectedId: null,
  focusedId: null,
  transitioning: false,
  mode: 'overview',
  name: '太阳系',
  kind: '全景',
  visualDistance: 0,
  labels: []
}

export function useSystemMapRuntime() {
  const previewEnabled = true
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<SystemMapEngine>()
  const controllerRef = useRef<VoyageRunController>()
  const effectsAudioRef = useRef<ShipEffectsAudio>()
  const [snapshot, setSnapshot] = useState(EMPTY)
  const [paused, setPaused] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    if (!stage || !canvas) return
    let cancelled = false
    let lastSize = ''
    const effectsAudio = new ShipEffectsAudio()
    effectsAudioRef.current = effectsAudio
    const controller = new VoyageRunController({
      start: () => engineRef.current?.start(),
      stop: () => engineRef.current?.stop(),
      clearInput: () => engineRef.current?.clearInput(),
      setInputEnabled: (enabled) => engineRef.current?.setInputEnabled(enabled)
    })
    controllerRef.current = controller
    const build = () => {
      if (cancelled) return
      const rect = stage.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) return
      const size = `${Math.round(rect.width)}x${Math.round(rect.height)}`
      const pixelRatio = limitWebPixelRatio(1.6, detectWebRenderQuality())
      if (engineRef.current) {
        if (size !== lastSize) engineRef.current.resize(rect.width, rect.height, pixelRatio)
        lastSize = size
        return
      }
      try {
        engineRef.current = new SystemMapEngine({
          canvas,
          width: rect.width,
          height: rect.height,
          pixelRatio,
          textures: VOYAGE_TEXTURES,
          onSnapshot: setSnapshot,
          onFail: setFailed,
          cameraPreview: previewEnabled
        })
        lastSize = size
        setFailed(null)
        controller.mount(document.hidden)
      } catch {
        setFailed('webgl')
      }
    }
    build()
    const observer = new ResizeObserver(build)
    observer.observe(stage)
    let blurred = false
    const onVisibility = () => {
      const hidden = document.hidden || blurred
      controller.setHidden(hidden)
      effectsAudio.setSuspended(hidden)
    }
    const onBlur = () => { controller.clearInput(); if (previewEnabled) { blurred = true; onVisibility() } }
    const onFocus = () => { blurred = false; onVisibility() }
    const onKey = (event: KeyboardEvent) => {
      if (event.type === 'keydown' && (event.repeat || document.activeElement !== canvas || event.ctrlKey || event.metaKey || event.altKey)) return
      if (engineRef.current?.previewKey(event.code, event.type === 'keydown')) event.preventDefault()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    return () => {
      cancelled = true
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      controller.destroy()
      effectsAudio.destroy()
      if (effectsAudioRef.current === effectsAudio) effectsAudioRef.current = undefined
      engineRef.current?.destroy()
      engineRef.current = undefined
    }
  }, [])

  useEffect(() => {
    const preview = snapshot.cameraPreview
    effectsAudioRef.current?.setFeedback(preview?.feedback, !!preview && !paused && !preview.suspended)
  }, [paused, snapshot.cameraPreview?.feedback.audioLevel, snapshot.cameraPreview?.suspended])

  return {
    stageRef,
    canvasRef,
    snapshot,
    paused,
    failed,
    previewEnabled,
    clearInput: () => engineRef.current?.clearInput(),
    previewAction: (action: ShipPreviewAction) => {
      void effectsAudioRef.current?.unlock()
      engineRef.current?.previewAction(action)
      canvasRef.current?.focus({ preventScroll: true })
    },
    localPoint: (event: { clientX: number, clientY: number, currentTarget: HTMLCanvasElement }) => {
      const rect = event.currentTarget.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    },
    pointerDown: (x: number, y: number, id: number, pan = false) => engineRef.current?.handlePointerDown(x, y, id, pan),
    pointerMove: (x: number, y: number, id: number, pan = false) => engineRef.current?.handlePointerMove(x, y, id, pan),
    pointerUp: (x: number, y: number, id: number, pan = false) => engineRef.current?.handlePointerUp(x, y, id, pan),
    wheel: (deltaY: number) => engineRef.current?.handleWheel(deltaY),
    focus: (id: SystemBodyId) => engineRef.current?.focus(id),
    overview: () => engineRef.current?.overview(),
    zoomBy: (delta: number) => engineRef.current?.zoomBy(delta),
    togglePaused: () => {
      const value = !paused
      if (!value && snapshot.cameraPreview) void effectsAudioRef.current?.unlock()
      effectsAudioRef.current?.setFeedback(undefined, false)
      engineRef.current?.setSimulationPaused(value)
      setPaused(value)
      return value
    },
    setOverlayPaused: (value: boolean) => {
      if (value) effectsAudioRef.current?.setFeedback(undefined, false)
      controllerRef.current?.setOverlayPaused(value)
    }
  }
}
