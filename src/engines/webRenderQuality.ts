export type WebRenderQuality = 'low' | 'high'

export interface WebRenderProfile {
  level: WebRenderQuality
  maxPixelRatio: number
  particleScale: number
  shadows: boolean
  postProcessing: boolean
  cameraShake: boolean
  motionBlur: boolean
  effectIntensity: number
}

export interface WebRenderPreferences {
  qualityMode: 'auto' | 'low' | 'high'
  cameraShake: boolean
  motionBlur: boolean
  motionIntensity: 'reduced' | 'standard' | 'high'
}

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number
}

interface WebRenderCapabilitySource {
  deviceMemory?: number
  hardwareConcurrency?: number
}

export function detectWebRenderQuality(): WebRenderQuality {
  return detectWebRenderProfile().level
}

export function detectWebRenderProfile(
  source: WebRenderCapabilitySource = navigator as NavigatorWithMemory
): WebRenderProfile {
  const lowMemory = typeof source.deviceMemory === 'number' && source.deviceMemory <= 4
  const lowConcurrency = typeof source.hardwareConcurrency === 'number' && source.hardwareConcurrency <= 4
  return lowMemory || lowConcurrency
    ? { level: 'low', maxPixelRatio: 1, particleScale: 0.45, shadows: false, postProcessing: false, cameraShake: true, motionBlur: true, effectIntensity: 1 }
    : { level: 'high', maxPixelRatio: 1.75, particleScale: 1, shadows: true, postProcessing: true, cameraShake: true, motionBlur: true, effectIntensity: 1 }
}

export function applyWebRenderPreferences(base: WebRenderProfile, preferences: WebRenderPreferences): WebRenderProfile {
  const level = preferences.qualityMode === 'auto' ? base.level : preferences.qualityMode
  const intensity = preferences.motionIntensity === 'reduced' ? 0.55 : preferences.motionIntensity === 'high' ? 1.25 : 1
  const quality = level === 'low'
    ? { maxPixelRatio: 1, particleScale: 0.45, shadows: false, postProcessing: false }
    : { maxPixelRatio: 1.75, particleScale: 1, shadows: true, postProcessing: true }
  return {
    level,
    ...quality,
    particleScale: quality.particleScale * intensity,
    cameraShake: preferences.cameraShake,
    motionBlur: preferences.motionBlur,
    effectIntensity: intensity
  }
}

export function limitWebPixelRatio(maximum: number, quality: WebRenderQuality) {
  return Math.min(window.devicePixelRatio || 1, quality === 'low' ? 1 : maximum)
}
