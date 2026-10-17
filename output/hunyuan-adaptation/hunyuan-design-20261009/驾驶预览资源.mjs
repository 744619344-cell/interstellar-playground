// Own existing GLTF resources only; never construct or change model geometry.
function releaseRoots(roots){
 const geometries=new Set(),materials=new Set(),textures=new Set(),images=new Set(),skeletons=new Set();
 for(const root of roots)root.traverse(object=>{
  if(object.geometry)geometries.add(object.geometry);
  if(object.skeleton)skeletons.add(object.skeleton);
  for(const material of [].concat(object.material??[]))if(material)materials.add(material);
 });
 for(const material of materials)for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
 for(const texture of textures){
  for(const image of [].concat(texture.source?.data??texture.image??[]))if(image)images.add(image);
  texture.dispose();
 }
 images.forEach(image=>image.close?.());skeletons.forEach(skeleton=>skeleton.dispose());
 materials.forEach(material=>material.dispose());geometries.forEach(geometry=>geometry.dispose());
 for(const root of roots)root.removeFromParent();
}

const cancelled=()=>new DOMException('预览已退出','AbortError');
const describe=url=>decodeURI(url).replace(/^\.\//,'');

export function createPreviewAssets({parse,baseUrl,request=globalThis.fetch,progress=()=>{}}){
 const aborter=new AbortController(),roots=new Set();
 let disposed=false;
 function active(){if(disposed)throw cancelled();}
 function failure(error,url){
  if(disposed||error.name==='AbortError')return cancelled();
  return new Error(`${describe(url)}：${error.message}`,{cause:error});
 }
 async function read(url,type){
  active();progress(url,type==='json'?'读取安装记录':'下载模型');
  try{
   const response=await request(url,{signal:aborter.signal});active();
   if(!response.ok)throw new Error(`HTTP ${response.status}`);
   const result=await (type==='json'?response.json():response.arrayBuffer());active();return result;
  }catch(error){throw failure(error,url);}
 }
 async function original(url){
  const bytes=await read(url,'model');active();progress(url,'解析模型');
  let asset;
  try{asset=await parse(bytes,new URL('.',new URL(url,baseUrl)).href);}
  catch(error){throw failure(error,url);}
  if(disposed){releaseRoots([asset.scene]);throw cancelled();}
  roots.add(asset.scene);return asset.scene;
 }
 return {
  json:url=>read(url,'json'),original,
  dispose(){
   if(disposed)return;
   disposed=true;aborter.abort();releaseRoots(roots);roots.clear();
  }
 };
}
