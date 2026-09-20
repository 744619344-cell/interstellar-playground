import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const directory = dirname(fileURLToPath(import.meta.url))
const app = readFileSync(join(directory, 'App.tsx'), 'utf8')
const main = readFileSync(join(directory, 'main.tsx'), 'utf8')
const html = readFileSync(join(directory, '..', 'index.html'), 'utf8')
const css = readFileSync(join(directory, 'index.css'), 'utf8')

describe('desktop web entry', () => {
  it('boots SystemMapShell from the project root without feature flags', () => {
    assert.match(html, /src\/main\.tsx/)
    assert.match(main, /createRoot/)
    assert.match(app, /SystemMapShell/)
    assert.match(app, /from ['"]\.\/features\/space-exploration['"]/)
    assert.doesNotMatch(app, /\/ui\//)
    assert.match(css, /min-width:\s*1280px/)
    const forbidden = ['@' + 'tarojs', 'Solar' + 'SystemOverview', 'Experience' + 'Router', 'Photo' + 'Sphere', 'load' + 'VoyageShell', 'space' + 'Exploration', 'wea' + 'pp']
    const bundled = app + main + html
    forbidden.forEach((token) => assert.equal(bundled.includes(token), false, token))
  })
})
