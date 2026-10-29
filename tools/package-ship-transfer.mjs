// Byte-preserving transport archives only. This never parses or rewrites GLB geometry/material data.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { gzipSync, gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'

const input = new URL('../src/assets/models/current-ship-20261022/', import.meta.url)
const output = new URL('../src/assets/models/current-ship-transfer-20261022/', import.meta.url)
await mkdir(output, { recursive: true })
const production = JSON.parse(await readFile(new URL('manifest.json',input),'utf8'))
let previous={assets:{}}
try { previous=JSON.parse(await readFile(new URL('manifest.json',output),'utf8')) } catch {}
const assets = {}
for (const [id,record] of Object.entries(production.assets)) {
  const file=record.file,source = await readFile(new URL(file, input))
  const hash=createHash('sha256').update(source).digest('hex'),old=previous.assets[id]
  if (hash!==record.sha256)throw Error(`Production checksum mismatch: ${file}`)
  if (old?.originalSha256===hash&&old.file===`${file}.gz`) {
    const packed=await readFile(new URL(old.file,output))
    if (gunzipSync(packed).equals(source)){assets[id]={...old,sourceFile:file};continue}
  }
  const packed = gzipSync(source, { level: 9 })
  if (!gunzipSync(packed).equals(source)) throw Error(`Transport round trip failed: ${file}`)
  await writeFile(new URL(`${file}.gz`, output), packed)
  assets[id] = { file: `${file}.gz`, sourceFile:file, bytes: packed.length, originalBytes: source.length,
    sha256: createHash('sha256').update(packed).digest('hex'), originalSha256: createHash('sha256').update(source).digest('hex') }
}
await writeFile(new URL('manifest.json', output), `${JSON.stringify({ encoding: 'gzip', assets }, null, 2)}\n`)
console.log(JSON.stringify({ files: Object.keys(assets).length, rawBytes: Object.values(assets).reduce((n, a) => n + a.originalBytes, 0),
  transferBytes: Object.values(assets).reduce((n, a) => n + a.bytes, 0) }))
