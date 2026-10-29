import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { loadMicrogravityAssembly } from '../../src/features/space-exploration/rendering/spacecraft/microgravityAssembly'
import { disposeShipModel } from '../../src/features/space-exploration/rendering/spacecraft/shipModelRuntime'
import { MicrogravitySurfaces } from '../../src/features/space-exploration/rendering/spacecraft/microgravitySurfaces'

const root = 'output/hunyuan-adaptation/microgravity-cabin-20261025/seat-control-20261029'
const capture = JSON.parse(await readFile(`${root}/actual-full-pose.json`, 'utf8'))
const probe = capture.collisionProbe
if (!probe?.samples?.length) throw Error('missing real body samples')
const loader = new GLTFLoader(); loader.register(p => { p.loadTextureImage = async () => new Texture(); return { name: 'read_only_pose_check' } })
const asset = await loadMicrogravityAssembly(new AbortController().signal, disposeShipModel, async url => {
  const bytes = await readFile(new URL(url)); return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
})
const surface = new MicrogravitySurfaces(asset.scene), length = .5
const points = probe.samples.map((p: any) => new Vector3(p.x, p.y, p.z))
const directions = [...Array.from({length: 24}, (_, i) => ({ angle: i * Math.PI / 12, direction: new Vector3(Math.cos(i*Math.PI/12),0,Math.sin(i*Math.PI/12)) })),
  { angle: null, direction: new Vector3(0,1,0) }, { angle: null, direction: new Vector3(0,-1,0) }]
try {
  const clearance = directions.map(({angle,direction}) => {
    let best: any, sample = -1
    for (let i=0;i<points.length;i++) {
      const hit = surface.cast(points[i], points[i].clone().addScaledVector(direction,length))
      if (hit && (!best || hit.distance < best.distance)) { best = hit; sample = i }
    }
    return { angle, direction: direction.toArray(), safeDistance: best ? Math.max(0,best.distance-.004) : length,
      obstacle: best ? { owner: best.owner.name, triangle: best.triangle, sample, hit: best.point, normal: best.normal } : null }
  })
  const output = { note: 'Fixed instantaneous live skin samples swept against static source surfaces; not a dynamic animation or whole-path guarantee.', captured: { from: probe.from, owner: probe.owner, identity: probe.identity, sampleCount: points.length, yaw: capture.view.yaw }, clearance }
  await mkdir('.cache', { recursive: true }); await writeFile('.cache/seat-handoff-pose-clearance.json', JSON.stringify(output,null,2)); process.stdout.write(JSON.stringify(output,null,2))
} finally { surface.dispose(); disposeShipModel(asset.scene) }
