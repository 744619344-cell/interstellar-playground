const slots=['map','aoMap','roughnessMap','metalnessMap','emissiveMap'];
export function shareAtlasTextures(entries){
 const cache=new Map(),discarded=new Set();
 for(const {scene} of entries)scene.traverse(o=>{
  if(!o.isMesh)return;
  for(const slot of slots){
   const texture=o.material[slot];if(!texture)continue;
   const key=`${texture.name}:${texture.colorSpace}:${texture.channel}`;
   if(!cache.has(key))cache.set(key,texture);
   else if(cache.get(key)!==texture){discarded.add(texture);o.material[slot]=cache.get(key);}
  }
 });
 const retainedImages=new Set([...cache.values()].map(t=>t.image));
 const discardedImages=new Set();
 for(const texture of discarded){texture.dispose();if(!retainedImages.has(texture.image))discardedImages.add(texture.image);}
 for(const bitmap of discardedImages)bitmap.close?.();
 return [...cache.values()].map(t=>({name:t.name,colorSpace:t.colorSpace,width:t.image.width,height:t.image.height}));
}
export function disposeTextures(materials){
 const textures=new Set(),images=new Set();
 for(const material of materials)for(const slot of slots)if(material[slot])textures.add(material[slot]);
 for(const texture of textures){images.add(texture.image);texture.dispose();}
 for(const bitmap of images)bitmap?.close?.();
}
export function disposeAssets(entries){
 const geometries=new Set(),materials=new Set();
 for(const {scene} of entries)scene.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);}});
 geometries.forEach(o=>o.dispose());disposeTextures(materials);materials.forEach(o=>o.dispose());
}
