import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Box3, LoadingManager, Texture, Vector3 } from 'three'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'

export function readCharacter(name = 'Medical_Female_03_facial.fbx') {
  const manager = new LoadingManager()
  manager.addHandler(/\.tga$/i, { setPath() { return this }, load(url) {
    const texture = new Texture(); texture.name = url.split(/[\\/]/).at(-1)
    return texture
  } })
  const file = readFileSync(new URL(`./original/Export/${name}`, import.meta.url))
  return new FBXLoader(manager).parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')
}

export function inspect(scene) {
  scene.updateMatrixWorld(true)
  const bones = [], meshes = [], materials = new Map()
  scene.traverse(o => {
    if (o.isBone) bones.push({ name: o.name, parent: o.parent?.name,
      position: o.getWorldPosition(new Vector3()).toArray(), local: o.position.toArray(), quaternion: o.quaternion.toArray() })
    if (o.isMesh) {
      const geometry = o.geometry
      const slots = Array.isArray(o.material) ? o.material : [o.material]
      meshes.push({ name: o.name, vertices: geometry.attributes.position.count,
        triangles: (geometry.index?.count ?? geometry.attributes.position.count) / 3,
        materials: slots.map(m => m.name), morphs: o.morphTargetDictionary,
        bones: o.skeleton?.bones.map(b => b.name), visible: o.visible,
        bounds: new Box3().setFromObject(o, true).getSize(new Vector3()).toArray() })
      for (const m of slots) materials.set(m.name, { name: m.name, type: m.type, opacity: m.opacity,
        map: m.map?.name, normalMap: m.normalMap?.name, specularMap: m.specularMap?.name })
    }
  })
  return { bones, meshes, materials: [...materials.values()], animations: scene.animations.map(a => ({ name: a.name, duration: a.duration, tracks: a.tracks.map(t => t.name) })) }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const name of ['Medical_Female_03.fbx', 'Medical_Female_03_facial.fbx']) {
    const report = inspect(readCharacter(name))
    writeFileSync(new URL(`./${name}.audit.json`, import.meta.url), JSON.stringify(report, null, 2) + '\n')
    console.log(name, JSON.stringify({ bones: report.bones.map(b => b.name), meshes: report.meshes.map(m => ({ ...m, bones: m.bones?.length, morphs: Object.keys(m.morphs ?? {}) })), materials: report.materials, animations: report.animations.map(a => a.name) }))
  }
}
