"""Restore r2 exactly; slide only the marked upper glazing ribs along their surface."""
import copy
import hashlib
import json
from pathlib import Path

import numpy as np
from glb_surface_io import accessor, load, write

BASE = Path(__file__).resolve().parent
SOURCE = BASE / '前挡玻璃-材质分离候选-r2.glb'
TARGET = BASE / '前挡玻璃-r2接缝对齐-r6.glb'
TERMS = [(i, j) for i in range(4) for j in range(4-i)]


def smooth(t):
    t = np.clip(t, 0, 1)
    return t*t*(3-2*t)


def surface(v, coeff):
    x, _, z = v.T
    return np.array([x**(2*i)*(z+4.5)**j for i, j in TERMS]).T @ coeff


def deform(v, coeff):
    x, y, z = v.T
    # Upper rib at z=-4.53; the two lower ribs terminate near z=-4.00.
    longitudinal = smooth((z+5.35)/.65) * (1-smooth((z+4.3)/1.05))
    upper_band = smooth((y-(1.80+.43*(z+4.5))+.035)/.11)
    lateral = 1-smooth((np.abs(x)-1.95)/.16)
    delta = .53 * longitudinal * upper_band * lateral
    out = v.copy()
    out[:, 2] += delta
    out[:, 1] += surface(out, coeff)-surface(v, coeff)
    return out


def append_vectors(doc, binary, values):
    values = np.asarray(values, dtype='<f4')
    binary.extend(b'\0'*(-len(binary)%4))
    offset = len(binary)
    binary.extend(values.tobytes())
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': offset,
                              'byteLength': values.nbytes, 'target': 34962})
    doc['accessors'].append({'bufferView': len(doc['bufferViews'])-1,
        'componentType': 5126, 'count': len(values), 'type': 'VEC3',
        'min': values.min(0).tolist(), 'max': values.max(0).tolist()})
    return len(doc['accessors'])-1


def main():
    doc, binary, raw = load(SOURCE)
    original = bytes(binary)
    prim = doc['meshes'][110]['primitives'][0]
    v = accessor(doc, binary, prim['attributes']['POSITION']).astype(float)
    n = accessor(doc, binary, prim['attributes']['NORMAL']).astype(float)
    x, y, z = v.T
    fit = (abs(x)<1.95)&(z>-5.4)&(z<-3)&(y>1.55)
    matrix = np.array([x**(2*i)*(z+4.5)**j for i, j in TERMS]).T
    coeff = np.linalg.lstsq(matrix[fit], y[fit], rcond=None)[0]
    moved = deform(v, coeff)
    changed = np.any(moved != v, axis=1)
    # Transform existing normals with inverse-transpose of the local deformation.
    jac = np.empty((len(v), 3, 3))
    for axis in range(3):
        step = np.zeros_like(v); step[:, axis] = 1e-5
        jac[:, :, axis] = (deform(v+step, coeff)-deform(v-step, coeff))/2e-5
    normals = n.copy()
    normals[changed] = np.linalg.solve(jac[changed].transpose(0, 2, 1), n[changed, :, None])[:, :, 0]
    normals[changed] /= np.linalg.norm(normals[changed], axis=1)[:, None]
    assert np.linalg.det(jac).min() > 0, 'No inverted local transform'
    prim['attributes']['POSITION'] = append_vectors(doc, binary, moved)
    prim['attributes']['NORMAL'] = append_vectors(doc, binary, normals)
    assert bytes(binary[:len(original)]) == original
    content = write(TARGET, doc, binary)
    report = {'source': SOURCE.name, 'sourceSha256': hashlib.sha256(raw).hexdigest(),
        'candidate': TARGET.name, 'candidateSha256': hashlib.sha256(content).hexdigest(),
        'changedCanopyVertices': int(changed.sum()), 'totalCanopyVertices': len(v),
        'changedSourceBounds': [v[changed].min(0).tolist(), v[changed].max(0).tolist()],
        'maxDisplacement': float(np.linalg.norm(moved-v, axis=1).max()),
        'minimumJacobianDeterminant': float(np.linalg.det(jac).min()),
        'surfaceFitMedianResidual': float(np.median(abs(matrix[fit]@coeff-y[fit]))),
        'surfaceFitCoefficients': coeff.tolist(), 'materialsRestoredExactlyFromR2': True,
        'trianglesAddedOrRemoved': False, 'hullChanged': False, 'visualAccepted': False}
    (BASE/'接缝对齐-r6-制作记录.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
