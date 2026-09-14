import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clampVolume, loadSystemMapMusic, loadSystemMapVolume, saveSystemMapMusic, saveSystemMapVolume,
  validateSystemMapMusic, type StoredSystemMapMusic
} from '../storage/systemMapMusicStorage'

export interface SystemMapMusicState {
  name: string
  ready: boolean
  playing: boolean
  loading: boolean
  error: string | null
  volume: number
}

const initialVolume = loadSystemMapVolume()
const EMPTY: SystemMapMusicState = {
  name: '', ready: false, playing: false, loading: true, error: null, volume: initialVolume
}

export function useSystemMapMusic() {
  const audioRef = useRef<HTMLAudioElement>()
  const urlRef = useRef('')
  const resumeRef = useRef(false)
  const mountedRef = useRef(true)
  const [state, setState] = useState(EMPTY)

  const applyTrack = useCallback((track: StoredSystemMapMusic, autoplay: boolean) => {
    const audio = audioRef.current
    if (!audio || !mountedRef.current) return
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = URL.createObjectURL(track.blob)
    audio.src = urlRef.current
    audio.load()
    setState((current) => ({
      name: track.name, ready: true, playing: false, loading: false, error: null, volume: current.volume
    }))
    if (autoplay) void audio.play().catch(() => {
      setState((current) => ({ ...current, playing: false, error: '音乐已保存，请点击播放' }))
    })
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const audio = new Audio()
    audio.loop = true
    audio.volume = initialVolume
    audio.preload = 'metadata'
    audio.onplay = () => setState((current) => ({ ...current, playing: true, error: null }))
    audio.onpause = () => setState((current) => ({ ...current, playing: false }))
    audio.onerror = () => setState((current) => ({ ...current, playing: false, error: '当前浏览器无法播放该音频' }))
    audioRef.current = audio
    void loadSystemMapMusic()
      .then((track) => {
        if (!mountedRef.current) return
        if (track) applyTrack(track, false)
        else setState({ ...EMPTY, loading: false })
      })
      .catch(() => {
        if (mountedRef.current) setState({ ...EMPTY, loading: false, error: '无法读取本地音乐' })
      })
    const onVisibility = () => {
      if (document.hidden) {
        resumeRef.current = !audio.paused
        audio.pause()
      } else if (resumeRef.current) {
        resumeRef.current = false
        void audio.play().catch(() => undefined)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      mountedRef.current = false
      document.removeEventListener('visibilitychange', onVisibility)
      audio.onplay = null
      audio.onpause = null
      audio.onerror = null
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = ''
      audioRef.current = undefined
    }
  }, [applyTrack])

  const selectFile = useCallback(async (file: File) => {
    const invalid = validateSystemMapMusic(file)
    if (invalid) {
      setState((current) => ({ ...current, error: invalid }))
      return false
    }
    const track = { name: file.name, type: file.type, blob: file, updatedAt: Date.now() }
    applyTrack(track, true)
    try {
      await saveSystemMapMusic(track)
      return true
    } catch {
      setState((current) => ({ ...current, error: '播放可用，但保存到本机失败' }))
      return false
    }
  }, [applyTrack])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !state.ready) return
    if (!audio.paused) audio.pause()
    else void audio.play().catch(() => setState((current) => ({ ...current, error: '请再次点击播放以授权音乐' })))
  }, [state.ready])

  const setVolume = useCallback((value: number) => {
    const volume = clampVolume(value)
    if (audioRef.current) audioRef.current.volume = volume
    saveSystemMapVolume(volume)
    setState((current) => ({ ...current, volume }))
  }, [])

  return { state, selectFile, toggle, setVolume }
}
