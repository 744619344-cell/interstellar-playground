import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SystemMapSnapshot } from '../rendering/solar-system/systemMapEngine'
import { createCabinEquipmentUse } from '../domain/cabinEquipmentUse'
import { armCabinMotionStudy } from '../domain/cabinMotionStudy'
import { cabinMenuKey, cabinMotionNotice, cabinNoticeVisible, cabinNoticePersistent } from './cabinHudInput'
import CabinGameHud from './CabinGameHud'
import CabinGameMenu from './CabinGameMenu'
import CabinEquipmentUsePanel from './CabinEquipmentUsePanel'

type Flight = NonNullable<SystemMapSnapshot['shipFlight']>
const chrome = { clearInput() {}, focusGame() {}, onPause() {}, onMusic() {}, onOverview() {}, overlayOpen: false }
function fixture(): Flight {
  return { mode: 'cabin', suspended: false, paused: false, speed: 0, model: { status: 'ready', cabin: {
    microgravity: true, controlMode: 'assisted', float: {}, busy: false, posture: 'floating', action: '漂浮', notice: '端游辅助：移动时跟随视线',
    eva: { suit: 'stowed', location: 'cabin' }, atSuitLocker: true, equipment: createCabinEquipmentUse(), equipmentContext: { held: false }, nearbyEquipment: [],
    evaControls: { visible: true, stage: '穿戴准备', pressure: '已增压', hint: '抓稳扶手后操作柜门与装备', controls: [
      { id: 'locker', label: '打开宇航服舱', enabled: false, reason: '先抓稳扶手' },
      { id: 'wear', label: '穿上宇航服', key: 'R', enabled: false, reason: '先抓稳扶手' }
    ] }, prompt: { key: 'F', verb: '查看装备 · R 穿脱', title: '宇航服收纳舱', distance: .7 }
  } } } as unknown as Flight
}
test('Tab/Esc consume only menu commands; movement and F close the menu and still reach the game', () => {
  assert.deepEqual(cabinMenuKey('Tab', false), { open: true, consume: true })
  assert.deepEqual(cabinMenuKey('Tab', true), { open: false, consume: true })
  assert.equal(cabinMenuKey('Escape', false), undefined)
  assert.deepEqual(cabinMenuKey('Escape', true), { open: false, consume: true })
  for (const code of ['KeyF', 'KeyW', 'ArrowRight', 'Space', 'KeyP']) assert.deepEqual(cabinMenuKey(code, true), { open: false, consume: false })
  assert.equal(cabinMenuKey('Tab', true, true), undefined)
  assert.equal(cabinMenuKey('Tab', true, false, true), undefined)
  assert(cabinNoticeVisible('柜门净空不足，请后退'))
  assert(!cabinNoticeVisible('端游辅助：移动时跟随视线'))
  assert(cabinNoticePersistent('柜门活动范围被挡住，稍退后便会继续'))
  assert(!cabinNoticePersistent('宇航服柜门已完全展开'))
})
test('movement blockage remains visible after the ordinary notice fades and clears when movement is free', () => {
  const collision = '前方有结构；换方向退出，松键缓停，B制动'
  assert.equal(cabinMotionNotice(collision, '', true), collision)
  assert.equal(cabinMotionNotice(collision, collision, false), '')
  assert.equal(cabinMotionNotice('柜门活动范围被挡住，稍退后便会继续', '柜门活动范围被挡住，稍退后便会继续', true), '柜门活动范围被挡住，稍退后便会继续')
  const state = fixture(), cabin = state.model.cabin!
  cabin.notice = collision; cabin.blocked = true
  const blocked = renderToStaticMarkup(createElement(CabinGameHud, { state, onAction() {}, chrome }))
  assert.match(blocked, /前方有结构/); assert.match(blocked, /F 查看装备/)
  cabin.blocked = false
  const clear = renderToStaticMarkup(createElement(CabinGameHud, { state, onAction() {}, chrome }))
  assert.doesNotMatch(clear, /前方有结构/)
})
test('nearby locker alone never opens procedure, guide, diagnostic or device cards', () => {
  const html = renderToStaticMarkup(createElement(CabinGameHud, { state: fixture(), onAction() {}, chrome }))
  assert.match(html, /F 查看装备/)
  assert.match(html, /Tab/)
  assert.doesNotMatch(html, /设备操作面板|宇航服与舱外探索|舱内菜单|运行诊断|展开操作|出舱步骤|设备用法与未完成项目/)
})
test('explicit F device state renders exactly one action panel with no nested fold controls', () => {
  const state = fixture(), cabin = state.model.cabin!
  cabin.devicePanel = { id: 'micro-locker', kind: 'locker', title: '宇航服收纳舱', description: '宇航服收纳与换装', checked: false }
  const html = renderToStaticMarkup(createElement(CabinGameHud, { state, onAction() {}, chrome }))
  assert.equal((html.match(/aria-label="设备操作面板"/g) ?? []).length, 1)
  assert.match(html, /打开宇航服舱/); assert.match(html, /穿上宇航服/); assert.match(html, /抓稳这台设备/)
  assert.doesNotMatch(html, /<details|<summary|<button[^>]*>[^<]*(展开|收起)|F 查看装备/)
  assert.equal((html.match(/<small>先抓稳扶手<\/small>/g) ?? []).length, 1)
})
test('live observation stays a small status, with stop available and full data retained in the menu view', () => {
  const state = fixture(), cabin = state.model.cabin! as unknown as { equipment: ReturnType<typeof createCabinEquipmentUse> }
  cabin.equipment.study = armCabinMotionStudy()
  const html = renderToStaticMarkup(createElement(CabinGameHud, { state, onAction() {}, chrome }))
  assert.match(html, /观测状态/); assert.match(html, /停止/)
  assert.doesNotMatch(html, /<svg|漂移惯性观测|cabin-study-panel/)
  const result = { ...armCabinMotionStudy(), phase: 'complete' as const, result: { displacement: 1.2, speedMin: .4, speedMax: .4, residual: 0 } }
  cabin.equipment.study = result
  const report = renderToStaticMarkup(createElement(CabinGameMenu, { state, onAction() {}, chrome, onClose() {}, page: 'data', onPage() {} }))
  assert.match(report, /1\.200/); assert.match(report, /download="cabin-motion-observation.csv"/)
  assert.doesNotMatch(report, /展开观测|收起观测/)
})
test('storage shows the applicable kit and light actions without losing either state', () => {
  const state = createCabinEquipmentUse(), context = { id: 'micro-starboard-liner', near: true, held: true, ready: true, pressure: 'cabin', doorsClosed: true, suit: 'stowed', oxygen: 1, battery: 1, tether: false }
  const render = () => renderToStaticMarkup(createElement(CabinEquipmentUsePanel, { id: 'micro-starboard-liner', state, context, paused: false, onAction() {} }))
  const first = render(); assert.match(first, /领用工具包/); assert.match(first, /切换休息照明/); assert.doesNotMatch(first, /归还工具包|切回工作照明/)
  state.kit = 'carried'; state.light = 'rest'
  const next = render(); assert.match(next, /归还工具包/); assert.match(next, /切回工作照明/); assert.doesNotMatch(next, /领用工具包|切换休息照明/)
})
