/** Records only this game's existing canvas, locally. No screen/microphone access or uploads. */
export function installCabinClipRecorder(canvas: HTMLCanvasElement, host: HTMLElement, signal: AbortSignal) {
  const button = document.createElement('button'), status = document.createElement('span'), link = document.createElement('a')
  button.textContent = '录制画布'; button.style.cssText = 'padding:5px;margin:8px 6px 8px 0;background:#284657;color:#e2eff7;border:1px solid #698393;border-radius:4px'
  status.style.cssText = 'font-size:11px'; link.textContent = '保存录屏'; link.download = 'cabin-slice-20261027.webm'; link.hidden = true
  link.style.cssText = 'color:#9eddf5;margin:5px 0'
  host.append(button, status, link)
  if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) { button.disabled = true; status.textContent = '当前浏览器不支持画布录屏'; return }
  let recorder: MediaRecorder | undefined, stream: MediaStream | undefined, timer: ReturnType<typeof setTimeout> | undefined, reader: FileReader | undefined
  let chunks: Blob[] = [], started = 0, failed = false
  const release = () => { if (timer) clearTimeout(timer); timer = undefined; stream?.getTracks().forEach(track => track.stop()); stream = undefined }
  const stop = () => { if (recorder?.state === 'recording') recorder.stop(); release() }
  button.addEventListener('click', () => {
    if (recorder?.state === 'recording') { stop(); return }
    try {
      reader?.abort(); chunks = []; failed = false; link.removeAttribute('href'); link.hidden = true
      stream = canvas.captureStream(30)
      const preferred = 'video/webm;codecs=vp8', mimeType = MediaRecorder.isTypeSupported(preferred) ? preferred : 'video/webm'
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_400_000 }); started = performance.now()
      recorder.addEventListener('dataavailable', event => { if (event.data.size && !signal.aborted) chunks.push(event.data) })
      recorder.addEventListener('error', () => { failed = true; release(); button.textContent = '录制画布'; status.textContent = '录屏失败；未生成验收视频' })
      recorder.addEventListener('stop', () => {
        release(); button.textContent = '录制画布'
        if (signal.aborted || failed) { chunks = []; return }
        const blob = new Blob(chunks, { type: 'video/webm' }); chunks = []
        if (!blob.size || blob.size > 30_000_000) { status.textContent = '录屏为空或超出本地大小限制'; return }
        status.textContent = `编码中 · ${((performance.now() - started) / 1000).toFixed(1)} 秒`
        reader = new FileReader()
        reader.onload = () => { if (!signal.aborted) { link.href = String(reader!.result); link.hidden = false; status.textContent = `本地录屏 · ${(blob.size / 1e6).toFixed(1)} MB` } }
        reader.readAsDataURL(blob)
      }, { once: true })
      recorder.start(1000); timer = setTimeout(stop, 60_000)
      button.textContent = '停止录屏'; status.textContent = '仅游戏画布 · 最长60秒'; canvas.focus()
    } catch { release(); button.textContent = '录制画布'; status.textContent = '录屏不可用；未保存视频' }
  }, { signal })
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop() }, { signal })
  signal.addEventListener('abort', () => { reader?.abort(); stop(); chunks = []; link.removeAttribute('href') }, { once: true })
}
