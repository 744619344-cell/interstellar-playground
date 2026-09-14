import type { SystemMapSnapshot } from '../rendering/solar-system/systemMapEngine'
import moonSurface from '../../../assets/textures/moon-surface.jpg'
import SystemMapIcon from './SystemMapIcon'

interface Props {
  snapshot: SystemMapSnapshot
  paused: boolean
  onPause: () => void
  onOverview: () => void
  onZoom: (delta: number) => void
  onHelp: () => void
  helpOpen: boolean
  musicPlaying: boolean
  onMusic: () => void
}

function Toolbar({ paused, onPause, onOverview, onHelp, helpOpen, musicPlaying, onMusic }: Props) {
  return (
    <div className='system-map-top'>
      <div className='system-map-brand'>
        <span className='system-map-eyebrow'>SYSTEM MAP</span>
        <b>太阳系</b>
        <span className='system-map-disclaimer'>视觉比例，非真实等比例</span>
      </div>
      <div className='system-map-actions'>
        <div className='system-map-help-anchor'>
          <button type='button' className={`system-map-action${helpOpen ? ' is-active' : ''}`} onClick={onHelp} aria-expanded={helpOpen} aria-controls='system-map-help'><SystemMapIcon name='help' />说明</button>
          {helpOpen && <div id='system-map-help' className='system-map-help-panel' role='region' aria-label='操作说明'>
            <div className='system-map-help-head'><b>操作说明</b><button className='system-map-help-close' type='button' onClick={onHelp}>关闭</button></div>
            <p>普通拖动环绕，Ctrl + 左键拖动平移画布；滚轮或右侧按钮缩放。单击查看星体，双击直接进入特写，返回全景恢复完整构图。</p>
          </div>}
        </div>
        <button type='button' className={`system-map-action${paused ? ' is-active' : ''}`} onClick={onPause} aria-pressed={paused}>
          <SystemMapIcon name={paused ? 'play' : 'pause'} />{paused ? '继续' : '暂停'}
        </button>
        <button type='button' className={`system-map-action${musicPlaying ? ' is-active' : ''}`} onClick={onMusic}>
          <SystemMapIcon name='music' />{musicPlaying ? '音乐中' : '音乐'}
        </button>
        <button type='button' className='system-map-action' onClick={onOverview}><SystemMapIcon name='map' />返回全景</button>
      </div>
    </div>
  )
}

export default function SystemMapHud(props: Props) {
  const { snapshot, onOverview, onZoom } = props
  const earth = snapshot.labels.find((label) => label.id === 'earth')
  return (
    <div className='system-map-hud'>
      <Toolbar {...props} />
      {snapshot.selectedId && <div className='system-map-selection'>
        <span className='system-map-selection-mark'><SystemMapIcon name='map' /></span>
        <div>
          <span className='system-map-selection-caption'>{snapshot.selectedId ? snapshot.kind : '当前视野'}</span>
          <strong>{snapshot.selectedId ? snapshot.name : '完整太阳系'}</strong>
          <span className='system-map-selection-hint'>{snapshot.selectedId ? `视觉距离 ${Math.round(snapshot.visualDistance)} · ` : ''}{snapshot.mode === 'overview' ? '双击进入特写' : 'Ctrl+拖动平移 · 滚轮缩放'}</span>
        </div>
      </div>}
      {snapshot.mode === 'overview' && earth && (
        <div className='system-map-ship-marker' style={{ left: earth.x + 42, top: earth.y + 58 }} aria-label='我的飞船停泊于地球轨道'>
          <span className='system-map-ship-orbit' />
          <span className='system-map-ship-glyph'><SystemMapIcon name='ship' /></span>
          <span className='system-map-ship-caption'>我的飞船</span>
        </div>
      )}
      <div className='system-map-destination' aria-label='目的地预览'>
        <div className='system-map-destination-orb' style={{ backgroundImage: `url(${moonSurface})` }} />
        <div className='system-map-destination-copy'><span>目的地</span><strong>月球</strong></div>
        <button type='button' className='system-map-destination-button' disabled>设为目标</button>
      </div>
      <nav className='system-map-mode-nav' aria-label='探索模式'>
        <button type='button' className={`system-map-mode-button${snapshot.mode === 'overview' ? ' is-active' : ''}`} onClick={onOverview} aria-label='太阳系全景'><SystemMapIcon name='map' /><span>全景</span></button>
        <button type='button' className='system-map-mode-button' disabled aria-label='飞船功能筹备中'><SystemMapIcon name='ship' /><span>飞船</span></button>
        <button type='button' className='system-map-mode-button' disabled aria-label='宇航员功能筹备中'><SystemMapIcon name='crew' /><span>宇航员</span></button>
      </nav>
      <div className='system-map-zoom'>
        <button type='button' aria-label='放大太阳系' onClick={() => onZoom(-180)}>+</button>
        <button type='button' aria-label='缩小太阳系' onClick={() => onZoom(180)}>−</button>
      </div>
    </div>
  )
}
