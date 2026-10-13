"""Independently verify the separate revision and finite window roof contacts."""
import hashlib,json,sys
import numpy as np
from v9_local_asset import BASE,OUT,read_source
from v9_roof_tuning import roof_sampler
from mesh_asset_io import load,accessor
sys.path.insert(0,str(BASE.parent/'repair'))
from verify_static_asset import verify
source,sd,sb,sr,arrays,si,pose,center,world=read_source()
path=OUT/'围护v9-局部修订-r9.glb';d,b,r=load(path);p=d['meshes'][0]['primitives'][0]
points=accessor(d,b,p['attributes']['POSITION']);faces=np.concatenate([accessor(d,b,row['indices']).reshape(-1,3) for row in d['meshes'][0]['primitives']])
local=np.column_stack((points[:,0],-points[:,2],points[:,1])).astype(float)
assembled=(local-center)*pose['uniformScale'];assembled[:,[0,2]]*=-1;assembled+=pose['placementCenter']
assert len(faces)==len(si)
original_local=np.column_stack((arrays['POSITION'][:,0],-arrays['POSITION'][:,2],arrays['POSITION'][:,1]))
assert np.allclose(local.min(0),original_local.min(0),atol=1e-6)
assert np.allclose(local.max(0),original_local.max(0),atol=1e-6)
original_len=len(arrays['POSITION']);changed=np.any(points[:original_len]!=arrays['POSITION'],axis=1)
assert np.array_equal(points[:original_len][world[:,1]<-1.2],arrays['POSITION'][world[:,1]<-1.2])
from v9_handle_local import PATCHES
allowed=world[:,2]<-4.6607
for cy,cz,hy,hz in PATCHES:allowed|=(world[:,0]<-1.66)&(world[:,0]>-1.723)&(abs(world[:,1]-cy)<hy+.07)&(abs(world[:,2]-cz)<hz+.07)
assert not changed[~allowed].any()
height=roof_sampler(assembled,faces)
wd,wb,wr=load(BASE/'前窗总成-v2/混元原始模型.glb');wp=wd['meshes'][0]['primitives'][0]
wv=accessor(wd,wb,wp['attributes']['POSITION']);wl=np.column_stack((wv[:,0],-wv[:,2],wv[:,1])).astype(float)
window_pose=json.loads((BASE/'前窗总成-v2/实装观察结论.json').read_text('utf8'))
ww=(wl-(wl.min(0)+wl.max(0))/2)*window_pose['uniformScale']+window_pose['placementCenter']
selected=ww[(ww[:,1]>.03)&(abs(ww[:,0])<1.66)&(ww[:,2]>-5.8999)]
deltas=[]
for vertex in selected:deltas.append(float(vertex[1]-height(vertex[0],vertex[2])))
print('worst contacts',[(selected[i].tolist(),deltas[i]) for i in np.argsort(deltas)[-6:]])
format_report=verify(path)
(OUT/'修订-r9格式检查.json').write_text(json.dumps(format_report,ensure_ascii=False,indent=2)+'\n','utf8')
report={'sourceSha256':hashlib.sha256(sr).hexdigest(),'revisedSha256':hashlib.sha256(r).hexdigest(),'sourceVertices':original_len,'changedOriginalPositionVertices':int(changed.sum()),'bodyTrianglesUnchanged':len(faces)==len(si),'floorVerticesByteExact':True,'rearBodyVerticesByteExact':True,'finiteRoofWindowSamples':len(deltas),'aboveRoofSamples':sum(delta>1e-4 for delta in deltas),'maximumSampledPenetrationMeters':max([delta for delta in deltas if delta>1e-4],default=0),'minimumSampledClearanceMeters':-max(deltas),'meshCount':len(d['meshes']),'sourceUnchanged':True,'productReplaced':False,'limits':'Finite source window vertex roof samples; not exhaustive triangle collision, seals or art acceptance.'}
report['rearBodyVerticesByteExact']='Outside the two explicitly authorized handle footprints';report['outsideAuthorizedRegionsByteExact']=True
(OUT/'修订-r9有限接口检查.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
assert hashlib.sha256(source.read_bytes()).hexdigest()==report['sourceSha256']
print(json.dumps(report))
