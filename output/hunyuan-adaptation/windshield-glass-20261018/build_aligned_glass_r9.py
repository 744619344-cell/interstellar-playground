"""Keep the saved local alignment; update its actual surface normals after adjustment."""
import hashlib
import json
from pathlib import Path
import numpy as np
from glb_surface_io import accessor, load, write
from build_aligned_glass_r6 import append_vectors

BASE = Path(__file__).resolve().parent


def main():
    a,ab,_ = load(BASE/'前挡玻璃-材质分离候选-r2.glb')
    doc,binary,raw = load(BASE/'前挡玻璃-r2接缝对齐-r8.glb')
    prim = doc['meshes'][110]['primitives'][0]
    source_v,source_n = accessor(a,ab,440),accessor(a,ab,441)
    v = accessor(doc,binary,prim['attributes']['POSITION'])
    f = accessor(doc,binary,prim['indices']).reshape(-1,3)
    changed = np.any(v!=source_v,axis=1)
    # Preserve existing split normals at hard edges / UV seams; blend the actual
    # saved face normals inside each original position-and-normal group only.
    keys = np.column_stack([source_v,np.round(source_n,6)])
    _,groups = np.unique(keys,axis=0,return_inverse=True)
    face_n = np.cross(v[f[:,1]].astype(float)-v[f[:,0]],v[f[:,2]].astype(float)-v[f[:,0]])
    accumulated = np.zeros((groups.max()+1,3))
    for corner in range(3):
        np.add.at(accumulated,groups[f[:,corner]],face_n)
    normals = source_n.copy()
    local = accumulated[groups[changed]]
    lengths = np.linalg.norm(local,axis=1)
    valid = lengths>1e-15
    indices = np.where(changed)[0]
    normals[indices[valid]] = local[valid]/lengths[valid,None]
    prim['attributes']['NORMAL'] = append_vectors(doc,binary,normals)
    path = BASE/'前挡玻璃-r2接缝对齐-r9.glb'
    content = write(path,doc,binary)
    report = {'source':'前挡玻璃-r2接缝对齐-r8.glb','sourceSha256':hashlib.sha256(raw).hexdigest(),
        'candidate':path.name,'candidateSha256':hashlib.sha256(content).hexdigest(),
        'changedCanopyVertices':int(changed.sum()),'totalCanopyVertices':len(v),
        'changedSourceBounds':[source_v[changed].min(0).tolist(),source_v[changed].max(0).tolist()],
        'normalMethod':'area-weighted actual faces, original split-normal groups',
        'positionsExactFromR8':True,'normalsOutsideChangedPositionsExactFromR2':True,
        'materialsExactFromR2':True,'visualAccepted':False}
    (BASE/'接缝对齐-r9-制作记录.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
