"""Two explicitly authorized handle repairs; no other wall or cabin rebuilding."""
import numpy as np
import io
from PIL import Image

PATCHES=[(-.508,-3.472,.37,.31),(-.518,-4.884,.37,.28)]

def coating_colors(doc,binary,uv,world):
 pbr=doc['materials'][doc['meshes'][0]['primitives'][0]['material']]['pbrMetallicRoughness']
 texture=doc['textures'][pbr['baseColorTexture']['index']];image=doc['images'][texture['source']]
 view=doc['bufferViews'][image['bufferView']];start=view.get('byteOffset',0)
 pixels=np.asarray(Image.open(io.BytesIO(binary[start:start+view['byteLength']])).convert('RGB'))/255.
 h,w=pixels.shape[:2];coords=uv%1
 samples=pixels[np.clip((coords[:,1]*h).astype(int),0,h-1),np.clip((coords[:,0]*w).astype(int),0,w-1)]
 linear=np.where(samples<=.04045,samples/12.92,((samples+.055)/1.055)**2.4)
 colors=linear.copy()
 for cy,cz,hy,hz in PATCHES:
  region=(world[:,0]<-1.66)&(world[:,0]>-1.723)&(abs(world[:,1]-cy)<hy+.07)&(abs(world[:,2]-cz)<hz+.07)
  # Nearby undamaged panel paint supplies the replacement, retaining original border color.
  near=region&(abs(world[:,1]-cy)>hy-.06)&(samples.min(1)>.45)
  paint=np.median(linear[near],axis=0);assert np.isfinite(paint).all()
  weight=np.minimum(np.clip((hy-abs(world[:,1]-cy))/.08,0,1),np.clip((hz-abs(world[:,2]-cz))/.08,0,1))
  colors[region]=(1-weight[region,None])*linear[region]+weight[region,None]*paint
 return colors.astype('<f4')

def repair_local_handles(world,normals,indices):
 tri=world[indices];mid=tri.mean(1);face_normal=normals[indices].mean(1)
 mask=np.zeros(len(indices),dtype=bool);result=world.copy();updated=normals.copy();changed=np.zeros(len(world),dtype=bool)
 for cy,cz,hy,hz in PATCHES:
  selected=(mid[:,0]<-1.66)&(mid[:,0]>-1.723)&(face_normal[:,0]>.65)
  selected&=(abs(mid[:,1]-cy)<hy)&(abs(mid[:,2]-cz)<hz);mask|=selected
  ids=np.unique(indices[selected]);points=world[ids]
  weight=np.minimum(np.clip((hy-abs(points[:,1]-cy))/.07,0,1),np.clip((hz-abs(points[:,2]-cz))/.07,0,1))
  result[ids,0]+=(-1.707-points[:,0])*weight
  updated[ids]=(1-weight[:,None])*updated[ids]+weight[:,None]*[1,0,0]
  updated[ids]/=np.maximum(np.linalg.norm(updated[ids],axis=1,keepdims=True),1e-12)
  changed[ids[weight>0]]=True
 return result,updated,mask,{'handleChangedVertices':int(changed.sum()),'maximumHandleMovementMeters':float(np.abs(result-world).max()),'localCoatingFaces':int(mask.sum()),'strategy':'Flatten only the two deformed handle footprints, retain wall triangles, replace their distorted atlas with matching plain coating and two compact grab fixtures.'}

def rounded_loop(cy,cz):
 # Compact 27 x 10.5 cm fixture, rounded corners and a bevel around its grip.
 def contour(h,w,r):
  rows=[]
  for sy,sz,start in [(1,1,0),(-1,1,90),(-1,-1,180),(1,-1,270)]:
   for angle in np.linspace(start,start+90,5,endpoint=False):
    a=np.deg2rad(angle);rows.append([cy+sy*(h/2-r)+r*np.cos(a),cz+sz*(w/2-r)+r*np.sin(a)])
  return rows
 outer=contour(.27,.105,.021);inner=contour(.19,.045,.012)
 points=[]
 for x,curve in [(-1.698,outer),(-1.676,outer),(-1.670,inner),(-1.698,inner)]:
  points.extend([[x,y,z] for y,z in curve])
 faces=[];n=len(outer)
 for ring in range(4):
  following=(ring+1)%4
  for j in range(n):
   k=(j+1)%n;a=ring*n+j;b=ring*n+k;c=following*n+k;d=following*n+j
   faces.extend([[a,b,c],[a,c,d]])
 return np.asarray(points),np.asarray(faces,dtype='<u4')
