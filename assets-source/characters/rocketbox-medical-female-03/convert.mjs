import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { MeshStandardMaterial } from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { readCharacter } from './inspect-fbx.mjs'

// Browser FileReader used by the official exporter; no renderer or image canvas needed.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(data => { this.result = data; this.onloadend?.() }) }
}
const root = new URL('./', import.meta.url), scene = readCharacter()
const materialTextures = new Map(), before = []
const hash = a => createHash('sha256').update(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength)).digest('hex')
scene.traverse(o => {
  if (!o.isMesh) return
  const g = o.geometry, dictionary = o.morphTargetDictionary
  const names = Object.keys(dictionary).filter(name => /\.AK_\d\d_/.test(name))
  const indices = names.map(name => dictionary[name])
  for (const key of Object.keys(g.morphAttributes)) g.morphAttributes[key] = indices.map(i => g.morphAttributes[key][i])
  o.morphTargetDictionary = Object.fromEntries(names.map((name, i) => [name.replace(/^.*\.AK_\d\d_/, ''), i]))
  o.morphTargetInfluences = indices.map(() => 0)
  before.push({ name: o.name, vertices: g.attributes.position.count, triangles: g.attributes.position.count / 3,
    attributes: Object.fromEntries(Object.entries(g.attributes).map(([key, value]) => [key, hash(value)])),
    sourceMorphChannels: Object.keys(dictionary).length, selectedMorphs: names,
    boneNames: o.skeleton.bones.map(b => b.name) })
  o.material = (Array.isArray(o.material) ? o.material : [o.material]).map(m => {
    const part = m.name.includes('opacity') ? 'opacity' : m.name.includes('head') ? 'head' : 'body'
    materialTextures.set(m.name, part)
    return new MeshStandardMaterial({ name: m.name, color: 0xffffff,
      roughness: part === 'body' ? .82 : .68, metalness: 0, alphaTest: part === 'opacity' ? .45 : 0 })
  })
})
scene.userData.crewSource = 'microsoft-rocketbox-medical-female-03'
scene.userData.sourceRevision = '0943055db6ec570bcef9f2c8b41c9e5467c808f9'
const exported = Buffer.from(await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true, animations: [] }))
const jsonLength = exported.readUInt32LE(12), json = JSON.parse(exported.subarray(20, 20 + jsonLength).toString())
const binStart = 20 + jsonLength + 8, chunks = [exported.subarray(binStart)], imageCache = new Map()
let length = chunks[0].length
const pad = buffer => { const out = Buffer.alloc(Math.ceil(buffer.length / 4) * 4); buffer.copy(out); return out }
json.images = []; json.textures = []; json.samplers = [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }]
function texture(name) {
  if (imageCache.has(name)) return imageCache.get(name)
  const data = readFileSync(new URL(`./converted-textures/${name}.png`, root)), buffer = pad(data)
  const bufferView = json.bufferViews.length
  json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: data.length })
  chunks.push(buffer); length += buffer.length
  const index = json.images.length
  json.images.push({ name, bufferView, mimeType: 'image/png' }); json.textures.push({ sampler: 0, source: index })
  imageCache.set(name, index); return index
}
for (const material of json.materials) {
  const part = materialTextures.get(material.name)
  material.pbrMetallicRoughness.baseColorTexture = { index: texture(part === 'body' ? 'f154_body_color_blue' : `f154_${part}_color`) }
  if (part !== 'opacity') {
    material.normalTexture = { index: texture(`f154_${part}_normal`) }
    material.extensions ??= {}
    material.extensions.KHR_materials_specular = { specularFactor: 1, specularColorTexture: { index: texture(`f154_${part}_specular`) } }
  }
}
json.extensionsUsed = [...new Set([...(json.extensionsUsed ?? []), 'KHR_materials_specular'])]
json.buffers[0].byteLength = length
const jsonBuffer = Buffer.from(JSON.stringify(json)), jsonPadded = Buffer.alloc(Math.ceil(jsonBuffer.length / 4) * 4, 32)
jsonBuffer.copy(jsonPadded)
const binary = Buffer.concat(chunks), header = Buffer.alloc(20), binHeader = Buffer.alloc(8)
header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + jsonPadded.length + binary.length, 8)
header.writeUInt32LE(jsonPadded.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
binHeader.writeUInt32LE(binary.length); binHeader.writeUInt32LE(0x004e4942, 4)
const result = Buffer.concat([header, jsonPadded, binHeader, binary])
writeFileSync(new URL('./rocketbox-medical-female-03.glb', root), result)
const report = { source: 'original/Export/Medical_Female_03_facial.fbx', meshes: before,
  operation: 'Format conversion; original base attributes, skin weights and bind skeleton preserved. Select existing 52 ARKit morphs; no authored geometry or new weights.',
  textures: 'Lossless PNG; flipped vertically to retain FBX visual orientation with glTF Y origin. Original TGA retained.',
  shading: 'PBR approximation of legacy Phong materials; source colors, normals and specular images retained; alpha cutout for opacity material.',
  file: 'rocketbox-medical-female-03.glb', bytes: result.length, sha256: createHash('sha256').update(result).digest('hex') }
writeFileSync(new URL('./conversion-manifest.json', root), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ bytes: report.bytes, sha256: report.sha256, materials: json.materials.length, morphs: before[0].selectedMorphs.length }))
