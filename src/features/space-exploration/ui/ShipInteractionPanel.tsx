import { SHIP_INTERACTION_ANCHORS, SHIP_INTERACTION_LABEL, shipDoorLabel,
  type ShipInteractionAnchor } from '../domain/shipInteraction'
import type { SystemMapSnapshot } from '../rendering/solar-system/systemMapEngine'
import type { ShipFlightAction } from '../rendering/spacecraft/shipFlightRuntime'
import { SHIP_MODEL_ASSETS } from '../rendering/spacecraft/shipModelAssets'

type Preview = NonNullable<SystemMapSnapshot['shipFlight']>
const microAttribution = new URL('../../../assets/models/microgravity-cabin-20261025/ATTRIBUTION.md?no-inline', import.meta.url).href

export default function ShipInteractionPanel({ state, model, onAction }: {
  state: Preview['interaction']
  model: Preview['model']
  onAction: (action: ShipFlightAction) => void
}) {
  const ready = model.status === 'ready'
  const attribution = model.cabin && 'microgravity' in model.cabin ? microAttribution : SHIP_MODEL_ASSETS.attribution
  const anchors = new Set<ShipInteractionAnchor>(model.anchors)
  return <section className='ship-interaction-panel' aria-label='飞船交互'>
    <strong>舱内交互</strong>
    {!model.cabin&&<label className='ship-interaction-label'>当前锚点
      <select value={state.activeAnchor} disabled={!ready}
        onChange={(event) => onAction(`anchor:${event.target.value as ShipInteractionAnchor}`)}>
        {SHIP_INTERACTION_ANCHORS.map(anchor => <option key={anchor} value={anchor} disabled={ready && !anchors.has(anchor)}>
          {SHIP_INTERACTION_LABEL[anchor]}{ready && !anchors.has(anchor) ? '（未提供）' : ''}
        </option>)}
      </select>
    </label>}
    <button type='button' className='ship-camera-button' disabled={!ready || (model.cabin?!model.cabin.prompt:!anchors.has(state.activeAnchor))} onClick={() => onAction('interact')}>
      {model.cabin?model.cabin.prompt?`F · ${model.cabin.prompt.verb}`:'靠近设备后显示操作':'F · 执行交互'}
    </button>
    <div className='ship-interaction-status'>
      <output>座椅 {(model.cabin?.seated??state.seated) ? '已入座' : '未入座'}</output>
      {model.cabin?<>
        <output>驾驶控制 {model.cabin.pilotReady?'已接管':'入座后接管'}</output>
        <output>舱外密封门 {model.cabin.doorLabel}</output>
      </>:<>
        <output>控制台 {ready && !anchors.has('console') ? '静态展示' : state.consoleActive ? '运行中' : '已关闭'}</output>
        <output>内舱门 {ready && !anchors.has('inner-door') ? '静态模型' : shipDoorLabel(state.doors.inner)}</output>
        <output>外舱门 {ready && !anchors.has('airlock') ? '未提供交互' : shipDoorLabel(state.doors.outer)}</output>
      </>}
    </div>
    <output className='ship-interaction-notice' aria-live='polite'>
      {model.cabin?.notice ?? state.notice ?? (ready && !anchors.has('inner-door') ? '选择驾驶座或站立点后按 F；当前后隔舱为静态模型' : '选择锚点后按 F；外舱门仅提供机械互锁预览')}
    </output>
    <a href={attribution} target='_blank' rel='noreferrer'>模型署名与许可</a>
  </section>
}
