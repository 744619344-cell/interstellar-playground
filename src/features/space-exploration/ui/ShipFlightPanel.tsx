import type { SystemMapSnapshot } from '../rendering/solar-system/systemMapEngine'
import { useState } from 'react'
import type { ShipFlightAction } from '../rendering/spacecraft/shipFlightRuntime'
import ShipNavigationPanel from './ShipNavigationPanel'
import ShipInteractionPanel from './ShipInteractionPanel'
import './ShipFlight.css'

interface Props {
  state: SystemMapSnapshot['shipFlight']
  onAction: (action: ShipFlightAction) => void
}
export default function ShipFlightPanel({ state, onAction }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  if (!state) return null
  return <>
    {state.mode !== 'cabin' && !collapsed && <ShipNavigationPanel state={state.navigation} onAction={onAction} />}
    <section className={`ship-camera-panel${collapsed ? ' is-collapsed' : ''}`} aria-label='飞船驾驶'>
    <div className='ship-camera-heading'><strong>{state.mode === 'cabin' ? '舱内漫游' : '飞船驾驶'}</strong>
      <button type='button' className='ship-camera-button' aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? '展开操作' : '收起面板'}</button>
    </div>
    <div hidden={collapsed}>
    <output aria-label='飞船模型'>{state.model.suspended ? '飞船已暂停，模型资源已释放' : state.model.status === 'ready' ? '飞船已就绪 · 当前模型待后续完善' : state.model.status === 'loading' ? '飞船加载中…' : '飞船加载失败，请重试'}</output>
    {state.model.status === 'failed' && <button type='button' className='ship-camera-button' onClick={() => onAction('retryModel')}>重新加载飞船</button>}
    <p>{state.mode === 'cabin' ? '点击画布：W/S 前后漫游，A/D 左右移动，方向键也可使用。松键即停；墙板、家具和关闭的内门会挡住移动。' : '点击画布驾驶：W/S 前进或后退，A/D 左右平移；松键自动减速，空格制动。要在飞船内部移动，请选择“舱内漫游”。'}</p>
    <p>左键拖拽转动视线；舱内滚轮拉近或拉远，Ctrl＋拖拽平移观察位置。C 切换视角，F 执行当前交互。</p>
    <div className='ship-camera-buttons'>
      <button type='button' className='ship-camera-button' aria-pressed={state.mode === 'follow'} onClick={() => onAction('follow')}>跟随视角</button>
      <button type='button' className='ship-camera-button' aria-pressed={state.mode === 'cockpit'} onClick={() => onAction('cockpit')}>驾驶舱</button>
      <button type='button' className='ship-camera-button' aria-pressed={state.mode === 'cabin'} onClick={() => onAction('cabin')}>舱内漫游</button>
      <button type='button' className='ship-camera-button' aria-pressed={state.mode === 'free'} onClick={() => onAction('free')}>自由观察</button>
      <button type='button' className='ship-camera-button' onClick={() => onAction('reset')}>返回地球泊位</button>
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
    {(state.mode === 'cockpit' || state.mode === 'cabin') && <output aria-label='舱内视野'>视场 {state.interiorFov.toFixed(0)}°{state.cabinBlocked && ' · 已到结构边界'}</output>}
    <output aria-label='飞行状态'>速度 {state.speed.toFixed(2)} m/s · {state.parked ? '地球泊位' : '太阳系航行'}{state.blocked && ' · 视点受阻，请切换视角'}</output>
    <div className='ship-feedback-row' aria-label='飞船反馈'>
      <output aria-label='推进反馈'>{state.feedback.thrustLabel}</output>
      <output aria-label='姿态反馈'>{state.feedback.attitudeLabel}</output>
    </div>
    {import.meta.env.DEV && <details><summary>运行诊断</summary>
    <output aria-label='飞行位置'>位置 {Object.values(state.flightPosition).map((n) => n.toFixed(2)).join(' / ')}</output>
    <output aria-label='飞行姿态'>姿态 {Object.values(state.orientation).map((n) => n.toFixed(3)).join(' / ')}</output>
    <output aria-label='渲染资源'>纹理 {state.resources.textures} · 几何 {state.resources.geometries} · 程序 {state.resources.programs}</output>
    <output aria-label='渲染帧率'>
      {state.frames.samples < 30 ? '帧率采样中…' : `最近 ${state.frames.samples} 帧 · 平均 ${state.frames.fps.toFixed(1)} FPS · 1% low ${state.frames.lowFps.toFixed(1)} FPS`}
      {!state.windowFocused && ' · 浏览器失焦'}
    </output>
    {state.graphicsBackend && <output aria-label='图形后端'>{state.graphicsBackend}</output>}
    </details>}
    </div>
  </section></>
}
