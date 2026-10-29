import { readFile } from 'node:fs/promises'
import { Box3, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { loadMicrogravityAssembly } from '../../../src/features/space-exploration/rendering/spacecraft/microgravityAssembly.ts'
import { MicrogravityCabinRuntime } from '../../../src/features/space-exploration/rendering/spacecraft/microgravityCabinRuntime.ts'
import { disposeShipModel } from '../../../src/features/space-exploration/rendering/spacecraft/shipModelRuntime.ts'
import { createCabinFloat } from '../../../src/features/space-exploration/domain/cabinFloatMotion.ts'

const loader = new GLTFLoader()
loader.register(parser => { parser.loadTextureImage = async () => new Texture(); return { name: 'source_geometry' } })
const asset = await loadMicrogravityAssembly(new AbortController().signal, disposeShipModel, async url => {
  const bytes = await readFile(new URL(url)); return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
})
try {
  for (const name of ['reused-seat--1', 'reused-seat-1']) {
    const box = new Box3().setFromObject(asset.scene.getObjectByName(name), true)
    const position = box.getCenter(new Vector3()).setY(-.65).setZ(-4.6); position.x = Math.sign(position.x) * 1.6
    const cabin = new MicrogravityCabinRuntime(asset.scene, { float: createCabinFloat(position) })
    cabin.update(1 / 60, { forward: 0, right: 0 }, 0, true, false, true)
    const stations = cabin.stations, station = stations.stations.find(s => s.id === name), rig = cabin.rig
    const surface = stations.surface(station, position, rig), contact = stations.contactFor(name, cabin.snapshot().float, rig)
    const origins = rig.reachVolumes(), candidates = []
    for (const origin of origins) for (let i = 0; i < station.points.length; i += 3) {
      const point = new Vector3().fromArray(station.points, i), distance = point.distanceTo(origin.shoulder)
      if (distance >= origin.minimum && distance <= origin.maximum) candidates.push({ point, from: origin.shoulder, distance })
    }
    candidates.sort((a, b) => a.distance - b.distance)
    const closest = candidates[0], hit = closest && cabin.surfaces.cast(closest.from, closest.point.clone().addScaledVector(closest.point.clone().sub(closest.from).normalize(), .03))
    console.log(JSON.stringify({ name, prompt: cabin.snapshot().prompt?.deviceId, surface: surface?.point, contact: contact?.point, closest: closest?.point, hit: hit && { point: hit.point, owner: hit.owner.name, parent: hit.owner.parent?.name }, reach: origins.map(o => ({ minimum: o.minimum, maximum: o.maximum })) }))
    cabin.dispose()
  }
} finally { disposeShipModel(asset.scene) }
