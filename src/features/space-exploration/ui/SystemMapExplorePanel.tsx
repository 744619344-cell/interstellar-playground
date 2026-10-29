import designReference from './assets/system-map-design-reference.png'
import type { SystemMapSnapshot } from '../rendering/solar-system/systemMapEngine'
import { shipLoadingLabel } from '../rendering/spacecraft/shipLoadProgress'

export default function SystemMapExplorePanel({ ship, onViewShip, onEnterCockpit, onCrew, onRetry }: {
  ship: SystemMapSnapshot['ship']; onViewShip: () => void; onEnterCockpit: () => void; onCrew: () => void; onRetry: () => void
}) {
  const status = ship?.suspended ? '飞船已暂停' : ship?.status === 'failed' ? ship.loadError ?? '飞船加载失败，请重试'
    : ship?.status !== 'ready' ? shipLoadingLabel(ship?.loadProgress, ship?.previewReady) : ship.parked ? '地球随行泊位' : '太阳系航行中'
  return (
    <aside className='system-map-explore' aria-label='探索计划预览'>
      <section className='system-map-preview-card'>
        <div className='system-map-preview-title'><h2>飞船</h2></div>
        <p aria-live='polite'>{status}</p>
        <div className='system-map-preview-art is-ship' role='img' aria-label='白色探索飞船概念插图'>
          <svg viewBox='1238 180 376 266' preserveAspectRatio='xMidYMid meet' width='100%' height='100%'>
            <defs><clipPath id='ship-preview-crop'><rect x='1238' y='180' width='376' height='266' /></clipPath></defs>
            <image href={designReference} width='1680' height='941' clipPath='url(#ship-preview-crop)' />
          </svg>
        </div>
        <div className='system-map-ship-entry'>
          <button className='system-map-preview-button' type='button' onClick={ship?.status === 'failed' ? onRetry : onViewShip}>
            {ship?.status === 'failed' ? '重新加载飞船' : '查看飞船外观'}</button>
          <button className='system-map-preview-button' type='button' disabled={ship?.status !== 'ready'} onClick={onEnterCockpit}>进入驾驶舱</button>
        </div>
      </section>
      <section className='system-map-preview-card'>
        <div className='system-map-preview-title'><h2>宇航员</h2></div>
        <p>{ship?.crewReady ? ship.microgravity ? '微重力内舱 · 制作候选' : '舱内行走 · 手部动作' : '等待飞船模型'}</p>
        <div className='system-map-preview-art is-crew' role='img' aria-label='白色宇航服与金色面罩的宇航员概念插图'>
          <svg viewBox='1340 547 160 345' preserveAspectRatio='xMidYMid meet' width='100%' height='100%'>
            <defs><clipPath id='crew-preview-crop'><rect x='1340' y='547' width='160' height='345' /></clipPath></defs>
            <image href={designReference} width='1680' height='941' clipPath='url(#crew-preview-crop)' />
          </svg>
        </div>
        <button className='system-map-preview-button' type='button' disabled={!ship?.crewReady} onClick={onCrew}>进入舱内行动</button>
      </section>
    </aside>
  )
}
