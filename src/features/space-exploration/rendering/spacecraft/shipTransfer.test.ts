import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import manifest from '../../../../assets/models/current-ship-transfer-20261022/manifest.json'
import production from '../../../../assets/models/current-ship-20261022/manifest.json'
import { readShipAsset } from './shipLoadProgress'
import { CURRENT_SHIP_PART_ASSETS,SHIP_MODEL_ASSETS } from './shipModelAssets'
import { shipTransferAsset } from './shipTransferAssets'

test('every transport archive decompresses to the exact reviewed source without model changes', async () => {
  let rawBytes = 0, compressedBytes = 0
  const urls={hull:SHIP_MODEL_ASSETS.assembly,crew:SHIP_MODEL_ASSETS.crew,...CURRENT_SHIP_PART_ASSETS}
  for (const [id, asset] of Object.entries(manifest.assets)) {
    const archive = await readFile(new URL(`../../../../assets/models/current-ship-transfer-20261022/${asset.file}`, import.meta.url))
    const source = await readFile(new URL(`../../../../assets/models/current-ship-20261022/${asset.sourceFile}`, import.meta.url))
    assert(gunzipSync(archive).equals(source)); assert.equal(archive.length, asset.bytes)
    assert.equal(createHash('sha256').update(source).digest('hex'), asset.originalSha256)
    assert.equal(asset.originalSha256,production.assets[id as keyof typeof production.assets].sha256)
    assert.equal(shipTransferAsset(urls[id as keyof typeof urls])?.url,new URL(`../../../../assets/models/current-ship-transfer-20261022/${asset.file}`,import.meta.url).href)
    rawBytes += source.length; compressedBytes += archive.length
  }
  assert.equal(rawBytes,Object.values(production.assets).reduce((sum,value)=>sum+value.bytes,0))
  assert(compressedBytes<rawBytes)
})

test('stream decompression reports decoded source progress and returns byte-identical GLB', async () => {
  const original = globalThis.fetch, raw = CURRENT_SHIP_PART_ASSETS.floor, transfer = shipTransferAsset(raw)!
  const requests: string[] = [], events: [number, string][] = []
  globalThis.fetch = async url => {
    requests.push(String(url)); return new Response(await readFile(new URL(String(url))))
  }
  try {
    const output = await readShipAsset(raw, new AbortController().signal, (bytes, phase) => events.push([bytes, phase]))
    assert(Buffer.from(output).equals(await readFile(new URL(raw))))
    assert.deepEqual(requests, [transfer.url]); assert.deepEqual(events.at(-1), [101140, 'parse'])
  } finally { globalThis.fetch = original }
})

test('missing archive falls back to the identical raw source, and truncated data fails closed', async () => {
  const original = globalThis.fetch, raw = CURRENT_SHIP_PART_ASSETS.floor, archive = shipTransferAsset(raw)!
  const requests: string[] = []
  globalThis.fetch = async url => {
    requests.push(String(url)); return String(url) === archive.url ? new Response(null, { status: 404 })
      : new Response(await readFile(new URL(raw)))
  }
  try {
    const output = await readShipAsset(raw, new AbortController().signal, () => {})
    assert(Buffer.from(output).equals(await readFile(new URL(raw))))
    assert.deepEqual(requests, [archive.url, raw])
    globalThis.fetch = async url => String(url) === archive.url ? new Response(null, { status: 404 }) : new Response(new Uint8Array([1]))
    await assert.rejects(readShipAsset(raw, new AbortController().signal, () => {}), /Incomplete ship transfer/)
  } finally { globalThis.fetch = original }
})

test('HTTP gzip already decoded by fetch is not decompressed a second time', async () => {
  const original = globalThis.fetch, raw = CURRENT_SHIP_PART_ASSETS.floor
  const bytes = await readFile(new URL(raw))
  globalThis.fetch = async () => new Response(bytes, { headers: { 'Content-Encoding': 'gzip' } })
  try {
    const output = await readShipAsset(raw, new AbortController().signal, () => {})
    assert(Buffer.from(output).equals(bytes))
  } finally { globalThis.fetch = original }
})

test('browsers without stream decompression use the original source directly', async () => {
  const originalFetch = globalThis.fetch, originalDecode = globalThis.DecompressionStream
  const raw = CURRENT_SHIP_PART_ASSETS.floor, requests: string[] = []
  ;(globalThis as any).DecompressionStream = undefined
  globalThis.fetch = async url => { requests.push(String(url)); return new Response(await readFile(new URL(raw))) }
  try {
    const output = await readShipAsset(raw, new AbortController().signal, () => {})
    assert(Buffer.from(output).equals(await readFile(new URL(raw)))); assert.deepEqual(requests, [raw])
  } finally { globalThis.fetch = originalFetch; globalThis.DecompressionStream = originalDecode }
})
