import type { SystemMapSnapshot } from '../rendering/solar-system/systemMapEngine'
import { useState } from 'react'
import type { ShipFlightAction } from '../rendering/spacecraft/shipFlightRuntime'
import ShipNavigationPanel from './ShipNavigationPanel'
import ShipInteractionPanel from './ShipInteractionPanel'
import './ShipFlight.css'
import { shipLoadingLabel } from '../rendering/spacecraft/shipLoadProgress'
import CabinContextPrompt from './CabinContextPrompt'
import CabinDevicePanel from './CabinDevicePanel'
import CabinEvaPanel from './CabinEvaPanel'
import CabinMotionStudyPanel from './CabinMotionStudyPanel'
import CabinFeatureGuide from './CabinFeatureGuide'
import { isMicrogravityCabin } from '../rendering/spacecraft/microgravityCabinRuntime'
import CabinGameHud from './CabinGameHud'
import type { CabinHudChrome } from './CabinGameMenu'
import './CabinGameHud.css'

interface Props {
  state: SystemMapSnapshot['shipFlight']
  onAction: (action: ShipFlightAction) => void
  chrome: CabinHudChrome
}
export default function ShipFlightPanel({ state, onAction, chrome }: Props) {
  const [collapsed, setCollapsed] = useState(true)
  if (!state) return null
  const crew=state.model.cabin
  if (isMicrogravityCabin(crew) && ['cabin', 'cockpit'].includes(state.mode)) return chrome.overlayOpen ? null : <CabinGameHud state={state} onAction={onAction} chrome={chrome}/>
  const floating=!!crew&&'microgravity' in crew
  const diagnostics=import.meta.env.DEV || (typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('cabinDiagnostics')==='1')
  return <>
    {crew&&<CabinContextPrompt state={state} onAction={onAction}/>}
    {crew&&<CabinDevicePanel state={state} onAction={onAction}/>}
    {isMicrogravityCabin(crew)&&state.mode==='cabin'&&!state.suspended&&<CabinMotionStudyPanel study={crew.equipment.study} paused={state.paused} onAction={onAction}/>}
    {crew&&<CabinEvaPanel state={state} onAction={onAction}/>}
    {state.mode !== 'cabin' && !collapsed && <ShipNavigationPanel state={state.navigation} onAction={onAction} />}
    <section className={`ship-camera-panel${collapsed ? ' is-collapsed' : ''}`} aria-label='飞船驾驶'>
    <div className='ship-camera-heading'><strong>{state.mode === 'cabin' ? '舱内行动' : '飞船驾驶'}</strong>
      <button type='button' className='ship-camera-button' aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? '展开操作' : '收起面板'}</button>
    </div>
    <div className='ship-camera-buttons' aria-label='飞船视角' hidden={collapsed&&state.mode==='cabin'&&!!crew}>
      <button type='button' className='ship-camera-button' aria-pressed={state.mode === 'follow'} onClick={() => onAction('follow')}>飞船外观</button>
      <button type='button' className='ship-camera-button' disabled={state.model.status !== 'ready'} aria-pressed={state.mode === 'cockpit'} onClick={() => onAction('cockpit')}>驾驶舱</button>
      <button type='button' className='ship-camera-button' disabled={state.model.status !== 'ready'} aria-pressed={state.mode === 'cabin'} onClick={() => onAction('cabin')}>{crew?'舱内行动':'舱内漫游'}</button>
      <button type='button' className='ship-camera-button' aria-pressed={state.mode === 'free'} onClick={() => onAction('free')}>自由观察</button>
    </div>
    <output aria-label='飞船模型'>{state.model.suspended ? '飞船已暂停，模型资源已释放' : state.model.status === 'ready' ? '飞船已就绪 · 当前模型待后续完善' : state.model.status === 'loading' ? shipLoadingLabel(state.model.loadProgress, state.model.previewReady) : state.model.loadError ?? '飞船加载失败，请重试'}</output>
    {collapsed&&crew&&<output aria-label='舱内动作提示'>舱门{crew.doorLabel} · {crew.action}</output>}
    {floating&&state.mode==='cabin'&&<CabinFeatureGuide/>}
    {state.model.status === 'failed' && <button type='button' className='ship-camera-button' onClick={() => onAction('retryModel')}>重新加载飞船</button>}
    <div hidden={collapsed}>
    <p>{floating ? '默认端游辅助：WASD/方向键按视线移动，人物平滑跟随视线转身；Space上浮、C下潜，Shift加速，B制动，松键缓停。Q/E也可单独转身。右键拖拽环视，左键环视保留。M切换真实惯性：扶稳后方向键推离，或WASD选向后Space推离；松键保留惯性，Shift+方向键调姿。漂移实验自动切换真实惯性并锁定辅助。' : state.mode === 'cabin' ? '点击画布：W/S 前后走，A/D 左右走，方向键也可使用。墙板、家具和关闭的门会挡住移动。' : '点击画布驾驶：W/S 前进或后退，A/D 左右平移；松键自动减速，空格制动。进入“舱内行动”可控制宇航员。'}</p>
    <p>{state.mode === 'follow' || state.mode === 'cockpit' ? '左键拖拽控制船头转向；绕船查看请选“自由观察”。' : '左键拖拽环视，普通漂浮时可水平转满一圈，遇船壳镜头会自动拉近。'}滚轮调整远近。{floating ? 'V 挥手，G/H 手部动作；靠近设备 F 操作，Esc 取消。' : crew ? 'C 切换视角。靠近设备显示 F：床铺躺下/起身，座椅坐下/起立，舱门开关，柜体、工作台和主控台查看。Q 挥手，G/H 手部动作，Esc 退出或取消。' : 'C 切换视角，F 执行当前交互。'}</p>
    <div className='ship-camera-buttons'>
      <button type='button' className='ship-camera-button' onClick={() => onAction('reset')}>返回地球泊位</button>
    </div>
    {(state.mode === 'cockpit' || state.mode === 'cabin') && <div className='ship-camera-buttons' aria-label='舱内观察操作'>
      <button type='button' className='ship-camera-button' onClick={() => onAction('zoomIn')}>拉近</button>
      <button type='button' className='ship-camera-button' onClick={() => onAction('zoomOut')}>拉远</button>
      {state.mode === 'cabin' && <>
        {crew && <button type='button' className='ship-camera-button' onClick={() => onAction('lookAft')}>面向后舱门</button>}
        <button type='button' className='ship-camera-button' onClick={() => onAction('cabinForward')}>向前移动</button>
        <button type='button' className='ship-camera-button' onClick={() => onAction('cabinBack')}>向后移动</button>
        <button type='button' className='ship-camera-button' onClick={() => onAction('cabinLeft')}>向左移动</button>
        <button type='button' className='ship-camera-button' onClick={() => onAction('cabinRight')}>向右移动</button>
      </>}
    </div>}
    {state.mode==='cabin'&&crew&&<div className='ship-camera-buttons' aria-label='宇航员手部动作'>
      <button type='button' className='ship-camera-button' onClick={()=>onAction('wave')}>挥手 {floating?'V':'Q'}</button>
      <button type='button' className='ship-camera-button' onClick={()=>onAction('curl')}>屈指 G</button>
      <button type='button' className='ship-camera-button' onClick={()=>onAction('relax')}>张手 H</button>
      <output aria-label='宇航员动作'>{crew.action}</output>
    </div>}
    <ShipInteractionPanel state={state.interaction} model={state.model} onAction={onAction} />
    <output aria-label='视角状态'>{state.transitioning ? '视角过渡中' : state.mode === 'cockpit' ? '驾驶舱 · 座椅观察' : state.mode === 'cabin' ? '舱内行动' : state.mode === 'free' ? '自由观察' : '跟随视角'}</output>
    {(state.mode === 'cockpit' || state.mode === 'cabin') && <output aria-label='舱内视野'>视场 {state.interiorFov.toFixed(0)}°{state.cabinBlocked && ' · 已到结构边界'}</output>}
    <output aria-label='飞行状态'>速度 {state.speed.toFixed(2)} m/s · {state.parked ? '地球泊位' : '太阳系航行'}{state.blocked && ' · 视点受阻，请切换视角'}</output>
    <div className='ship-feedback-row' aria-label='飞船反馈'>
      <output aria-label='推进反馈'>{state.feedback.thrustLabel}</output>
      <output aria-label='姿态反馈'>{state.feedback.attitudeLabel}</output>
    </div>
    {diagnostics && <details><summary>运行诊断</summary>
    {crew&&<><output aria-label='宇航员位置'>位置 {Object.values(crew.position).map(n=>n.toFixed(3)).join(' / ')} · 脚底 {crew.minimumSoleY.toFixed(3)}</output>
    {isMicrogravityCabin(crew)&&<pre aria-label='舱内运动诊断' style={{whiteSpace:'pre-wrap',fontSize:10}}>{JSON.stringify({controlMode:crew.controlMode,float:crew.float,blocked:crew.blocked,posture:crew.posture,view:{yaw:state.yaw,pitch:state.pitch,position:state.position,target:state.target}},null,2)}</pre>}
    <output aria-label='舱门动作'>门行程 {crew.door.progress.toFixed(3)} · 目标 {crew.door.target} · {crew.door.blocked?'避让中':'无阻挡'}</output></>}
    <output aria-label='飞行位置'>位置 {Object.values(state.flightPosition).map((n) => n.toFixed(2)).join(' / ')}</output>
    <output aria-label='飞行姿态'>姿态 {Object.values(state.orientation).map((n) => n.toFixed(3)).join(' / ')}</output>
    <output aria-label='渲染资源'>纹理 {state.resources.textures} · 几何 {state.resources.geometries} · 程序 {state.resources.programs}</output>
    {state.model.surface&&<pre aria-label='表面材质诊断' style={{whiteSpace:'pre-wrap',fontSize:10}}>{JSON.stringify(state.model.surface,null,2)}</pre>}
    <output aria-label='渲染帧率'>
      {state.frames.samples < 30 ? '帧率采样中…' : `最近 ${state.frames.samples} 帧 · 平均 ${state.frames.fps.toFixed(1)} FPS · 1% low ${state.frames.lowFps.toFixed(1)} FPS`}
      {!state.windowFocused && ' · 浏览器失焦'}
    </output>
    {state.graphicsBackend && <output aria-label='图形后端'>{state.graphicsBackend}</output>}
    </details>}
    </div>
  </section></>
}
