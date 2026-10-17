import type { SystemMapSnapshot } from '../rendering/solar-system/systemMapEngine'

export default function SystemMapShipLabel({ ship, onEnter, onRetry }: {
  ship: SystemMapSnapshot['ship']; onEnter: () => void; onRetry: () => void
}) {
  if (!ship?.projected.visible) return null
  const failed = ship.status === 'failed'
  const text = ship.suspended ? '飞船已暂停' : failed ? '飞船加载失败 · 重试' : ship.status === 'loading' ? '飞船加载中…' : '我的飞船'
  return <button type='button' className='system-map-ship-label'
    style={{ left: ship.projected.x, top: ship.projected.y + ship.projected.radius + 6 }}
    disabled={ship.suspended || ship.status === 'loading'}
    aria-label={failed ? '重新加载飞船模型' : '查看太阳系中的飞船'} onClick={failed ? onRetry : onEnter}>{text}</button>
}
