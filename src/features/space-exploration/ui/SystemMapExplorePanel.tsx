import designReference from './assets/system-map-design-reference.png'

export default function SystemMapExplorePanel() {
  return (
    <aside className='system-map-explore' aria-label='探索计划预览'>
      <section className='system-map-preview-card'>
        <div className='system-map-preview-title'><h2>飞船</h2></div>
        <p>停泊于地球轨道</p>
        <div className='system-map-preview-art is-ship' role='img' aria-label='白色探索飞船概念插图'>
          <svg viewBox='1238 180 376 266' preserveAspectRatio='xMidYMid meet' width='100%' height='100%'>
            <defs><clipPath id='ship-preview-crop'><rect x='1238' y='180' width='376' height='266' /></clipPath></defs>
            <image href={designReference} width='1680' height='941' clipPath='url(#ship-preview-crop)' />
          </svg>
        </div>
        <button className='system-map-preview-button' type='button' disabled>进入驾驶舱</button>
      </section>
      <section className='system-map-preview-card'>
        <div className='system-map-preview-title'><h2>宇航员</h2></div>
        <p>舱内待命</p>
        <div className='system-map-preview-art is-crew' role='img' aria-label='白色宇航服与金色面罩的宇航员概念插图'>
          <svg viewBox='1340 547 160 345' preserveAspectRatio='xMidYMid meet' width='100%' height='100%'>
            <defs><clipPath id='crew-preview-crop'><rect x='1340' y='547' width='160' height='345' /></clipPath></defs>
            <image href={designReference} width='1680' height='941' clipPath='url(#crew-preview-crop)' />
          </svg>
        </div>
        <button className='system-map-preview-button' type='button' disabled aria-label='宇航员功能筹备中' />
      </section>
    </aside>
  )
}
