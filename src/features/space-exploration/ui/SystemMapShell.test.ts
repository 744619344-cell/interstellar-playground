import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = dirname(fileURLToPath(import.meta.url))
const shell = readFileSync(join(directory, 'SystemMapShell.tsx'), 'utf8')
const hud = readFileSync(join(directory, 'SystemMapHud.tsx'), 'utf8')
const runtime = readFileSync(join(directory, 'useSystemMapRuntime.ts'), 'utf8')
const css = readFileSync(join(directory, 'SystemMap.css'), 'utf8')
const music = readFileSync(join(directory, 'useSystemMapMusic.ts'), 'utf8')
const musicPanel = readFileSync(join(directory, 'SystemMapMusicPanel.tsx'), 'utf8')

describe('system map shell', () => {
  it('keeps a single canvas and does not navigate to independent body pages', () => {
    assert.match(shell, /system-map-canvas/)
    assert.match(shell, /snapshot\.labels\.map/)
    assert.match(shell, /event\.ctrlKey/)
    assert.doesNotMatch(shell, /onSelectBody/)
    assert.match(hud, /视觉比例，非真实等比例/)
    assert.match(hud, /双击进入特写/)
    assert.doesNotMatch(hud, /onFocus/)
    assert.match(hud, /返回全景/)
    assert.match(hud, /system-map-action/)
    assert.match(css, /\.system-map-page/)
    assert.match(css, /\.system-map-action/)
    assert.match(css, /white-space:\s*nowrap/)
    assert.match(css, /flex-direction:\s*row/)
    assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\) auto/)
    assert.match(css, /flex-wrap:\s*nowrap/)
    assert.doesNotMatch(css, /@media/)
    const forbidden = ['@' + 'tarojs', 'Solar' + 'SystemOverview', 'load' + 'VoyageShell', 'space' + 'Exploration']
    forbidden.forEach((token) => assert.equal(shell.includes(token), false, token))
    assert.match(shell, /SystemMapMusicPanel/)
    assert.match(hud, /音乐中/)
    assert.match(music, /loadSystemMapMusic/)
    assert.match(music, /saveSystemMapVolume/)
    assert.match(music, /URL\.revokeObjectURL/)
    assert.match(musicPanel, /type='range'/)
    assert.match(musicPanel, /aria-label='背景音乐音量'/)
    assert.match(musicPanel, /onVolume/)
  })

  it('reuses phase 0 pause composition and does not create a second renderer on resize', () => {
    assert.match(runtime, /VoyageRunController/)
    assert.match(runtime, /controller\.mount\(document\.hidden\)/)
    assert.match(runtime, /engineRef\.current\.resize/)
    assert.match(runtime, /new SystemMapEngine/)
    assert.doesNotMatch(runtime, /new SystemMapEngine[\s\S]*new SystemMapEngine/)
  })
})
