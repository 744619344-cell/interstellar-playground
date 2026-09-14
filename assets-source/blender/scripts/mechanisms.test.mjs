import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Raycaster,Vector3,DoubleSide} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {MechanismPlayer} from '../spacecraft/mechanisms/mechanismPlayer.mjs';

const templates=[];
const kind=process.argv.includes('--pbr')?'pbr':'mechanisms';
for(let lod=0;lod<2;lod++){
 const bytes=await fs.readFile(new URL(`../../../src/assets/models/spacecraft-${kind}-lod${lod}.glb`,import.meta.url));
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
 // Geometry/animation suite only; actual WebP loading and color spaces are tested in the browser.
 if(kind==='pbr')loader.register(parser=>{parser.loadTextureImage=async()=>null;return {name:'GeometryOnlyTextures'};});
 templates.push(await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''));
}
function fixture(){const entries=templates.map(t=>({scene:t.scene.clone(true),animations:t.animations}));return {entries,player:new MechanismPlayer(entries)};}
function advance(player,seconds){for(let t=0;t<seconds;t+=.025)player.update(.025);}
function pose(scene,name){const obj=scene.getObjectByName(name);return [...obj.position.toArray(),...obj.quaternion.toArray(),...obj.scale.toArray()];}
function close(a,b,tolerance=1e-5){assert.equal(a.length,b.length);a.forEach((v,i)=>assert(Math.abs(v-b[i])<tolerance,`${v} != ${b[i]}`));}
function blocked(scene,door){
 scene.updateMatrixWorld(true);const meshes=[],materials=new Map();
 scene.traverse(obj=>{if(obj.isMesh&&!/^(ThrusterPlume|Console_Bar)/.test(obj.name)){meshes.push(obj);materials.set(obj.material,obj.material.side);}});
 for(const mat of materials.keys())mat.side=DoubleSide;
 let count=0;
 for(const x of [-.45,0,.45])for(let i=0;i<5;i++){
  const y=(door==='outer'?-1.11:-1.2)+i*2.1/4;
  // Cross the outer liner at Z=7.25, ending at 7.20 before the cabin ceiling at 7.134.
  // This checks the door aperture; the lower cabin ceiling has its own corridor clearance check.
  const ray=new Raycaster(new Vector3(x,y,door==='outer'?9:3.8),new Vector3(0,0,door==='outer'?-1:1),0,door==='outer'?1.8:2.2);
  const hits=ray.intersectObjects(meshes,false);
  if(hits.length){count++;if(process.env.DEBUG_MECHANISMS)console.log(door,x,y,hits[0].object.name,hits[0].point.toArray());}
 }
 for(const [mat,side] of materials)mat.side=side;
 return count;
}

test('six exported clips have isolated mechanism channels and bounded durations',()=>{
 for(const {animations} of templates){
  assert.equal(animations.length,6);
  for(const clip of animations){
   assert(clip.duration>0&&clip.duration<=2.001);
   for(const track of clip.tracks)assert(/^(Rig_|Console_Bar_|ThrusterPlume_)/.test(track.name));
  }
 }
});
test('closed doors block every sampled portal ray in both LODs',()=>{
 const {entries,player}=fixture();
 for(const {scene} of entries){assert.equal(blocked(scene,'outer'),15);assert.equal(blocked(scene,'inner'),15);}
 player.dispose();
});
test('outer door and lining clear the actual cut aperture; other door stays closed',()=>{
 const {entries,player}=fixture();assert(player.commandDoor('outer',true));advance(player,1.4);
 for(const {scene} of entries)assert.equal(blocked(scene,'outer'),0);
 assert.equal(player.commandDoor('inner',true),false);
 assert.equal(player.doors.inner.progress,0);
 player.commandDoor('outer',false);advance(player,1.4);
 for(const {scene} of entries)assert.equal(blocked(scene,'outer'),15);
 player.dispose();
});
test('inner plug and swing leave the sampled passage clear in both LODs',()=>{
 const {entries,player}=fixture();player.commandDoor('inner',true);advance(player,1.4);
 for(const {scene} of entries)assert.equal(blocked(scene,'inner'),0);
 assert.equal(player.commandDoor('outer',true),false);
 player.commandDoor('inner',false);advance(player,1.4);
 for(const {scene} of entries)assert.equal(blocked(scene,'inner'),15);
 player.dispose();
});
test('reversing at intermediate progress does not snap; repeated target is stable',()=>{
 const {entries,player}=fixture();
 for(const name of ['outer','inner'])for(const progress of [.15,.37,.72]){
  player.reset();player.doors[name]={progress,target:1};player.apply();
  const rig=name==='outer'?'Rig_OuterDoor':'Rig_InnerDoor';
  const before=entries.map(e=>pose(e.scene,rig));
  player.commandDoor(name,false);
  entries.forEach((e,i)=>close(pose(e.scene,rig),before[i],.002));
  const after=entries.map(e=>pose(e.scene,rig));player.commandDoor(name,false);
  entries.forEach((e,i)=>close(pose(e.scene,rig),after[i]));
 }
 player.dispose();
});
test('pause, hidden time, invalid delta and long frame cannot advance unexpectedly',()=>{
 const {player}=fixture();player.commandDoor('outer',true);player.update(.05);
 let baseline=player.snapshot();player.paused=true;advance(player,3);assert.equal(player.time,baseline.time);
 player.paused=false;player.suspended=true;advance(player,3);assert.equal(player.time,baseline.time);
 player.suspended=false;for(const dt of [NaN,Infinity,-1,0])player.update(dt);
 assert.equal(player.time,baseline.time);player.update(100);
 assert(Math.abs(player.time-baseline.time-.05)<1e-8);player.dispose();
});
test('feedback targets are isolated and reset restores exact rest transforms',()=>{
 const {entries,player}=fixture();const names=['Console_Bar_0','ThrusterPlume_1','Rig_OuterDoor','Rig_InnerDoor','Anchor_EVA'];
 const rest=entries.map(e=>names.map(n=>pose(e.scene,n)));
 for(const {scene} of entries){
  close(scene.getObjectByName('ThrusterPlume_1').scale.toArray(),[.001,.001,.001]);
  close(scene.getObjectByName('ThrusterPlume_-1').scale.toArray(),[.001,.001,.001]);
  close(scene.getObjectByName('Console_Bar_0').scale.toArray(),[1,1,1]);
 }
 player.console=true;player.thrust=true;player.commandDoor('outer',true);advance(player,.6);
 assert.notDeepEqual(pose(entries[0].scene,'Console_Bar_0'),rest[0][0]);
 assert.notDeepEqual(pose(entries[0].scene,'ThrusterPlume_1'),rest[0][1]);
 close(pose(entries[0].scene,'Anchor_EVA'),rest[0][4]);
 player.reset();entries.forEach((e,i)=>names.forEach((n,j)=>close(pose(e.scene,n),rest[i][j])));player.dispose();
});
test('both LODs retain identical mechanism poses throughout playback',()=>{
 const {entries,player}=fixture();player.console=true;player.thrust=true;player.commandDoor('outer',true);
 for(let i=0;i<45;i++){player.update(.04);for(const name of ['Rig_OuterDoor','Rig_InnerDoor','Console_Bar_0','ThrusterPlume_1'])close(pose(entries[0].scene,name),pose(entries[1].scene,name));}
 player.dispose();
});
