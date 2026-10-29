"""Read-only world-space geometry and finite ray probes for existing asset assembly."""
import sys
from pathlib import Path
import numpy as np
from inventory_existing_sources import transform
ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'output/hunyuan-adaptation/windshield-glass-20261018'))
from glb_surface_io import accessor,load


def selected_module(node, primitive):
    """Classify existing tagged side glazing without changing source data."""
    module = node.get('extras', {}).get('module')
    region = primitive.get('extras', {}).get('reviewRegion')
    if module == 'exterior-hull' and region in {'left-pane', 'right-pane'}:
        return 'exterior-glass'
    return module


def read_world(path,modules=None):
    doc,binary,_=load(path)
    vertices=[];faces=[];count=0
    def visit(index,parent):
        nonlocal count
        node=doc['nodes'][index];world=parent@transform(node)
        if 'mesh' in node:
            for primitive in doc['meshes'][node['mesh']]['primitives']:
                if modules is not None and selected_module(node, primitive) not in modules:
                    continue
                v=accessor(doc,binary,primitive['attributes']['POSITION'])
                f=accessor(doc,binary,primitive['indices']).reshape(-1,3)
                if modules is not None:
                    # Shared accessors also contain vertices unused by this pane.
                    used = np.unique(f)
                    v, f = v[used], np.searchsorted(used, f)
                vertices.append(v@world[:3,:3].T+world[:3,3]);faces.append(f+count);count+=len(v)
        for child in node.get('children',[]):visit(child,world)
    for index in doc['scenes'][doc.get('scene',0)]['nodes']:visit(index,np.eye(4))
    return np.concatenate(vertices),np.concatenate(faces)


def yaw(degrees):
    a=np.deg2rad(degrees);c,s=np.cos(a),np.sin(a)
    return np.array([[c,0,s],[0,1,0],[-s,0,c]])


def place(vertices,scale,rotation,center):
    source_center=(vertices.min(0)+vertices.max(0))/2
    return (vertices-source_center)@yaw(rotation).T*scale+center


def hits(vertices,faces,origin,direction):
    triangles=vertices[faces];a=triangles[:,0];u=triangles[:,1]-a;v=triangles[:,2]-a
    direction=np.asarray(direction,dtype=float);origin=np.asarray(origin,dtype=float)
    p=np.cross(direction,v);det=np.einsum('ij,ij->i',u,p)
    valid=abs(det)>1e-10;inv=np.divide(1,det,out=np.zeros_like(det),where=valid)
    t=origin-a;b1=np.einsum('ij,ij->i',t,p)*inv
    q=np.cross(t,u);b2=q@direction*inv;distance=np.einsum('ij,ij->i',v,q)*inv
    valid&=(b1>=-1e-7)&(b2>=-1e-7)&(b1+b2<=1+1e-7)&(distance>1e-5)
    result=np.sort(distance[valid]);return result[np.r_[True,np.diff(result)>1e-4]] if len(result) else result


def first(vertices,faces,origin,direction):
    values=hits(vertices,faces,origin,direction)
    return float(values[0]) if len(values) else None
