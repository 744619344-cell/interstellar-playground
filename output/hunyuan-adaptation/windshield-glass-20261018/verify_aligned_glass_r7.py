"""Independent scope and face-orientation checks of the saved float32 candidate."""
import copy
import hashlib
import json
import numpy as np
from glb_surface_io import accessor, load, write
from pathlib import Path

BASE = Path(__file__).resolve().parent

def main():
    a, ab, araw = load(BASE/'前挡玻璃-材质分离候选-r2.glb')
    d, b, raw = load(BASE/'前挡玻璃-r2接缝对齐-r7.glb')
    assert b[:len(ab)] == ab
    assert d['materials'] == a['materials'], 'Restore r2 material exactly'
    assert d['meshes'][:110] == a['meshes'][:110]
    assert d['meshes'][111:] == a['meshes'][111:]
    assert d['accessors'][:len(a['accessors'])] == a['accessors']
    assert d['bufferViews'][:len(a['bufferViews'])] == a['bufferViews']
    pr, oldpr = d['meshes'][110]['primitives'][0], a['meshes'][110]['primitives'][0]
    assert pr['indices'] == oldpr['indices'] and pr['material'] == oldpr['material']
    assert pr['attributes']['TEXCOORD_0'] == oldpr['attributes']['TEXCOORD_0']
    v = accessor(a, ab, oldpr['attributes']['POSITION'])
    w = accessor(d, b, pr['attributes']['POSITION'])
    n = accessor(d, b, pr['attributes']['NORMAL'])
    oldn = accessor(a, ab, oldpr['attributes']['NORMAL'])
    changed = np.any(v!=w, axis=1)
    assert np.all(np.isfinite(w)) and np.all(np.isfinite(n))
    assert np.array_equal(n[~changed], oldn[~changed])
    assert np.max(abs(np.linalg.norm(n[changed], axis=1)-1)) < 1e-6
    local = (abs(v[:,0])<2.11)&(v[:,2]>-5.35)&(v[:,2]<-3.25)&(v[:,1]>1.4)
    assert not np.any(changed & ~local)
    # Every source-coincident seam vertex must remain coincident after the edit.
    _, inv = np.unique(v, axis=0, return_inverse=True)
    for axis in range(3):
        lo = np.full(inv.max()+1, np.inf); hi = -lo.copy()
        np.minimum.at(lo, inv, w[:,axis]); np.maximum.at(hi, inv, w[:,axis])
        assert np.array_equal(lo, hi)
    f = accessor(d, b, pr['indices']).reshape(-1,3)
    ca = np.cross(v[f[:,1]].astype(float)-v[f[:,0]], v[f[:,2]].astype(float)-v[f[:,0]])
    cb = np.cross(w[f[:,1]].astype(float)-w[f[:,0]], w[f[:,2]].astype(float)-w[f[:,0]])
    area = np.linalg.norm(ca, axis=1); newarea = np.linalg.norm(cb, axis=1)
    ref = np.load(BASE/'alignment-r7-orientation-reference.npz')['normals']
    active = np.any(changed[f],axis=1)&(area>1e-10)
    orientation = np.sum(cb*ref,axis=1)
    assert np.all(orientation[active]>area[active]*.0299)
    assert not np.any((newarea<1e-10)&(area>1e-10))
    normalized = copy.deepcopy(d)
    normalized['meshes'][110] = copy.deepcopy(a['meshes'][110])
    for key in ['accessors','bufferViews','buffers']:
        normalized[key] = a[key]
    assert normalized == a, 'No undocumented scene, texture, module, or material edits'
    report = {'candidateSha256': hashlib.sha256(raw).hexdigest(),
        'r2Sha256': hashlib.sha256(araw).hexdigest(), 'r2MaterialsExact': True,
        'originalBinaryPrefixExact': True, 'other142MeshesExact': True,
        'originalAccessorsExact': len(a['accessors']), 'originalIndicesAndUVExact': True,
        'changedCanopyVertices': int(changed.sum()), 'changedFaces': int(active.sum()),
        'sourceCoincidentVerticesRemainCoincident': True, 'newDegenerateFaces': 0,
        'reversedFacesAgainstTransportedReference': int(np.sum(orientation[active]<=0)),
        'minimumSignedAreaRatio': float((orientation[active]/area[active]).min()),
        'visualAccepted': False, 'browserInteractionVerified': False}
    review = copy.deepcopy(d)
    review.setdefault('scenes',[]).append({'name':'r2玻璃恢复与线条修订r7_外观审阅','nodes':[110,111]})
    review['scene'] = len(review['scenes'])-1
    path=BASE/'前挡玻璃-r2接缝对齐-外观审阅-r7.glb'
    if not path.exists():
        write(path, review, bytearray(b))
    rd, rb, rraw = load(path)
    assert rd==review and rb==b
    report['exteriorReviewSha256']=hashlib.sha256(rraw).hexdigest()
    (BASE/'接缝对齐-r7-独立检查.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__ == '__main__':
    main()
