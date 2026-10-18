"""Targeted r2 rib alignment, with local triangle-orientation constraints."""
import hashlib
import json
import numpy as np
from build_aligned_glass_r6 import BASE, SOURCE, TERMS, append_vectors, deform
from glb_surface_io import accessor, load, write

TARGET = BASE / '前挡玻璃-r2接缝对齐-r7.glb'


def jacobian(v, coeff):
    jac = np.empty((len(v), 3, 3))
    for axis in range(3):
        step = np.zeros_like(v); step[:, axis] = 1e-5
        jac[:, :, axis] = (deform(v+step, coeff)-deform(v-step, coeff))/2e-5
    return jac


def constrain_faces(v, moved, faces, coeff, pinned=None, max_iterations=150):
    unique, inverse = np.unique(v, axis=0, return_inverse=True)
    indexed = inverse[faces]
    w = np.zeros_like(unique)
    np.add.at(w, inverse, moved)
    w /= np.bincount(inverse)[:, None]
    free = np.zeros(len(unique), bool)
    np.logical_or.at(free, inverse, np.any(v != moved, axis=1))
    if pinned is not None:
        free[inverse[pinned]] = False
    original_cross = np.cross(v[faces[:, 1]]-v[faces[:, 0]], v[faces[:, 2]]-v[faces[:, 0]])
    jac = jacobian(v[faces].mean(1), coeff)
    reference = np.linalg.solve(jac.transpose(0, 2, 1), original_cross[:, :, None])[:, :, 0]
    reference /= np.maximum(np.linalg.norm(reference, axis=1)[:, None], 1e-20)
    original_area = np.linalg.norm(original_cross, axis=1)
    threshold = original_area*.03
    active = np.any(free[indexed], axis=1) & (original_area>1e-10)
    for iteration in range(max_iterations):
        cross = np.cross(w[indexed[:, 1]]-w[indexed[:, 0]], w[indexed[:, 2]]-w[indexed[:, 0]])
        signed = np.sum(cross*reference, axis=1)
        bad = np.where(active & (signed<threshold*.999))[0]
        if not len(bad):
            break
        for fi in bad:
            ids = indexed[fi]
            a, b = w[ids[1]]-w[ids[0]], w[ids[2]]-w[ids[0]]
            g1, g2 = np.cross(b, reference[fi]), np.cross(reference[fi], a)
            grad = np.array([-g1-g2, g1, g2])*free[ids, None]
            missing = threshold[fi]-np.dot(np.cross(a, b), reference[fi])
            if missing>0:
                w[ids] += (missing+threshold[fi]*.1)*grad/max(np.sum(grad*grad), 1e-20)
    assert not len(bad), 'Do not deliver a candidate with local reversed faces.'
    return w[inverse], reference, {'constraintIterations': iteration,
        'maxConstraintCorrection': float(np.linalg.norm(w[inverse]-moved, axis=1).max())}


def main():
    doc, binary, raw = load(SOURCE)
    original = bytes(binary)
    prim = doc['meshes'][110]['primitives'][0]
    v, n = [accessor(doc, binary, prim['attributes'][k]).astype(float) for k in ['POSITION', 'NORMAL']]
    faces = accessor(doc, binary, prim['indices']).reshape(-1, 3)
    x, y, z = v.T
    fit = (abs(x)<1.95)&(z>-5.4)&(z<-3)&(y>1.55)
    matrix = np.array([x**(2*i)*(z+4.5)**j for i, j in TERMS]).T
    coeff = np.linalg.lstsq(matrix[fit], y[fit], rcond=None)[0]
    moved, reference, report = constrain_faces(v, deform(v, coeff), faces, coeff)
    changed = np.any(moved != v, axis=1)
    normals = n.copy()
    jac = jacobian(v, coeff)
    normals[changed] = np.linalg.solve(jac[changed].transpose(0, 2, 1), n[changed, :, None])[:, :, 0]
    normals[changed] /= np.linalg.norm(normals[changed], axis=1)[:, None]
    prim['attributes']['POSITION'] = append_vectors(doc, binary, moved)
    prim['attributes']['NORMAL'] = append_vectors(doc, binary, normals)
    assert bytes(binary[:len(original)]) == original
    content = write(TARGET, doc, binary)
    report.update(source=SOURCE.name, sourceSha256=hashlib.sha256(raw).hexdigest(),
        candidate=TARGET.name, candidateSha256=hashlib.sha256(content).hexdigest(),
        changedCanopyVertices=int(changed.sum()), totalCanopyVertices=len(v),
        changedSourceBounds=[v[changed].min(0).tolist(), v[changed].max(0).tolist()],
        maxDisplacement=float(np.linalg.norm(moved-v, axis=1).max()),
        materialRestoredExactlyFromR2=True, trianglesAddedOrRemoved=False,
        hullChanged=False, visualAccepted=False)
    (BASE/'接缝对齐-r7-制作记录.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    np.savez(BASE/'alignment-r7-orientation-reference.npz', normals=reference)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
