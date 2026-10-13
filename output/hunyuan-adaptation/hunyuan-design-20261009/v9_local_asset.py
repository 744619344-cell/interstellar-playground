"""Source-preserving GLB utilities for explicitly authorized local v9 repairs."""
import copy,hashlib,json,struct,sys
from pathlib import Path
import numpy as np
BASE=Path(__file__).parent;OUT=BASE/'局部调整-v9-20261012'
sys.path.insert(0,str(BASE.parent/'repair'))
from mesh_asset_io import load,accessor

def read_source():
 path=BASE/'驾驶围护总成-v9/混元原始模型.glb';doc,binary,raw=load(path)
 assert hashlib.sha256(raw).hexdigest()=='c69f8a15369ca2e18546a66748d9c50d3752bd400b883ae98fab3845eeef66e0'
 assert len(doc['nodes'])==1 and len(doc['meshes'])==1
 assert np.allclose(doc['nodes'][0]['rotation'],[2**-.5,0,0,2**-.5])
 primitive=doc['meshes'][0]['primitives'][0]
 arrays={name:accessor(doc,binary,index) for name,index in primitive['attributes'].items()}
 indices=accessor(doc,binary,primitive['indices']).reshape(-1,3)
 pose=json.loads((BASE/'驾驶围护总成-v9/原始围护检查.json').read_text('utf8'))['trialPose']
 local=np.column_stack((arrays['POSITION'][:,0],-arrays['POSITION'][:,2],arrays['POSITION'][:,1])).astype(float)
 center=(local.min(0)+local.max(0))/2
 assert pose['rotationYDegrees']==180
 world=(local-center)*pose['uniformScale'];world[:,[0,2]]*=-1;world+=pose['placementCenter']
 return path,doc,binary,raw,arrays,indices,pose,center,world

def to_local(world,pose,center):
 points=(world-np.asarray(pose['placementCenter']))/pose['uniformScale'];points[:,[0,2]]*=-1
 points+=center
 return np.column_stack((points[:,0],points[:,2],-points[:,1])).astype('<f4')

def normal_to_world(normals):
 result=np.column_stack((normals[:,0],-normals[:,2],normals[:,1])).astype(float)
 result[:,[0,2]]*=-1
 return result

def normal_to_local(normals):
 result=normals.copy();result[:,[0,2]]*=-1
 result=np.column_stack((result[:,0],result[:,2],-result[:,1]))
 result/=np.maximum(np.linalg.norm(result,axis=1,keepdims=True),1e-12)
 return result.astype('<f4')

class AppendBuffers:
 def __init__(self,doc,binary):self.doc=doc;self.binary=bytearray(binary)
 def add(self,values,kind,target):
  values=np.asarray(values,dtype='<u4' if kind=='SCALAR' else '<f4')
  self.binary+=b'\0'*((-len(self.binary))%4);start=len(self.binary);self.binary+=values.tobytes()
  self.doc['bufferViews'].append({'buffer':0,'byteOffset':start,'byteLength':values.nbytes,'target':target})
  row={'bufferView':len(self.doc['bufferViews'])-1,'componentType':5125 if kind=='SCALAR' else 5126,'count':values.size if kind=='SCALAR' else len(values),'type':kind}
  if kind=='VEC3':row.update(min=values.min(0).tolist(),max=values.max(0).tolist())
  self.doc['accessors'].append(row);return len(self.doc['accessors'])-1

def write_revision(doc,buffers,path):
 assert not path.exists(), 'Never overwrite a source or existing revision.'
 buffers.binary+=b'\0'*((-len(buffers.binary))%4)
 doc['buffers'][0]['byteLength']=len(buffers.binary)
 doc['asset']['generator']='Hunyuan v9 with user-authorized local roof, handle UV and lamp repairs'
 text=json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode('utf8');text+=b' '*((-len(text))%4)
 total=12+8+len(text)+8+len(buffers.binary)
 content=struct.pack('<III',0x46546C67,2,total)+struct.pack('<I4s',len(text),b'JSON')+text+struct.pack('<I4s',len(buffers.binary),b'BIN\0')+buffers.binary
 path.write_bytes(content)
 return hashlib.sha256(content).hexdigest()
