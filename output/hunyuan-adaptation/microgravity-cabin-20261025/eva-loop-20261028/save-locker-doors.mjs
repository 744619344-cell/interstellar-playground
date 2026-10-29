import {writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js'
import {Box3,Mesh,Vector3} from 'three'
import {createLockerDoorCandidate,LOCKER_DOOR_FIT} from '../../../../src/features/space-exploration/rendering/spacecraft/microgravityLockerDoorParts.ts'
globalThis.FileReader=class{async readAsArrayBuffer(blob){this.result=await blob.arrayBuffer();this.onloadend?.()}}
const root=createLockerDoorCandidate(),result=await new GLTFExporter().parseAsync(root,{binary:true}),bytes=Buffer.from(result)
const directory=new URL('../../../../src/assets/models/microgravity-cabin-20261025/candidates/locker-doors-v1-20261028/',import.meta.url);await mkdir(directory,{recursive:true});await writeFile(new URL('locker-doors-v1.glb',directory),bytes)
const record={candidate:'locker-doors-v1',authorization:'2026-10-28 four leaves and necessary hinges/local edging',fit:LOCKER_DOOR_FIT,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),closed:new Box3().setFromObject(root).getSize(new Vector3())}
await writeFile(new URL('candidate.json',directory),JSON.stringify(record,null,2));await writeFile(new URL('./locker-door-candidate.json',import.meta.url),JSON.stringify(record,null,2));console.log(JSON.stringify(record))
const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o instanceof Mesh){geometries.add(o.geometry);materials.add(o.material)}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose())
