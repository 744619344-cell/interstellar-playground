import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const featureRoot = dirname(dirname(fileURLToPath(import.meta.url)))

function listSource(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = join(directory, name)
    if (statSync(full).isDirectory()) return listSource(full)
    return ['.ts', '.tsx'].includes(extname(full)) ? [full] : []
  })
}

describe('system map module boundary', () => {
  it('does not import old pages, storage, mini-game engines or remote urls', () => {
    const files = listSource(featureRoot).filter((file) => (
      !file.endsWith('.test.ts')
      && /domain|solar-system|systemMap|SystemMap/.test(file.replace(/\\/g, '/'))
    ))
    files.forEach((file) => {
      const source = readFileSync(file, 'utf8')
      assert.equal(source.includes('Solar' + 'SystemOverview.h5'), false)
      assert.doesNotMatch(source, /pages\/solar/)
      assert.doesNotMatch(source, /pages\/index/)
      assert.doesNotMatch(source, /from ['"]\.\.\/\.\.\/\.\.\/storage/)
      assert.doesNotMatch(source, /saturnFlight|jupiterStorm|marsTerrain|moonTerrain|neptuneSurf/)
      assert.doesNotMatch(source, /https?:\/\//)
    })
  })

  it('public feature entry exposes the system map shell', () => {
    const index = readFileSync(join(featureRoot, 'index.ts'), 'utf8')
    assert.match(index, /SystemMapShell/)
    const forbidden = ['Space' + 'ExplorationVoyage', 'load' + 'VoyageShell', 'space' + 'Exploration']
    forbidden.forEach((token) => assert.equal(index.includes(token), false, token))
  })
})
