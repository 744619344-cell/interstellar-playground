"""Verify the saved r10 differs from r9 only in local junction normals."""
import copy
import hashlib
import json
from pathlib import Path
import numpy as np
from glb_surface_io import accessor,load,write

BASE = Path(__file__).resolve().parent


def main():
    a,ab,araw = load(BASE/'前挡玻璃-r2接缝对齐-r9.glb')
    d,b,raw = load(BASE/'前挡玻璃-r2交点顺光-r10.glb')
    pr = d['meshes'][110]['primitives'][0]
    oldpr = a['meshes'][110]['primitives'][0]
    assert b[:len(ab)]==ab
    assert d['accessors'][:-1]==a['accessors']
    assert d['bufferViews'][:-1]==a['bufferViews']
    v = accessor(d,b,pr['attributes']['POSITION'])
    oldn = accessor(a,ab,oldpr['attributes']['NORMAL'])
    n = accessor(d,b,pr['attributes']['NORMAL'])
    changed = np.any(n!=oldn,axis=1)
    assert changed.sum()==795
    assert np.isfinite(n).all()
    assert max(abs(np.linalg.norm(n[changed],axis=1)-1))<1e-6
    x,y,z = v[changed].T
    assert np.all((abs(x)>1.64)&(abs(x)<2.36)&(y>1.65)&(y<2.31)&(z>-4.51)&(z<-3.51))
    distance = ((abs(x)-2.0)/.36)**2+((y-1.98)/.33)**2+((z+4.01)/.5)**2
    assert np.all(distance<1.00001)
    normalized = copy.deepcopy(d)
    normalized['meshes'][110]['primitives'][0]['attributes']['NORMAL'] = oldpr['attributes']['NORMAL']
    for key in ['accessors','bufferViews','buffers']:
        normalized[key] = a[key]
    assert normalized==a
    # Exact document equality after restoring NORMAL also proves that all scene,
    # material, texture, position, UV, face and non-target references are preserved.
    report = {'candidateSha256':hashlib.sha256(raw).hexdigest(),
        'r9Sha256':hashlib.sha256(araw).hexdigest(),'originalBinaryPrefixExact':True,
        'changedNormals':int(changed.sum()),'changedLeft':int(sum(x<0)),
        'changedRight':int(sum(x>0)),'positionsFacesUVExact':True,
        'materialsAndOtherMeshesExact':True,'nodesScenesAnimationsExact':True,
        'visualAccepted':False,'browserInteractionVerified':False}
    review = copy.deepcopy(d)
    review['scenes'].append({'name':'r10交点光学法线_外观审阅','nodes':[110,111]})
    review['scene'] = len(review['scenes'])-1
    path = BASE/'前挡玻璃-r2交点顺光-外观审阅-r10.glb'
    if not path.exists():
        write(path,review,bytearray(b))
    rd,rb,rr = load(path)
    assert rd==review and rb==b
    report['exteriorReviewSha256'] = hashlib.sha256(rr).hexdigest()
    (BASE/'交点顺光-r10-独立检查.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
