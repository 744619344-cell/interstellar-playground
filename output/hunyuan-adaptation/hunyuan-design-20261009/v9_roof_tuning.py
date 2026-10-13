"""Localized roof deformation and two flush lamp strips, not a cabin rebuild."""
import numpy as np
from v9_front_fit import measured_lift

_front_lift=None

def deformation(points):
 z=points[:,2]
 # Raise only the front 1.32 m. Rear roof and every floor vertex stay fixed.
 t=np.clip((z+5.64)/.98,0,1)
 longitudinal=_front_lift(points) if _front_lift else .200*(1-t*t*(3-2*t))
 # Conservative original roof envelope from finite source roof sections.
 envelope=.025+.32*np.maximum(z+5.85,0)
 weight=np.clip((points[:,1]-(envelope-.22))/.22,0,1)
 weight=weight*weight*(3-2*weight)
 return longitudinal*weight

def tune_roof(world,normals,indices):
 global _front_lift
 _front_lift=measured_lift(world,indices,roof_sampler)
 before=world.copy();delta=deformation(world);mask=delta>1e-7
 result=world.copy();result[:,1]+=delta
 # Analytic deformation Jacobian, evaluated numerically, preserves untouched normals.
 eps=1e-5;gradient=np.zeros_like(world)
 for axis in [0,1,2]:
  hi=world.copy();lo=world.copy();hi[:,axis]+=eps;lo[:,axis]-=eps
  gradient[:,axis]=(deformation(hi)-deformation(lo))/(2*eps)
 updated=normals.copy();den=1+gradient[:,1]
 updated[:,1]=normals[:,1]/den
 updated[:,0]=normals[:,0]-gradient[:,0]*updated[:,1]
 updated[:,2]=normals[:,2]-gradient[:,2]*updated[:,1]
 updated/=np.maximum(np.linalg.norm(updated,axis=1,keepdims=True),1e-12)
 updated[~mask]=normals[~mask]
 return result,updated,{'roofChangedVertices':int(mask.sum()),'maximumRoofLiftMeters':float(delta.max()),'longitudinalChangedRange':[float(before[mask,2].min()),float(before[mask,2].max())],'floorVerticesUnchanged':bool(np.array_equal(result[before[:,1]<-1.2],before[before[:,1]<-1.2]))}

def roof_sampler(world,indices):
 triangles=world[indices];triangles=triangles[triangles.mean(1)[:,1]>-.1]
 a,b,c=triangles[:,0,:][:,[0,2]],triangles[:,1,:][:,[0,2]],triangles[:,2,:][:,[0,2]]
 den=(b[:,1]-c[:,1])*(a[:,0]-c[:,0])+(c[:,0]-b[:,0])*(a[:,1]-c[:,1]);valid=abs(den)>1e-15;safe=np.where(valid,den,1)
 def height(x,z):
  u=((b[:,1]-c[:,1])*(x-c[:,0])+(c[:,0]-b[:,0])*(z-c[:,1]))/safe
  v=((c[:,1]-a[:,1])*(x-c[:,0])+(a[:,0]-c[:,0])*(z-c[:,1]))/safe
  mask=valid&(u>=-1e-8)&(v>=-1e-8)&(u+v<=1+1e-8)
  values=u*triangles[:,0,1]+v*triangles[:,1,1]+(1-u-v)*triangles[:,2,1]
  assert mask.any(), 'No roof available for flush lamp mounting.'
  return float(values[mask].min())
 return height

def lamp_ribbon(height,x,width,offset):
 points=[];faces=[];steps=48
 for z in np.linspace(-5.65,-2.64,steps):
  for dx in [-width/2,width/2]:
   y=height(x+dx,z)-offset
   points.extend([[x+dx,y,z],[x+dx,y+.002,z]])
 for step in range(steps-1):
  a=step*4;b=a+4
  faces.extend([[a,a+2,b+2],[a,b+2,b],[a+1,b+1,b+3],[a+1,b+3,a+3],[a,b,a+1],[a+1,b,b+1],[a+2,a+3,b+2],[a+3,b+3,b+2]])
 faces.extend([[0,1,2],[1,3,2],[4*(steps-1),4*(steps-1)+2,4*(steps-1)+1],[4*(steps-1)+1,4*(steps-1)+2,4*(steps-1)+3]])
 return np.asarray(points),np.asarray(faces,dtype='<u4')

def vertex_normals(points,faces):
 normals=np.zeros_like(points);triangles=points[faces]
 face=np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0])
 for column in range(3):np.add.at(normals,faces[:,column],face)
 normals/=np.maximum(np.linalg.norm(normals,axis=1,keepdims=True),1e-12)
 return normals
