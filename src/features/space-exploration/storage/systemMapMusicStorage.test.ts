import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_SYSTEM_MAP_VOLUME, loadSystemMapVolume, MAX_SYSTEM_MAP_MUSIC_BYTES, saveSystemMapVolume,
  SYSTEM_MAP_MUSIC_DB, SYSTEM_MAP_MUSIC_KEY, SYSTEM_MAP_VOLUME_KEY, validateSystemMapMusic
} from './systemMapMusicStorage'

test('system map music uses an isolated versioned database and key', () => {
  assert.equal(SYSTEM_MAP_MUSIC_DB, 'our-universe-system-map-music-v1')
  assert.equal(SYSTEM_MAP_MUSIC_KEY, 'background-track')
  assert.doesNotMatch(SYSTEM_MAP_MUSIC_DB, /photo|backup/i)
})

test('music validation accepts audio and rejects unsupported or oversized files', () => {
  assert.equal(validateSystemMapMusic({ name: 'memory.mp3', type: 'audio/mpeg', size: 1024 }), null)
  assert.equal(validateSystemMapMusic({ name: 'memory.m4a', type: '', size: 1024 }), null)
  assert.match(validateSystemMapMusic({ name: 'notes.txt', type: 'text/plain', size: 10 })!, /音频/)
  assert.match(validateSystemMapMusic({ name: 'huge.mp3', type: 'audio/mpeg', size: MAX_SYSTEM_MAP_MUSIC_BYTES + 1 })!, /50MB/)
})

test('volume preference is clamped, isolated and safely restored', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) }
  }
  assert.equal(loadSystemMapVolume(storage), DEFAULT_SYSTEM_MAP_VOLUME)
  saveSystemMapVolume(0.72, storage)
  assert.equal(values.get(SYSTEM_MAP_VOLUME_KEY), '0.72')
  assert.equal(loadSystemMapVolume(storage), 0.72)
  values.set(SYSTEM_MAP_VOLUME_KEY, 'broken')
  assert.equal(loadSystemMapVolume(storage), DEFAULT_SYSTEM_MAP_VOLUME)
  saveSystemMapVolume(4, storage)
  assert.equal(loadSystemMapVolume(storage), 1)
})
