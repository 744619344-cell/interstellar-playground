import { CanvasTexture,Mesh,MeshStandardMaterial,SRGBColorSpace,Vector2,Vector3,type Group,type Material } from 'three'

type Shader=Parameters<MeshStandardMaterial['onBeforeCompile']>[0]
type Role='frame'|'leaf'|'cut'|'button'
function labelTexture(button=false){
 if(typeof document==='undefined')return undefined
 const canvas=document.createElement('canvas');canvas.width=button?128:768;canvas.height=button?128:192
 const ctx=canvas.getContext('2d');if(!ctx)return undefined
 ctx.fillStyle=button?'#173f49':'#16252b';ctx.fillRect(0,0,canvas.width,canvas.height)
 ctx.strokeStyle='#abc2c6';ctx.lineWidth=3;ctx.strokeRect(5,5,canvas.width-10,canvas.height-10)
 ctx.textAlign='center';ctx.fillStyle='#e7eeee'
 if(button){ctx.font='bold 65px system-ui';ctx.fillText('↕',64,78);ctx.font='bold 18px system-ui';ctx.fillText('DOOR',64,108)}
 else {ctx.font='600 31px system-ui';ctx.fillText('EXTERIOR HATCH',384,53);ctx.font='600 62px system-ui';ctx.fillText('01   /   CABIN EXIT',384,126);ctx.fillStyle='#e1b75c';ctx.font='21px system-ui';ctx.fillText('KEEP CLEAR OF DOOR SWING',384,166)}
 const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.anisotropy=4;return texture
}

function shaderFinish(shader:Shader,role:Role,min:Vector2,size:Vector2,depth:Vector2,texture?:CanvasTexture){
 Object.assign(shader.uniforms,{hatchMin:{value:min},hatchSize:{value:size},hatchDepth:{value:depth}})
 if(texture)shader.uniforms.hatchLabel={value:texture}
 const axis=role==='button'?'position.xy':'vec2(position.x,-position.z)'
 shader.vertexShader='varying vec2 vHatchUv;varying float vHatchDepth;varying vec3 vHatchRawNormal;uniform vec2 hatchMin,hatchSize,hatchDepth;\n'+shader.vertexShader
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vHatchUv=(${axis}-hatchMin)/hatchSize;vHatchDepth=(position.y-hatchDepth.x)/max(hatchDepth.y,0.00001);vHatchRawNormal=normal;`)
 shader.fragmentShader='varying vec2 vHatchUv;varying float vHatchDepth;varying vec3 vHatchRawNormal;\n'+(texture?'uniform sampler2D hatchLabel;\n':'')+shader.fragmentShader
 let paint=''
 if(role==='cut')paint=`float d=clamp(vHatchDepth,0.0,1.0);
 float gasket=smoothstep(.15,.18,d)*(1.0-smoothstep(.31,.34,d));
 vec3 metal=vec3(.22,.27,.29)*(1.0+.025*sin(d*180.0));
 diffuseColor.rgb=mix(metal,vec3(.018,.027,.031),gasket);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.53,.59,.60),1.0-smoothstep(.035,.075,d));
 if(abs(vHatchRawNormal.z)>.7&&vHatchUv.y<.09&&d<.14){float stripe=step(.5,fract(vHatchUv.x*20.0));diffuseColor.rgb=mix(vec3(.035),vec3(.55,.36,.055),stripe);}`
 if(texture&&role==='leaf')paint+=`vec2 uv=(vHatchUv-vec2(.5,.72))/vec2(.72,.09)+.5;if(vHatchRawNormal.y<0.0)uv.x=1.0-uv.x;
 float mask=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0)*step(.5,abs(vHatchRawNormal.y));
 vec4 ink=texture2D(hatchLabel,clamp(uv,0.0,1.0));diffuseColor.rgb=mix(diffuseColor.rgb,ink.rgb,mask*ink.a);`
 if(texture&&role==='button')paint+=`vec2 uv=vHatchUv;if(vHatchRawNormal.z<0.0)uv.x=1.0-uv.x;float mask=step(.6,abs(vHatchRawNormal.z));vec4 ink=texture2D(hatchLabel,clamp(uv,0.0,1.0));diffuseColor.rgb=mix(diffuseColor.rgb,ink.rgb,mask);`
 shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+paint)
 shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=max(roughnessFactor,'+(role==='cut'?'.48':'.43')+');')
}

/** Surface-only finish on the existing authorized hatch: no vertex, UV or topology edits. */
export class CabinDoorFinish {
 private originals:{mesh:Mesh;material:Material|Material[]}[]=[]
 private owned=new Set<Material>()
 private textures:CanvasTexture[]=[]
 constructor(model:Group){
  const label=labelTexture(),button=labelTexture(true);if(label)this.textures.push(label);if(button)this.textures.push(button)
  for(const [name,baseRole]of [['AftBulkheadFixedFrame','frame'],['AftDoorLeaf','leaf'],['AftDoorButtonCap','button']] as const){
   model.getObjectByName(name)?.traverse(o=>{
    if(!(o instanceof Mesh))return
    this.originals.push({mesh:o,material:o.material})
    o.geometry.computeBoundingBox();const b=o.geometry.boundingBox!,size=b.getSize(new Vector3())
    const source=Array.isArray(o.material)?o.material:[o.material]
    const materials=source.map(original=>{
     if(!(original instanceof MeshStandardMaterial))return original
     const role:Role=original.name==='Aft door cut-edge finish'?'cut':baseRole,material=original.clone()
     const uvMin=role==='button'?new Vector2(b.min.x,b.min.y):new Vector2(b.min.x,-b.max.z)
     const uvSize=role==='button'?new Vector2(size.x,size.y):new Vector2(size.x,size.z)
     material.metalness=role==='cut'?.65:original.metalness*.45;material.roughness=Math.max(.62,original.roughness);material.envMapIntensity=.45
     if('specularColor'in material){const c=material.specularColor as {r:number;g:number;b:number};c.r=Math.min(c.r,.8);c.g=Math.min(c.g,.8);c.b=Math.min(c.b,.8)}
     if(role==='button')material.emissive.setHex(0x03222a)
     const compile=original.onBeforeCompile,key=original.customProgramCacheKey.bind(original)
     material.onBeforeCompile=(shader,renderer)=>{compile.call(material,shader,renderer);shaderFinish(shader,role,uvMin,uvSize,new Vector2(b.min.y,size.y),role==='leaf'?label:role==='button'?button:undefined)}
     material.customProgramCacheKey=()=>key()+'|cabin-hatch-finish-2|'+role+'|'+Boolean(role==='leaf'?label:role==='button'?button:false)
     material.needsUpdate=true;this.owned.add(material);return material
    })
    o.material=Array.isArray(o.material)?materials:materials[0]
   })
  }
 }
 dispose(){for(const row of this.originals)row.mesh.material=row.material;this.owned.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.originals=[];this.owned.clear();this.textures=[]}
}
