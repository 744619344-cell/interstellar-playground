// Use the existing validator installation specified by GLTF_VALIDATOR_PATH.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { MeshoptDecoder } from '../../../node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';

const require = createRequire(import.meta.url);
const validator = require(process.env.GLTF_VALIDATOR_PATH || 'gltf-validator');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const reports = [];
const kind=process.argv.includes('--pbr')?'pbr':process.argv.includes('--mechanisms')?'mechanisms':process.argv.includes('--interior')?'interior':'exterior';
const animated=['mechanisms','pbr'].includes(kind);
let reference;
await MeshoptDecoder.ready;

async function validateDecoded(gltf,bytes) {
  const decoded = structuredClone(gltf);
  const binaryStart = 20+bytes.readUInt32LE(12)+8;
  const binary = bytes.subarray(binaryStart);
  const chunks = [];
  let offset = 0;
  for (const view of decoded.bufferViews) {
    const ext = view.extensions?.EXT_meshopt_compression;
    const data = ext ? await MeshoptDecoder.decodeGltfBufferAsync(ext.count,ext.byteStride,
      binary.subarray(ext.byteOffset,ext.byteOffset+ext.byteLength),ext.mode,ext.filter)
      : binary.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
    const padding = (4-offset%4)%4;
    chunks.push(Buffer.alloc(padding),Buffer.from(data));
    offset += padding;
    view.buffer = 0;
    view.byteOffset = offset;
    view.byteLength = data.length;
    offset += data.length;
    delete view.extensions;
  }
  decoded.buffers = [{byteLength:offset,uri:'decoded.bin'}];
  decoded.extensionsUsed = decoded.extensionsUsed.filter(x=>x!=='EXT_meshopt_compression');
  decoded.extensionsRequired = decoded.extensionsRequired?.filter(x=>x!=='EXT_meshopt_compression');
  if (!decoded.extensionsRequired?.length) delete decoded.extensionsRequired;
  const buffer = Buffer.concat(chunks);
  return validator.validateString(JSON.stringify(decoded), {
    maxIssues:100, externalResourceFunction:async()=>new Uint8Array(buffer)});
}
for (let lod=0; lod<(kind==='exterior'?3:2); lod++) {
  const relative = `src/assets/models/spacecraft-${kind}-lod${lod}.glb`;
  const bytes = await fs.readFile(path.join(root, relative));
  const gltf = JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
  const report = await validator.validateBytes(new Uint8Array(bytes), {maxIssues:100});
  const decodedReport = await validateDecoded(gltf,bytes);
  const nodes = new Map(gltf.nodes.map(node=>[node.name,node]));
  if(kind==='interior'){
    const exteriorBytes=await fs.readFile(path.join(root,'src/assets/models/spacecraft-exterior-lod0.glb'));
    const exterior=JSON.parse(exteriorBytes.subarray(20,20+exteriorBytes.readUInt32LE(12)).toString());
    for(const name of ['Seat_Pilot','Seat_Copilot','Anchor_CockpitCamera']){
      assert.deepEqual(nodes.get(name)?.translation,exterior.nodes.find(n=>n.name===name)?.translation,
        `Interior ${name} must align with the accepted exterior`);
    }
  }
  const required=animated?['Rig_OuterDoor','Rig_InnerDoor','Console_Bar_0','ThrusterPlume_-1','ThrusterPlume_1']:
    kind==='interior'?['Door_Inner','Seat_Pilot','Seat_Copilot',
    'Anchor_CockpitCamera','Anchor_StandUp','Anchor_Living','Anchor_Airlock']:
    ['Door_Outer','Canopy_Glass','Anchor_EVA','Anchor_Tether',
    'Anchor_CockpitCamera','Anchor_ThirdPersonCamera','Thruster_Main_-1','Thruster_Main_1','Collider_Hull'];
  for (const name of required) {
    assert(nodes.has(name), `LOD${lod} missing ${name}`);
  }
  const anchors = gltf.nodes.filter(node=>/^(Anchor_|Thruster_|Seat_|Collider_)/.test(node.name))
    .map(({name,translation,rotation,scale,extras})=>({name,translation,rotation,scale,extras}));
  if (reference) assert.deepEqual(anchors,reference,'LOD anchor transforms must match');
  else reference = anchors;
  if(animated){
    assert.deepEqual(gltf.animations.map(a=>a.name).sort(),
      ['ConsoleActive','InnerDoorClose','InnerDoorOpen','OuterDoorClose','OuterDoorOpen','ThrusterBurn']);
    for(const animation of gltf.animations)for(const channel of animation.channels){
      assert(/^(Rig_(Inner|Outer)Door|Console_Bar_\d|ThrusterPlume_(-1|1))$/.test(gltf.nodes[channel.target.node].name));
    }
  }else assert.equal(gltf.animations?.length || 0,0);
  assert.equal(gltf.cameras?.length || 0,0);
  assert.equal(gltf.images?.length || 0,kind==='pbr'?6:0);
  if(kind==='pbr'){
    assert.equal(gltf.materials.length,3);
    assert(gltf.images.every(i=>i.mimeType==='image/webp'));
    assert(gltf.meshes.length<=24);
    for(const mat of gltf.materials.filter(m=>m.name.startsWith('Atlas_')))
      assert.deepEqual(mat.occlusionTexture,mat.pbrMetallicRoughness.metallicRoughnessTexture);
  }
  assert(gltf.extensionsUsed.includes('EXT_meshopt_compression') || gltf.extensionsUsed.includes('KHR_meshopt_compression'));
  const result = {path:relative,bytes:bytes.length,issues:report.issues,decodedIssues:decodedReport.issues,
    extensions:gltf.extensionsUsed,materials:gltf.materials.length,meshes:gltf.meshes.length,
    animations:gltf.animations?.map(a=>({name:a.name,channels:a.channels.length}))||[]};
  reports.push(result);
  console.log(JSON.stringify(result));
}
await fs.writeFile(path.join(root,`assets-source/blender/spacecraft/${kind==='exterior'?'':kind+'/'}gltf-report.json`),JSON.stringify(reports,null,2));
assert(reports.every(report=>report.issues.numErrors===0 && report.decodedIssues.numErrors===0),
  'glTF errors require repair');
