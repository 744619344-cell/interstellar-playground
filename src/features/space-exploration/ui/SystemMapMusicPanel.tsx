import type { ChangeEvent } from 'react'
import type { SystemMapMusicState } from './useSystemMapMusic'

interface Props {
  state: SystemMapMusicState
  onSelect: (file: File) => void
  onToggle: () => void
  onVolume: (volume: number) => void
  onClose: () => void
}

export default function SystemMapMusicPanel({ state, onSelect, onToggle, onVolume, onClose }: Props) {
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    if (file) onSelect(file)
    event.currentTarget.value = ''
  }
  return (
    <div className='system-map-music-panel'>
      <div className='system-map-music-head'>
        <div><b>背景音乐</b><span>仅保存在当前浏览器</span></div>
        <button type='button' className='system-map-music-close' onClick={onClose}>关闭</button>
      </div>
      <p className='system-map-music-name'>
        {state.loading ? '正在读取本地音乐…' : state.name || '尚未选择音乐'}
      </p>
      {state.error && <p className='system-map-music-error'>{state.error}</p>}
      <label className='system-map-volume'>
        <span>音量</span>
        <input
          type='range'
          min='0'
          max='100'
          step='1'
          value={Math.round(state.volume * 100)}
          aria-label='背景音乐音量'
          onChange={(event) => onVolume(Number(event.currentTarget.value) / 100)}
        />
        <span>{Math.round(state.volume * 100)}%</span>
      </label>
      <div className='system-map-music-actions'>
        <label className='system-map-music-button'>
          {state.ready ? '更换音乐' : '选择音乐'}
          <input className='system-map-music-input' type='file' accept='audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac' onChange={onChange} />
        </label>
        <button type='button' className={`system-map-music-button${state.ready ? '' : ' is-disabled'}`} onClick={onToggle} disabled={!state.ready}>
          {state.playing ? '暂停音乐' : '播放音乐'}
        </button>
      </div>
    </div>
  )
}
