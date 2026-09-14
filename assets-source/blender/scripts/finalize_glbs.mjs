// Recompute float accessor bounds after Blender's Meshopt exponential quantization.
// This updates the actual artifact, never suppresses validator diagnostics.
import fs from 'node:fs/promises';
import { MeshoptDecoder } from '../../../node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';
await MeshoptDecoder.ready;
const kind=process.argv.includes('--pbr')?'pbr':process.argv.includes('--mechanisms')?'mechanisms':process.argv.includes('--interior')?'interior':'exterior';
for(let lod=0;lod<(kind==='exterior'?3:2);lod++){
  const url=new URL(`../../../src/assets/models/spacecraft-${kind}-lod${lod}.glb`,import.meta.url);
  const bytes=await fs.readFile(url),jsonLength=bytes.readUInt32LE(12);
  const gltf=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
  let bin=bytes.subarray(28+jsonLength);
  // NLA export uses sampled feedback poses as node defaults. Restore the intended idle pose.
  if(['mechanisms','pbr'].includes(kind))for(const node of gltf.nodes){
    if(node.name?.startsWith('ThrusterPlume_'))node.scale=[.001,.001,.001];
    if(node.name?.startsWith('Console_Bar_'))node.scale=[1,1,1];
  }
  if(kind==='pbr'){
    // Embed the exact lossless bakes, avoiding export re-encoding of linear ORM data.
    for(const img of gltf.images){
      const baked=await fs.readFile(new URL(`../spacecraft/pbr/${img.name}.webp`,import.meta.url));
      const view=gltf.bufferViews[img.bufferView];
      if(bin.subarray(view.byteOffset,view.byteOffset+view.byteLength).equals(baked))continue;
      const padding=Buffer.alloc((4-bin.length%4)%4);
      view.byteOffset=bin.length+padding.length;view.byteLength=baked.length;
      bin=Buffer.concat([bin,padding,baked]);
    }
    gltf.buffers[0].byteLength=bin.length;
    bin=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);
    for(const mat of gltf.materials)if(mat.name.startsWith('Atlas_'))
      mat.occlusionTexture={...mat.pbrMetallicRoughness.metallicRoughnessTexture};
  }
  let corrected=0;
  for(const accessor of gltf.accessors){
    const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[accessor.type];
    if(accessor.componentType!==5126 || !components || !accessor.min)continue;
    const view=gltf.bufferViews[accessor.bufferView],ext=view.extensions?.EXT_meshopt_compression;
    if(!ext)continue;
    const decoded=await MeshoptDecoder.decodeGltfBufferAsync(ext.count,ext.byteStride,
      bin.subarray(ext.byteOffset,ext.byteOffset+ext.byteLength),ext.mode,ext.filter);
    const data=new DataView(decoded.buffer,decoded.byteOffset,decoded.byteLength);
    const min=Array(components).fill(Infinity),max=Array(components).fill(-Infinity);
    for(let i=0;i<accessor.count;i++)for(let k=0;k<components;k++){
      const value=data.getFloat32((accessor.byteOffset||0)+i*ext.byteStride+k*4,true);
      if(!Number.isFinite(value))throw new Error('Nonfinite decoded vertex');
      min[k]=Math.min(min[k],value);max[k]=Math.max(max[k],value);
    }
    accessor.min=min;accessor.max=max;corrected++;
  }
  const json=Buffer.from(JSON.stringify(gltf));
  const padded=Buffer.alloc(Math.ceil(json.length/4)*4,0x20);json.copy(padded);
  const header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);
  header.writeUInt32LE(28+padded.length+bin.length,8);
  header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
  binHeader.writeUInt32LE(bin.length,0);binHeader.writeUInt32LE(0x004e4942,4);
  await fs.writeFile(url,Buffer.concat([header,padded,binHeader,bin]));
  console.log(`LOD${lod}: ${corrected} compressed accessor bounds recomputed`);
}
