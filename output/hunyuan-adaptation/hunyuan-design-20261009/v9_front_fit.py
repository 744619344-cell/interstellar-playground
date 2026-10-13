"""Measure the existing window silhouette for the authorized roof interface."""
import json
import numpy as np
from v9_local_asset import BASE
from mesh_asset_io import load,accessor

def measured_lift(world,indices,sampler):
 doc,binary,raw=load(BASE/'前窗总成-v2/混元原始模型.glb');p=doc['meshes'][0]['primitives'][0]
 v=accessor(doc,binary,p['attributes']['POSITION']);local=np.column_stack((v[:,0],-v[:,2],v[:,1])).astype(float)
 pose=json.loads((BASE/'前窗总成-v2/实装观察结论.json').read_text('utf8'))
 window=(local-(local.min(0)+local.max(0))/2)*pose['uniformScale']+pose['placementCenter']
 assert .20<window[:,1].max()<.22
 zs=np.linspace(-5.87,-5.50,25)
 height=sampler(world,indices)
 central=np.asarray([height(0,z) for z in zs])
 def lift(points):
  x,z=points[:,0],points[:,2]
  # A continuous section retains source panel relief; per-ray minima created ripples.
  before=np.interp(z,zs,central);target=.245
  side=np.clip((abs(x)-1.52)/.09,0,1);side=side*side*(3-2*side)
  t=np.clip((z+5.50)/.84,0,1);weight=1-t*t*(3-2*t)
  return np.maximum(target-before-.085*side,0)*weight
 return lift
