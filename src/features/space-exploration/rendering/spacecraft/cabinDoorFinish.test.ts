import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Mesh,Texture } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { CabinDoorFinish } from './cabinDoorFinish'
import { disposeShipModel } from './shipModelRuntime'

test('hatch surface finish preserves actual geometry/source materials and releases only its variants',async()=>{
 const bytes=await readFile(new URL('../../../../assets/models/current-ship-20261022/aft-door-d2.glb',import.meta.url)),loader=new GLTFLoader()
 loader.register(parser=>{parser.loadTextureImage=async()=>new Texture();return {name:'actual_geometry_without_images'}})
 const {scene}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,'')
 const sources:{mesh:Mesh;material:Mesh['material'];geometry:Mesh['geometry'];positions:unknown;normals:unknown}[]=[]
 scene.traverse(o=>{if(o instanceof Mesh)sources.push({mesh:o,material:o.material,geometry:o.geometry,positions:o.geometry.getAttribute('position').array,normals:o.geometry.getAttribute('normal').array})})
 const finish=new CabinDoorFinish(scene),derived=new Set<Exclude<Mesh['material'],unknown[]>>()
 for(const s of sources){
  assert.equal(s.mesh.geometry,s.geometry);assert.equal(s.mesh.geometry.getAttribute('position').array,s.positions);assert.equal(s.mesh.geometry.getAttribute('normal').array,s.normals)
  if(s.mesh.material!==s.material)for(const m of Array.isArray(s.mesh.material)?s.mesh.material:[s.mesh.material])derived.add(m)
 }
 assert(derived.size>=5)
 let released=0;for(const m of derived)m.addEventListener('dispose',()=>released++)
 finish.dispose();finish.dispose();assert.equal(released,derived.size)
 for(const s of sources)assert.equal(s.mesh.material,s.material)
 disposeShipModel(scene)
})
