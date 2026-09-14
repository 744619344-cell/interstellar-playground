export const SYSTEM_MAP_MUSIC_DB = 'our-universe-system-map-music-v1'
export const SYSTEM_MAP_MUSIC_KEY = 'background-track'
export const SYSTEM_MAP_VOLUME_KEY = 'our-universe-system-map-volume-v1'
export const MAX_SYSTEM_MAP_MUSIC_BYTES = 50 * 1024 * 1024
export const DEFAULT_SYSTEM_MAP_VOLUME = 0.55

export interface StoredSystemMapMusic {
  name: string
  type: string
  blob: Blob
  updatedAt: number
}

export function validateSystemMapMusic(file: Pick<File, 'name' | 'size' | 'type'>) {
  const extensionAllowed = /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)
  if (!file.type.startsWith('audio/') && !extensionAllowed) return '请选择常见音频文件'
  if (file.size <= 0) return '音频文件为空'
  if (file.size > MAX_SYSTEM_MAP_MUSIC_BYTES) return '音频文件不能超过 50MB'
  return null
}

export async function loadSystemMapMusic() {
  const db = await openMusicDb()
  try {
    return await requestResult<StoredSystemMapMusic | undefined>(
      db.transaction('tracks', 'readonly').objectStore('tracks').get(SYSTEM_MAP_MUSIC_KEY)
    )
  } finally {
    db.close()
  }
}

export async function saveSystemMapMusic(track: StoredSystemMapMusic) {
  const db = await openMusicDb()
  try {
    const transaction = db.transaction('tracks', 'readwrite')
    transaction.objectStore('tracks').put(track, SYSTEM_MAP_MUSIC_KEY)
    await transactionDone(transaction)
  } finally {
    db.close()
  }
}

export function loadSystemMapVolume(storage: Pick<Storage, 'getItem'> | undefined = browserStorage()) {
  if (!storage) return DEFAULT_SYSTEM_MAP_VOLUME
  try {
    const raw = storage.getItem(SYSTEM_MAP_VOLUME_KEY)
    if (raw === null) return DEFAULT_SYSTEM_MAP_VOLUME
    const value = Number(raw)
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : DEFAULT_SYSTEM_MAP_VOLUME
  } catch {
    return DEFAULT_SYSTEM_MAP_VOLUME
  }
}

export function saveSystemMapVolume(volume: number, storage: Pick<Storage, 'setItem'> | undefined = browserStorage()) {
  if (!storage) return
  try {
    storage.setItem(SYSTEM_MAP_VOLUME_KEY, String(clampVolume(volume)))
  } catch {
    // Storage can be unavailable in private/restricted browser contexts.
  }
}

export function clampVolume(volume: number) {
  return Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : DEFAULT_SYSTEM_MAP_VOLUME))
}

function browserStorage() {
  return typeof localStorage === 'undefined' ? undefined : localStorage
}

function openMusicDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(SYSTEM_MAP_MUSIC_DB, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('tracks')) request.result.createObjectStore('tracks')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('music-db-open-failed'))
    request.onblocked = () => reject(new Error('music-db-blocked'))
  })
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('music-db-request-failed'))
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('music-db-write-failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('music-db-write-aborted'))
  })
}
