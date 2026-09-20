import type { SystemMapSnapshot } from '../rendering/solar-system/systemMapEngine'
import type { ShipPreviewAction } from '../rendering/spacecraft/shipCameraPreview'
import ShipNavigationPanel from './ShipNavigationPanel'
import './ShipCameraPreview.css'

interface Props {
  state: SystemMapSnapshot['cameraPreview']
  onAction: (action: ShipPreviewAction) => void
}
export default function ShipCameraPreviewPanel({ state, onAction }: Props) {
  if (!state) return <button type='button' className='ship-camera-launch' onClick={() => onAction('enter')}>相机试验</button>
  return <>
    <ShipNavigationPanel state={state.navigation} onAction={onAction} />
    {state.model.status !== 'ready' && state.mode === 'cockpit' && !state.transitioning && <div className='ship-cockpit' aria-label='驾驶舱占位'>
      <div className='ship-cockpit-reticle'>＋</div>
      <div className='ship-cockpit-console'>
        <span>驾驶舱占位 · 座椅视点</span>
        <strong>{state.speed.toFixed(2)} <small>m/s</small></strong>
        <span>前向 −Z · C 切换视角</span>
      </div>
    </div>}
    <section className='ship-camera-panel' aria-label='相机试验'>
    <strong>飞船驾驶</strong>
    <output aria-label='飞船模型'>{state.model.status === 'ready' ? '飞船已就绪' : state.model.status === 'loading' ? '飞船加载中…' : '飞船加载失败，暂用方向标记；返回全景后可重试'}</output>
    <p>点击画布驾驶：W/S 沿当前视线前进或后退，A/D 向左或向右平移；方向键也可移动。松开移动键自动减速停止，空格立即制动。</p>
    <p>按住鼠标左键拖拽可在当前视角转动视线，移动方向会同步跟随视线；滚轮调整观察距离，C 切换视角，“返回全景”退出。</p>
    <div className='ship-camera-buttons'>
      <button type='button' className='ship-camera-button' aria-pressed={state.mode === 'follow'} onClick={() => onAction('follow')}>跟随视角</button>
      <button type='button' className='ship-camera-button' aria-pressed={state.mode === 'cockpit'} onClick={() => onAction('cockpit')}>驾驶舱</button>
      <button type='button' className='ship-camera-button' aria-pressed={state.mode === 'free'} onClick={() => onAction('free')}>自由观察</button>
      <button type='button' className='ship-camera-button' aria-pressed={state.obstacle} onClick={() => onAction('obstacle')}>避障试验</button>
      <button type='button' className='ship-camera-button' onClick={() => onAction('reset')}>复位试验</button>
    </div>
    <output aria-label='视角状态'>{state.transitioning ? '视角过渡中' : state.mode === 'cockpit' ? '驾驶舱 · 固定座椅' : state.mode === 'free' ? '自由观察' : '跟随视角'}</output>
    <output aria-label='相机状态'>速度 {state.speed.toFixed(2)} m/s · 镜头 {state.distance.toFixed(2)} m · {state.blocked ? '视点受阻，请复位' : state.occluded ? '避障收近' : '视线通畅'}</output>
    <output aria-label='飞行位置'>位置 {Object.values(state.flightPosition).map((n) => n.toFixed(2)).join(' / ')}</output>
    <div className='ship-feedback-row' aria-label='飞船反馈'>
      <output aria-label='推进反馈'>{state.feedback.thrustLabel}</output>
      <output aria-label='姿态反馈'>{state.feedback.attitudeLabel}</output>
    </div>
    <output aria-label='飞行姿态'>姿态 {Object.values(state.orientation).map((n) => n.toFixed(3)).join(' / ')}</output>
    <output aria-label='渲染资源'>纹理 {state.resources.textures} · 几何 {state.resources.geometries} · 程序 {state.resources.programs}</output>
  </section></>
}
