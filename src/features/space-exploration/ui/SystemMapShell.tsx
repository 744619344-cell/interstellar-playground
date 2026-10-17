import { useEffect, useState } from 'react'
import { getSystemBody, type SystemBodyId } from '../domain/registry'
import SystemMapHud from './SystemMapHud'
import ShipFlightPanel from './ShipFlightPanel'
import SystemMapShipLabel from './SystemMapShipLabel'
import SystemMapMusicPanel from './SystemMapMusicPanel'
import SystemMapExplorePanel from './SystemMapExplorePanel'
import { useSystemMapRuntime } from './useSystemMapRuntime'
import { useSystemMapMusic } from './useSystemMapMusic'
import './SystemMap.css'
import './SystemMapExplore.css'

export default function SystemMapShell() {
  const runtime = useSystemMapRuntime()
  const music = useSystemMapMusic()
  const [helpOpen, setHelpOpen] = useState(false)
  const [musicOpen, setMusicOpen] = useState(false)
  const selected = runtime.snapshot.selectedId
  const enterCockpit = () => {
    runtime.shipAction('enter')
    runtime.shipAction('cockpit')
  }
  const startMoonRoute = () => {
    enterCockpit()
    runtime.shipAction('route:moon')
  }

  useEffect(() => {
    runtime.setOverlayPaused(helpOpen || musicOpen)
  }, [helpOpen, musicOpen])

  return (
    <div className={`system-map-page${runtime.snapshot.mode === 'focus' ? ' is-focus' : ''}${runtime.snapshot.shipFlight ? ' is-ship-flight' : ''}`}>
      <div className='system-map-stage' ref={runtime.stageRef}>
        <canvas
          ref={runtime.canvasRef}
          className='system-map-canvas'
          tabIndex={0}
          aria-label='太阳系画布'
          onBlur={runtime.clearInput}
          onPointerDown={(event) => {
            event.currentTarget.focus({ preventScroll: true })
            event.currentTarget.setPointerCapture?.(event.pointerId)
            const point = runtime.localPoint(event)
            if (event.button !== 0) return
            runtime.pointerDown(point.x, point.y, event.pointerId, event.ctrlKey)
          }}
          onPointerMove={(event) => {
            const point = runtime.localPoint(event)
            runtime.pointerMove(point.x, point.y, event.pointerId, event.ctrlKey)
          }}
          onPointerUp={(event) => {
            const point = runtime.localPoint(event)
            runtime.pointerUp(point.x, point.y, event.pointerId, event.ctrlKey)
          }}
          onPointerCancel={(event) => runtime.pointerUp(0, 0, event.pointerId)}
          onWheel={(event) => {
            event.preventDefault()
            runtime.wheel(event.deltaY)
          }}
        />
        {runtime.snapshot.mode === 'overview' && runtime.snapshot.labels.map((label) => (
          <span
            key={label.id}
            className={`system-map-label${selected === label.id ? ' is-selected' : ''}`}
            style={{ left: `${label.x}px`, top: `${label.y}px` }}
          >{getSystemBody(label.id as SystemBodyId).displayName}</span>
        ))}
        {!runtime.snapshot.shipFlight && <SystemMapShipLabel ship={runtime.snapshot.ship}
          onEnter={() => { runtime.shipAction('enter'); runtime.shipAction('follow') }}
          onRetry={() => runtime.shipAction('retryModel')} />}
      </div>
      {runtime.snapshot.mode === 'overview' && !runtime.snapshot.shipFlight && <SystemMapExplorePanel ship={runtime.snapshot.ship} onEnterCockpit={enterCockpit} />}
      <ShipFlightPanel state={runtime.snapshot.shipFlight} onAction={runtime.shipAction} />
      <SystemMapHud
        snapshot={runtime.snapshot}
        paused={runtime.paused}
        onPause={runtime.togglePaused}
        onOverview={runtime.overview}
        onShip={enterCockpit}
        onMoonRoute={startMoonRoute}
        onZoom={runtime.zoomBy}
        helpOpen={helpOpen}
        onHelp={() => setHelpOpen((open) => !open)}
        musicPlaying={music.state.playing}
        onMusic={() => setMusicOpen((open) => !open)}
      />
      {musicOpen && (
        <SystemMapMusicPanel
          state={music.state}
          onSelect={(file) => { void music.selectFile(file) }}
          onToggle={music.toggle}
          onVolume={music.setVolume}
          onClose={() => setMusicOpen(false)}
        />
      )}
      {runtime.failed && (
        <div className='system-map-fail'>
          <p>无法启动太阳系地图，请开启硬件加速后刷新页面重试。</p>
        </div>
      )}
    </div>
  )
}
