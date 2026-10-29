import { useState } from 'react'
import type { SystemMapSnapshot } from '../rendering/solar-system/systemMapEngine'
import type { ShipFlightAction } from '../rendering/spacecraft/shipFlightRuntime'
import { isMicrogravityCabin } from '../rendering/spacecraft/microgravityCabinRuntime'
import { motionStudyActive } from '../domain/cabinMotionStudy'
import CabinGameMenu, { type CabinHudChrome, type CabinMenuPage } from './CabinGameMenu'
import CabinContextPrompt from './CabinContextPrompt'
import CabinDevicePanel from './CabinDevicePanel'
import { useCabinMenu } from './useCabinMenu'

export default function CabinGameHud({ state, onAction, chrome }: {
  state: NonNullable<SystemMapSnapshot['shipFlight']>; onAction: (action: ShipFlightAction) => void; chrome: CabinHudChrome
}) {
  const menu = useCabinMenu(chrome.clearInput, chrome.focusGame), cabin = state.model.cabin
  const [page, setPage] = useState<CabinMenuPage>('controls')
  if (!isMicrogravityCabin(cabin)) return null
  const study = cabin.equipment.study, active = motionStudyActive(study)
  return <div className='cabin-game-hud'>
    <div className='cabin-game-toolbar'>
      <span>{state.mode === 'cockpit' ? '驾驶座' : cabin.eva.location === 'outside' ? '舱外' : '舱内'} / {cabin.controlMode === 'assisted' ? '辅助漂浮' : '真实惯性'}</span>
      <button type='button' onClick={() => menu.change(!menu.open)} aria-expanded={menu.open}><kbd>Tab</kbd> 菜单</button>
      <button type='button' onClick={() => { chrome.onPause(); chrome.focusGame() }} aria-pressed={state.paused}>{state.paused ? '继续' : '暂停'}</button>
    </div>
    {cabin.eva.suit !== 'stowed' && <output className='cabin-suit-status' aria-label='宇航服状态'>
      {cabin.eva.suit === 'ready' ? '宇航服已穿戴' : '穿脱中'} · {cabin.evaControls.pressure}{cabin.eva.tether ? ` · 系留 ${cabin.tether.deployed.toFixed(1)} m` : ''}
    </output>}
    {!menu.open && <><CabinContextPrompt state={state} onAction={onAction} compact/>
      <CabinDevicePanel state={state} onAction={onAction}/></>}
    <div className='cabin-game-footer'>
      {study && <div className='cabin-task-status' aria-label='观测状态'><span>{active ? `漂移观测 · ${study.phase === 'armed' ? '等待推离' : `${study.seconds.toFixed(1)} s`}` : study.notice}</span>
        {active ? <button type='button' disabled={state.paused} onClick={() => onAction('equipment:micro-work:study-cancel')}>停止</button> : <button type='button' onClick={() => { setPage('data'); menu.change(true) }}>查看数据</button>}</div>}
      <small>WASD 移动 · 右键环视 · Tab 菜单</small>
    </div>
    {menu.open && <CabinGameMenu state={state} onAction={onAction} chrome={chrome} onClose={() => menu.change(false)} page={page} onPage={setPage}/>}
  </div>
}
