import { readFile, writeFile } from 'node:fs/promises'
import { Box3, Texture, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { loadMicrogravityAssembly } from '../../../../src/features/space-exploration/rendering/spacecraft/microgravityAssembly.ts'
import { disposeShipModel } from '../../../../src/features/space-exploration/rendering/spacecraft/shipModelRuntime.ts'
const loader=new GLTFLoader();loader.register(p=>{p.loadTextureImage=async()=>new Texture();return{name:'read_only_dimensions'}})
const asset=await loadMicrogravityAssembly(new AbortController().signal,disposeShipModel,async url=>{const b=await readFile(new URL(url));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')})
try{const box=new Box3().setFromObject(asset.scene.getObjectByName('micro-work'),true),size=box.getSize(new Vector3());await writeFile(new URL('./workstation-source.json',import.meta.url),JSON.stringify({method:'Read-only source world bounding box in cabin metres. Not a flat mounting surface or a clearance pass.',id:'micro-work',min:box.min,max:box.max,size,proposedDeviceMillimeters:{width:320,height:240,depth:120},fit:'unverified; inspect actual source face and native hands before any 3D placement'},null,2));console.log(JSON.stringify({size}))}finally{disposeShipModel(asset.scene)}
