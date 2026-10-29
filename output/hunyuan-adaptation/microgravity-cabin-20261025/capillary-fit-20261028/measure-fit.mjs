import { readFile, writeFile } from 'node:fs/promises'
import { Texture, Vector3, Box3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { loadMicrogravityAssembly } from '../../../../src/features/space-exploration/rendering/spacecraft/microgravityAssembly.ts'
import { MicrogravitySurfaces } from '../../../../src/features/space-exploration/rendering/spacecraft/microgravitySurfaces.ts'
import { disposeShipModel } from '../../../../src/features/space-exploration/rendering/spacecraft/shipModelRuntime.ts'
const loader=new GLTFLoader();loader.register(p=>{p.loadTextureImage=async()=>new Texture();return{name:'source_measurement'}})
const asset=await loadMicrogravityAssembly(new AbortController().signal,disposeShipModel,async url=>{const b=await readFile(new URL(url));return loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')})
const under=(o,root)=>{for(let p=o;p;p=p.parent)if(p===root)return true;return false},surfaces=new MicrogravitySurfaces(asset.scene),work=asset.scene.getObjectByName('micro-work'),bounds=new Box3().setFromObject(work,true),grid=[]
try{
 for(let iy=0;iy<=36;iy++)for(let iz=0;iz<=24;iz++){
  const y=-1.3+iy*.05,z=-1.68+iz*.0475,hit=surfaces.cast(new Vector3(0,y,z),new Vector3(2.6,y,z))
  grid.push({y,z,point:hit?.point,normal:hit?.normal,work:!!hit&&under(hit.owner,work),owner:hit?.owner.name,triangle:hit?.triangle})
 }
 const result={method:'Read-only rays from cabin centre toward actual source surfaces, 5cm vertical /4.75cm longitudinal spacing. No fixture or geometry authored. Finite samples only.',bounds,grid,grips:surfaces.grips.filter(g=>g.id.startsWith('micro-work')||g.id.startsWith('micro-starboard-liner'))}
 await writeFile(new URL('./source-grid.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify({bounds,rows:[.4,.2,0,-.2,-.4,-.6,-.8,-1].map(y=>({y,points:grid.filter(p=>Math.abs(p.y-y)<.001&&p.work).filter((_,i)=>i%3===0).map(p=>({z:+p.z.toFixed(2),x:+p.point.x.toFixed(3)}))}))},null,2))
}finally{surfaces.dispose();disposeShipModel(asset.scene)}
