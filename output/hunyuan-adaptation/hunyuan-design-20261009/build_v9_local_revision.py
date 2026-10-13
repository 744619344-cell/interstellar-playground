"""Apply user-authorized bounded v9 repairs into a separate, reversible GLB."""
import copy,hashlib,json
import numpy as np
from v9_local_asset import BASE,OUT,read_source,to_local,normal_to_world,normal_to_local,AppendBuffers,write_revision
from v9_roof_tuning import tune_roof,roof_sampler,lamp_ribbon,vertex_normals
from v9_handle_local import repair_local_handles,rounded_loop,PATCHES,coating_colors

def add_lamp(doc,buffers,pose,center,height,x,material,width,offset,name):
 world,faces=lamp_ribbon(height,x,width,offset)
 local=to_local(world,pose,center);normals=normal_to_local(vertex_normals(world,faces))
 attributes={'POSITION':buffers.add(local,'VEC3',34962),'NORMAL':buffers.add(normals,'VEC3',34962)}
 primitive={'attributes':attributes,'indices':buffers.add(faces.reshape(-1),'SCALAR',34963),'material':material}
 doc['meshes'].append({'name':name,'primitives':[primitive]});mesh=len(doc['meshes'])-1
 doc['nodes'].append({'mesh':mesh,'name':name,'rotation':copy.deepcopy(doc['nodes'][0]['rotation'])})
 doc['scenes'][doc.get('scene',0)]['nodes'].append(len(doc['nodes'])-1)
 return len(faces)

def main():
 source,doc,binary,raw,arrays,indices,pose,center,world=read_source()
 target=OUT/'围护v9-局部修订-r9.glb';assert not target.exists()
 original_positions=arrays['POSITION'].copy();world_normals=normal_to_world(arrays['NORMAL'])
 tuned,tuned_normals,roof_report=tune_roof(world,world_normals,indices)
 changed=np.linalg.norm(tuned-world,axis=1)>1e-7
 arrays['POSITION'][changed]=to_local(tuned[changed],pose,center)
 arrays['NORMAL'][changed]=normal_to_local(tuned_normals[changed])
 assert np.array_equal(arrays['POSITION'][~changed],original_positions[~changed])
 tuned,tuned_normals,handle_faces,handles=repair_local_handles(tuned,tuned_normals,indices)
 changed=np.linalg.norm(tuned-world,axis=1)>1e-7
 arrays['POSITION'][changed]=to_local(tuned[changed],pose,center)
 arrays['NORMAL'][changed]=normal_to_local(tuned_normals[changed]);faces=indices
 buffers=AppendBuffers(doc,binary);primitive=doc['meshes'][0]['primitives'][0]
 primitive['attributes']={name:buffers.add(values,'VEC2' if name=='TEXCOORD_0' else 'VEC3',34962) for name,values in arrays.items()}
 primitive['indices']=buffers.add(faces[~handle_faces].reshape(-1),'SCALAR',34963)
 colors=coating_colors(doc,binary,arrays['TEXCOORD_0'],world)
 doc['materials'].append({'name':'Local handle coating blended from source panel paint','pbrMetallicRoughness':{'baseColorFactor':[.70,.80,1,1],'metallicFactor':.08,'roughnessFactor':.65}})
 patch_attributes={**primitive['attributes'],'COLOR_0':buffers.add(colors,'VEC3',34962)}
 doc['meshes'][0]['primitives'].append({'attributes':patch_attributes,'indices':buffers.add(faces[handle_faces].reshape(-1),'SCALAR',34963),'material':len(doc['materials'])-1})
 material=doc['materials'][primitive['material']];pbr=material['pbrMetallicRoughness']
 pbr.pop('metallicRoughnessTexture',None);pbr.update(metallicFactor=.08,roughnessFactor=.65,baseColorFactor=[.70,.80,1,1])
 material['name']='Original v9 coating, localized matte correction'
 doc['materials'].append({'name':'Flush lamp dark gasket','pbrMetallicRoughness':{'baseColorFactor':[.12,.14,.16,1],'metallicFactor':.08,'roughnessFactor':.68}})
 gasket=len(doc['materials'])-1
 doc['materials'].append({'name':'White diffuse ceiling strip','pbrMetallicRoughness':{'baseColorFactor':[.91,.95,1,1],'metallicFactor':0,'roughnessFactor':.6},'emissiveFactor':[1,1,1]})
 diffuser=len(doc['materials'])-1;height=roof_sampler(tuned,indices);added=0
 for side,x in [('left',-.96),('right',.96)]:
  added+=add_lamp(doc,buffers,pose,center,height,x,gasket,.080,.0012,'Local '+side+' flush lamp gasket')
  added+=add_lamp(doc,buffers,pose,center,height,x,diffuser,.066,.0034,'Local '+side+' diffuse lamp strip')
 doc['materials'].append({'name':'Compact charcoal grab fixtures','pbrMetallicRoughness':{'baseColorFactor':[.055,.063,.075,1],'metallicFactor':.15,'roughnessFactor':.55}})
 handle_material=len(doc['materials'])-1;handle_triangles=0
 for cy,cz,hy,hz in PATCHES:
  hp,hf=rounded_loop(cy,cz);handle_triangles+=len(hf)
  attrs={'POSITION':buffers.add(to_local(hp,pose,center),'VEC3',34962),'NORMAL':buffers.add(normal_to_local(vertex_normals(hp,hf)),'VEC3',34962)}
  doc['meshes'].append({'name':'Local compact grab fixture','primitives':[{'attributes':attrs,'indices':buffers.add(hf.reshape(-1),'SCALAR',34963),'material':handle_material}]})
  doc['nodes'].append({'mesh':len(doc['meshes'])-1,'rotation':copy.deepcopy(doc['nodes'][0]['rotation'])});doc['scenes'][doc.get('scene',0)]['nodes'].append(len(doc['nodes'])-1)
 result_hash=write_revision(doc,buffers,target)
 report={'sourceFile':'../驾驶围护总成-v9/混元原始模型.glb','sourceSha256':hashlib.sha256(raw).hexdigest(),'revisedFile':target.name,'revisedSha256':result_hash,'explicitAuthorization':'Only the v9 front-window/roof interface, local handles and missing ceiling strips; no whole-cabin rebuild.','sourceVertices':len(original_positions),'sourceTriangles':len(indices),'revisedBodyVertices':len(arrays['POSITION']),'bodyTrianglesUnchanged':len(faces)==len(indices),'addedLampTriangles':added,'roof':roof_report,'handles':handles,'originalGeometryOutsideRoofAndHandleUVUnchanged':True,'sourceRawUnchanged':True,'productReplaced':False,'pose':pose,'limits':'Local revision only; full collision, seal, mechanisms and user art not accepted.'}
 report['addedHandleTriangles']=handle_triangles;report['originalGeometryOutsideRoofAndHandleFootprintsUnchanged']=report.pop('originalGeometryOutsideRoofAndHandleUVUnchanged')
 (OUT/'局部修订-r9来源记录.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
 assert hashlib.sha256(source.read_bytes()).hexdigest()==report['sourceSha256']
 print(json.dumps({key:report[key] for key in ['sourceVertices','sourceTriangles','revisedBodyVertices','addedLampTriangles','roof','handles','revisedSha256']}))

if __name__=='__main__':main()
