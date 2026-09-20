import { SHIP_INTERACTION_ANCHORS, SHIP_INTERACTION_LABEL, shipDoorLabel,
  type ShipInteractionAnchor } from '../domain/shipInteraction'
import type { SystemMapSnapshot } from '../rendering/solar-system/systemMapEngine'
import type { ShipPreviewAction } from '../rendering/spacecraft/shipCameraPreview'

type Preview = NonNullable<SystemMapSnapshot['cameraPreview']>

export default function ShipInteractionPanel({ state, model, onAction }: {
  state: Preview['interaction']
  model: Preview['model']
  onAction: (action: ShipPreviewAction) => void
}) {
  const ready = model.status === 'ready'
  const anchors = new Set<ShipInteractionAnchor>(model.anchors)
  return <section className='ship-interaction-panel' aria-label='飞船交互'>
    <strong>舱内交互</strong>
    <label className='ship-interaction-label'>当前锚点
      <select value={state.activeAnchor} disabled={!ready}
        onChange={(event) => onAction(`anchor:${event.target.value as ShipInteractionAnchor}`)}>
        {SHIP_INTERACTION_ANCHORS.map(anchor => <option key={anchor} value={anchor} disabled={ready && !anchors.has(anchor)}>
          {SHIP_INTERACTION_LABEL[anchor]}{ready && !anchors.has(anchor) ? '（缺失）' : ''}
        </option>)}
      </select>
    </label>
    <button type='button' className='ship-camera-button' disabled={!ready} onClick={() => onAction('interact')}>
      F · 执行交互
    </button>
    <div className='ship-interaction-status'>
      <output>座椅 {state.seated ? '已入座' : '未入座'}</output>
      <output>控制台 {state.consoleActive ? '运行中' : '已关闭'}</output>
      <output>内舱门 {shipDoorLabel(state.doors.inner)}</output>
      <output>外舱门 {shipDoorLabel(state.doors.outer)}</output>
    </div>
    <output className='ship-interaction-notice' aria-live='polite'>
      {state.notice ?? '选择锚点后按 F；外舱门仅提供机械互锁预览'}
    </output>
  </section>
}
