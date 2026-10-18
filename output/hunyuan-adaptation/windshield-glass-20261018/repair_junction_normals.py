"""Continue only the marked junction: smooth optical normals, retaining all positions."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from glb_surface_io import accessor, load, write
from build_aligned_glass_r6 import append_vectors, smooth

BASE = Path(__file__).resolve().parent
SOURCE = BASE/'前挡玻璃-r2接缝对齐-r9.glb'


def fit_normals(v):
    x,y,z = v.astype(float).T
    a,q = abs(x)-1.85,z+4.05
    terms = [(i,j) for i in range(4) for j in range(4-i)]
    matrix = np.array([a**i*q**j for i,j in terms]).T
    selection = ((abs(x)>1.4)&(abs(x)<2.28)&(z>-4.8)&(z<-3.25)&(y>1.4)&(y<2.5))
    weights = np.ones(sum(selection))
    for _ in range(12):
        c = np.linalg.lstsq(matrix[selection]*weights[:,None],y[selection]*weights,rcond=None)[0]
        residual = matrix[selection]@c-y[selection]
        weights = np.minimum(1,.025/np.maximum(abs(residual),1e-9))
    dx = sum(c[k]*i*a**max(0,i-1)*q**j for k,(i,j) in enumerate(terms) if i)*np.sign(x)
    dz = sum(c[k]*j*a**i*q**max(0,j-1) for k,(i,j) in enumerate(terms) if j)
    normals = np.column_stack([-dx,np.ones(len(v)),-dz])
    normals /= np.linalg.norm(normals,axis=1)[:,None]
    return normals, {'robustFitMedianResidual':float(np.median(abs(residual))),
        'robustFitPoints':int(selection.sum()),'coefficients':c.tolist()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output',default='交点法线-诊断.glb')
    args = parser.parse_args()
    path = BASE/args.output
    assert path.parent==BASE and not path.exists()
    doc,binary,raw = load(SOURCE)
    prim = doc['meshes'][110]['primitives'][0]
    v,n = [accessor(doc,binary,prim['attributes'][key]) for key in ['POSITION','NORMAL']]
    target,report = fit_normals(v)
    x,y,z = v.astype(float).T
    distance = np.sqrt(((abs(x)-2.0)/.36)**2+((y-1.98)/.33)**2+((z+4.01)/.5)**2)
    weight = 1-smooth((distance-.4)/.6)
    selection = weight>0
    target *= np.where(np.sum(n*target,axis=1)<0,-1,1)[:,None]
    result = n.copy()
    mixed = n[selection]*(1-weight[selection,None])+target[selection]*weight[selection,None]
    result[selection] = mixed/np.linalg.norm(mixed,axis=1)[:,None]
    prim['attributes']['NORMAL'] = append_vectors(doc,binary,result)
    content = write(path,doc,binary)
    changed = np.any(result!=n,axis=1)
    report.update(source=SOURCE.name,sourceSha256=hashlib.sha256(raw).hexdigest(),
        candidate=path.name,candidateSha256=hashlib.sha256(content).hexdigest(),
        changedNormals=int(changed.sum()),changedBounds=[v[changed].min(0).tolist(),v[changed].max(0).tolist()],
        positionsChanged=False,materialsChanged=False,visualAccepted=False)
    (BASE/(path.stem+'-记录.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
