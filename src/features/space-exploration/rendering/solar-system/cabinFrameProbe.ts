import type { WebGLRenderer } from 'three'
import { frameProbeStats } from './frameProbeStats'
import { installCabinClipRecorder } from './cabinClipRecorder'

function probeView() {
  const root = document.createElement('details')
  root.id = 'cabin-frame-probe'
  root.style.cssText = 'position:fixed;z-index:25;right:14px;top:64px;width:300px;padding:10px;background:#101e2beb;color:#e2eff7;border:1px solid #698393;border-radius:8px;font:12px system-ui'
  const summary = document.createElement('summary'), start = document.createElement('button'), report = document.createElement('button'), output = document.createElement('textarea')
  summary.textContent = '本地帧时间诊断 · 未记录'; start.textContent = '开始记录'; report.textContent = '生成报告'
  output.readOnly = true; output.setAttribute('aria-label', '本地帧时间诊断报告')
  output.style.cssText = 'display:block;width:100%;height:190px;box-sizing:border-box;font:11px monospace;margin-top:8px'
  for (const button of [start, report]) button.style.cssText = 'margin:8px 6px 0 0;padding:5px;color:#e2eff7;background:#284657;border:1px solid #698393;border-radius:4px'
  root.append(summary, start, report, output); document.body.append(root)
  return { root, summary, start, report, output }
}
function resourceRequests() {
  return performance.getEntriesByType('resource').filter(e => /\.glb(?:\.gz)?(?:$|[?-])/.test(e.name)).map(entry => {
    const resource = entry as PerformanceResourceTiming
    return { path: new URL(resource.name).pathname, durationMs: resource.duration, encodedBytes: resource.encodedBodySize, transferredBytes: resource.transferSize }
  })
}
function probeMemory(renderer: WebGLRenderer) {
  const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
  return { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
    programs: renderer.info.programs?.length, jsHeapBytes: heap?.usedJSHeapSize ?? null }
}

/** Explicit local QA overlay. Disabled in the normal game; no network/export side effects. */
export function installCabinFrameProbe(renderer: WebGLRenderer) {
  if (typeof window === 'undefined' || new URLSearchParams(window.location.search).get('frameProbe') !== '1') return
  const aborter = new AbortController(), signal = aborter.signal, { root, summary, start, report, output } = probeView()
  installCabinClipRecorder(renderer.domElement, root, signal)
  const originalRender = renderer.render.bind(renderer), originalDispose = renderer.dispose.bind(renderer)
  let running = false, last: number | undefined, frame = 0, lastLabel = 0, calls = 0, triangles = 0, renderMs = 0
  let began = '', activeMs = 0, frames: number[] = [], submissions: number[] = [], draws: number[] = [], tris: number[] = []
  let samples: object[] = [], visibility: object[] = [], lastResource = 0
  const memory = () => probeMemory(renderer)
  renderer.render = (...args) => {
    const before = performance.now(), previous = { ...renderer.info.render }
    try { originalRender(...args) } finally {
      if (running) {
        calls += renderer.info.render.calls - (renderer.info.autoReset ? 0 : previous.calls)
        triangles += renderer.info.render.triangles - (renderer.info.autoReset ? 0 : previous.triangles)
        renderMs += performance.now() - before
      }
    }
  }
  start.addEventListener('click', () => {
    running = true; last = undefined; activeMs = 0; began = new Date().toISOString(); frames = []; submissions = []; draws = []; tris = []
    calls = triangles = renderMs = 0; samples = [{ seconds: 0, ...memory() }]; visibility = []; lastResource = 0; output.value = ''
    renderer.domElement.focus()
  }, { signal })
  report.addEventListener('click', () => {
    running = false
    const stats = frameProbeStats(frames), average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)
    output.value = JSON.stringify({ started: began, ended: new Date().toISOString(), ...stats,
      viewport: { width: innerWidth, height: innerHeight, pixelRatio: renderer.getPixelRatio() }, browser: navigator.userAgent,
      averageCpuRenderSubmissionMs: average(submissions), averageDrawCallsPerFrame: average(draws), averageTrianglesPerFrame: average(tris),
      resources: resourceRequests(), resourceSamples: [...samples, { seconds: stats.activeSeconds, ...memory() }], visibility,
      limits: ['RAF frame delivery on this local browser only', 'CPU render submission excludes GPU duration and collision/update work',
        'No GPU byte measurement; object counters are not memory bytes', 'Cold-load timing and target-device acceptance remain separate'] }, null, 2)
    summary.textContent = `本地诊断 · ${stats.activeSeconds.toFixed(1)} 秒 · ${stats.averageFps.toFixed(1)} FPS`
  }, { signal })
  document.addEventListener('visibilitychange', () => {
    if (running) visibility.push({ at: new Date().toISOString(), hidden: document.hidden })
    last = undefined; calls = triangles = renderMs = 0
  }, { signal })
  const tick = (now: number) => {
    if (running && !document.hidden) {
      if (last !== undefined && frames.length < 240_000) { const dt = now - last; activeMs += dt; frames.push(dt); submissions.push(renderMs); draws.push(calls); tris.push(triangles) }
      last = now; calls = triangles = renderMs = 0
      if (now - lastResource > 30_000) { lastResource = now; samples.push({ seconds: activeMs / 1000, ...memory() }) }
      if (now - lastLabel > 1000) { lastLabel = now; summary.textContent = `本地诊断 · ${(activeMs / 1000).toFixed(0)} 秒 · 记录中` }
    }
    frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  renderer.dispose = () => { aborter.abort(); cancelAnimationFrame(frame); root.remove(); renderer.render = originalRender; renderer.dispose = originalDispose; originalDispose() }
}
