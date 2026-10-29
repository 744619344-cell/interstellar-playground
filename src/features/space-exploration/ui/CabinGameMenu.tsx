import type { SystemMapSnapshot } from '../rendering/solar-system/systemMapEngine'
import type { ShipFlightAction } from '../rendering/spacecraft/shipFlightRuntime'
import { isMicrogravityCabin } from '../rendering/spacecraft/microgravityCabinRuntime'
import CabinControlHint from './CabinControlHint'
import CabinFeatureGuide from './CabinFeatureGuide'
import CabinMotionStudyPanel from './CabinMotionStudyPanel'
import CabinDiagnostics from './CabinDiagnostics'

export interface CabinHudChrome {
  clearInput: () => void; focusGame: () => void; onPause: () => void; onMusic: () => void; onOverview: () => void
  overlayOpen: boolean
}
export type CabinMenuPage = 'controls' | 'guide' | 'data' | 'diagnostics'
export default function CabinGameMenu({ state, onAction, chrome, onClose, page, onPage }: {
  state: NonNullable<SystemMapSnapshot['shipFlight']>; onAction: (action: ShipFlightAction) => void; chrome: CabinHudChrome; onClose: () => void
  page: CabinMenuPage; onPage: (page: CabinMenuPage) => void
}) {
  const cabin = state.model.cabin
  if (!isMicrogravityCabin(cabin)) return null
  const diagnostics = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cabinDiagnostics') === '1'
  const choose = (action: ShipFlightAction) => { onClose(); onAction(action) }
  return <aside className='cabin-game-menu' aria-label='舱内菜单'>
    <header><strong>舱内菜单</strong><button type='button' onClick={onClose} aria-label='关闭舱内菜单'>关闭 <kbd>Tab / Esc</kbd></button></header>
    <nav aria-label='菜单页面'>
      <button type='button' aria-pressed={page === 'controls'} onClick={() => onPage('controls')}>操作</button>
      <button type='button' aria-pressed={page === 'guide'} onClick={() => onPage('guide')}>设备手册</button>
      <button type='button' aria-pressed={page === 'data'} onClick={() => onPage('data')}>观测与日志</button>
      {diagnostics && <button type='button' aria-pressed={page === 'diagnostics'} onClick={() => onPage('diagnostics')}>诊断</button>}
    </nav>
    {page === 'controls' && <>
      <CabinControlHint cabin={cabin} paused={state.paused} onAction={onAction}/>
      <p>Q / E 转身 · X 抓握或松手 · V 挥手 · G / H 手指<br/>靠近设备 F 操作，I 检查；F 退出，Esc 取消动作。</p>
      <div className='cabin-menu-actions'>
        <button type='button' onClick={() => choose('follow')}>查看飞船外观</button>
        <button type='button' onClick={() => choose('free')}>自由观察</button>
        <button type='button' onClick={chrome.onPause}>{state.paused ? '继续游戏' : '暂停游戏'}</button>
        <button type='button' onClick={() => { onClose(); chrome.onMusic() }}>音乐设置</button>
        <button type='button' onClick={() => { onClose(); chrome.onOverview() }}>返回太阳系</button>
      </div>
    </>}
    {page === 'guide' && <CabinFeatureGuide expanded/>}
    {page === 'data' && <>
      <CabinMotionStudyPanel study={cabin.equipment.study} paused={state.paused} onAction={onAction} embedded/>
      <h3>船载日志 · {cabin.equipment.log.length}</h3>
      {cabin.equipment.log.length ? <ol>{cabin.equipment.log.slice().reverse().map(entry => <li key={entry.sequence}><strong>{entry.title}</strong><p>{entry.detail}</p></li>)}</ol> : <p>暂无记录。靠近维护工位可登记漂移观测。</p>}
    </>}
    {page === 'diagnostics' && <CabinDiagnostics state={state}/>}
  </aside>
}
