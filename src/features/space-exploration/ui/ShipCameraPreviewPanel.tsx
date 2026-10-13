import type { SystemMapSnapshot } from '../rendering/solar-system/systemMapEngine'
import { useState } from 'react'
import type { ShipPreviewAction } from '../rendering/spacecraft/shipCameraPreview'
import ShipNavigationPanel from './ShipNavigationPanel'
import ShipInteractionPanel from './ShipInteractionPanel'
import './ShipCameraPreview.css'

interface Props {
  state: SystemMapSnapshot['cameraPreview']
  onAction: (action: ShipPreviewAction) => void
}
export default function ShipCameraPreviewPanel({ state, onAction }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const highMode = import.meta.env.DEV && new URLSearchParams(window.location.search).has('hunyuanPreview')
  if (!state) return <button type='button' className='ship-camera-launch' onClick={() => onAction('enter')}>相机试验</button>
  return <>
    {state.mode !== 'cabin' && !collapsed && <ShipNavigationPanel state={state.navigation} onAction={onAction} />}
    {state.model.status !== 'ready' && !state.model.suspended && state.mode === 'cockpit' && !state.transitioning && <div className='ship-cockpit' aria-label='驾驶舱占位'>
      <div className='ship-cockpit-reticle'>＋</div>
      <div className='ship-cockpit-console'>
        <span>驾驶舱占位 · 座椅视点</span>
        <strong>{state.speed.toFixed(2)} <small>m/s</small></strong>
        <span>前向 −Z · C 切换视角</span>
      </div>
    </div>}
    <section className={`ship-camera-panel${collapsed ? ' is-collapsed' : ''}`} aria-label='相机试验'>
    <div className='ship-camera-heading'><strong>{state.mode === 'cabin' ? '舱内漫游' : '飞船驾驶'}</strong>
      <button type='button' className='ship-camera-button' aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? '展开操作' : '收起面板'}</button>
    </div>
    <div hidden={collapsed}>
    <output aria-label='飞船模型'>{state.model.suspended ? '飞船已暂停，模型资源已释放' : state.model.status === 'ready' ? '飞船已就绪' : state.model.status === 'loading' ? '飞船加载中…' : '飞船加载失败，暂用方向标记；返回全景后可重试'}</output>
    {import.meta.env.DEV && <details>
      <summary>开发预览</summary>
      <a href='/assets-source/blender/spacecraft/redesign/hunyuan-adaptation/high-poly-preview.html' target='_blank' rel='noreferrer'>混元原面数驾驶舱拼装预览</a>
      {!highMode && <a href='/?hunyuanPreview=1' target='_blank' rel='noreferrer'>在飞行画布试用高模</a>}
    </details>}
    {highMode && <output aria-label='高模预览状态'>混元高模：{state.model.highPoly?.status === 'ready' ? '八件已就绪' : state.model.highPoly?.status === 'failed' ? '加载失败，已恢复原驾驶舱' : state.model.highPoly?.status === 'suspended' ? '页面隐藏，资源已释放' : `${state.model.highPoly?.loaded ?? 0}/8 加载中`}</output>}
    <p>{state.mode === 'cabin' ? '点击画布：W/S 前后漫游，A/D 左右移动，方向键也可使用。松键即停；墙板、家具和关闭的内门会挡住移动。' : '点击画布驾驶：W/S 前进或后退，A/D 左右平移；松键自动减速，空格制动。要在飞船内部移动，请选择“舱内漫游”。'}</p>
    <p>左键拖拽转动视线；舱内滚轮拉近或拉远，Ctrl＋拖拽平移观察位置。C 切换视角，F 执行当前交互。</p>
    <div className='ship-camera-buttons'>
      <button type='button' className='ship-camera-button' aria-pressed={state.mode === 'follow'} onClick={() => onAction('follow')}>跟随视角</button>
      <button type='button' className='ship-camera-button' aria-pressed={state.mode === 'cockpit'} onClick={() => onAction('cockpit')}>驾驶舱</button>
      <button type='button' className='ship-camera-button' aria-pressed={state.mode === 'cabin'} onClick={() => onAction('cabin')}>舱内漫游</button>
      <button type='button' className='ship-camera-button' aria-pressed={state.mode === 'free'} onClick={() => onAction('free')}>自由观察</button>
      <button type='button' className='ship-camera-button' aria-pressed={state.obstacle} onClick={() => onAction('obstacle')}>避障试验</button>
      <button type='button' className='ship-camera-button' onClick={() => onAction('reset')}>复位试验</button>
    </div>
    {(state.mode === 'cockpit' || state.mode === 'cabin') && <div className='ship-camera-buttons' aria-label='舱内观察操作'>
      <button type='button' className='ship-camera-button' onClick={() => onAction('zoomIn')}>拉近</button>
      <button type='button' className='ship-camera-button' onClick={() => onAction('zoomOut')}>拉远</button>
      {state.mode === 'cabin' && <>
        <button type='button' className='ship-camera-button' onClick={() => onAction('cabinForward')}>向前移动</button>
        <button type='button' className='ship-camera-button' onClick={() => onAction('cabinBack')}>向后移动</button>
        <button type='button' className='ship-camera-button' onClick={() => onAction('cabinLeft')}>向左移动</button>
        <button type='button' className='ship-camera-button' onClick={() => onAction('cabinRight')}>向右移动</button>
      </>}
    </div>}
    <ShipInteractionPanel state={state.interaction} model={state.model} onAction={onAction} />
    <output aria-label='视角状态'>{state.transitioning ? '视角过渡中' : state.mode === 'cockpit' ? '驾驶舱 · 座椅观察' : state.mode === 'cabin' ? '舱内漫游' : state.mode === 'free' ? '自由观察' : '跟随视角'}</output>
    {(state.mode === 'cockpit' || state.mode === 'cabin') && <output aria-label='舱内观察位置'>视场 {state.interiorFov.toFixed(0)}° · 舱内 {Object.values(state.cabinPosition).map(n => n.toFixed(2)).join(' / ')}{state.cabinBlocked && ' · 已到结构边界'}</output>}
    <output aria-label='相机状态'>速度 {state.speed.toFixed(2)} m/s · 镜头 {state.distance.toFixed(2)} m · {state.blocked ? '视点受阻，请复位' : state.occluded ? '避障收近' : '视线通畅'}</output>
    <output aria-label='飞行位置'>位置 {Object.values(state.flightPosition).map((n) => n.toFixed(2)).join(' / ')}</output>
    <div className='ship-feedback-row' aria-label='飞船反馈'>
      <output aria-label='推进反馈'>{state.feedback.thrustLabel}</output>
      <output aria-label='姿态反馈'>{state.feedback.attitudeLabel}</output>
    </div>
    <output aria-label='飞行姿态'>姿态 {Object.values(state.orientation).map((n) => n.toFixed(3)).join(' / ')}</output>
    <output aria-label='渲染资源'>纹理 {state.resources.textures} · 几何 {state.resources.geometries} · 程序 {state.resources.programs}</output>
    {import.meta.env.DEV && <output aria-label='渲染帧率'>
      {state.frames.samples < 30 ? '帧率采样中…' : `最近 ${state.frames.samples} 帧 · 平均 ${state.frames.fps.toFixed(1)} FPS · 1% low ${state.frames.lowFps.toFixed(1)} FPS`}
      {!state.windowFocused && ' · 浏览器失焦'}
    </output>}
    {import.meta.env.DEV && state.graphicsBackend && <output aria-label='图形后端'>{state.graphicsBackend}</output>}
    </div>
  </section></>
}
