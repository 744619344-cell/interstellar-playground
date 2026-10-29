import {readFile,writeFile} from 'node:fs/promises'
import {Mesh,Texture,Group,Box3,Vector3} from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
const prefix='../../../../src/assets/models/microgravity-cabin-20261025/',bytes=await readFile(new URL(prefix+'locker-v1.glb',import.meta.url)),layout=JSON.parse(await readFile(new URL(prefix+'layout-candidate.json',import.meta.url)))
const loader=new GLTFLoader();loader.register(p=>{p.loadTextureImage=async()=>new Texture();return{name:'readonly_source'}})
const source=(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene,root=new Group(),placement=layout.placements.find(p=>p.name==='micro-locker');root.position.fromArray(placement.offset);root.rotation.y=placement.yaw;root.scale.setScalar(placement.scale);root.add(source);root.updateMatrixWorld(true)
const results=[]
root.traverse(o=>{if(!(o instanceof Mesh))return;const g=o.geometry,p=g.getAttribute('position'),idx=g.index,parents=Array.from({length:p.count},(_,i)=>i),find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i]}return i},join=(a,b)=>parents[find(a)]=find(b)
for(let i=0;i<idx.count;i+=3){join(idx.getX(i),idx.getX(i+1));join(idx.getX(i+1),idx.getX(i+2))}
const components=new Map();for(let i=0;i<p.count;i++){const id=find(i);let c=components.get(id);if(!c){c={id,count:0,box:new Box3()};components.set(id,c)}c.count++;c.box.expandByPoint(new Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld))}
results.push({name:o.name,vertices:p.count,triangles:idx.count/3,bounds:new Box3().setFromObject(o,true),components:[...components.values()].sort((a,b)=>b.count-a.count).map(c=>({id:c.id,vertices:c.count,min:c.box.min.toArray(),max:c.box.max.toArray(),size:c.box.getSize(new Vector3()).toArray()}))})})
await writeFile(new URL('./locker-source-components.json',import.meta.url),JSON.stringify({method:'Original source indexed components and actual placement only; no geometry modification',results},null,2));console.log(JSON.stringify(results.map(r=>({...r,components:r.components.slice(0,15)})),null,2))
