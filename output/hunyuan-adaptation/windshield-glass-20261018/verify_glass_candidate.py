"""Independent preservation checks and limited rays through both side panes."""
import copy
import hashlib
import json
from pathlib import Path

import numpy as np

from glb_surface_io import accessor, load

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]


def rays(doc, binary, original_faces, assigned):
    attributes = doc['meshes'][109]['primitives'][0]['attributes']
    vertices = accessor(doc, binary, attributes['POSITION'])
    triangles = vertices[original_faces]
    e1, e2 = triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
    direction = np.array([1., 0, 0])
    h = np.cross(direction, e2)
    a = (e1 * h).sum(1)
    valid = abs(a) > 1e-9
    inv = np.divide(1., a, out=np.zeros_like(a), where=valid)
    result = []
    for z, y in [(-4.6, .45), (-4.2, .7), (-3.8, .9), (-3.4, 1.1), (-3.2, 1.4)]:
        s = np.array([-10, y, z]) - triangles[:, 0]
        u = inv * (s * h).sum(1)
        q = np.cross(s, e1)
        v = inv * q[:, 0]
        t = inv * (e2 * q).sum(1)
        hits = np.where(valid & (u >= 0) & (v >= 0) & (u + v <= 1) & (t > 0))[0]
        assert len(hits) >= 2 and all(assigned[i] for i in hits)
        result.append({'z': z, 'y': y, 'hullHits': len(hits), 'allAssignedGlass': True})
    return result


def main():
    report = json.loads((BASE / '材质分离-r2-检查.json').read_text())
    source, source_bin, source_raw = load(ROOT / report['source'])
    candidate, candidate_bin, raw = load(BASE / report['candidate'])
    assert hashlib.sha256(source_raw).hexdigest() == report['sourceSha256']
    assert hashlib.sha256(raw).hexdigest() == report['candidateSha256']
    assert bytes(candidate_bin[:len(source_bin)]) == bytes(source_bin)
    assert source['nodes'] == candidate['nodes']
    assert source['scenes'] == candidate['scenes']
    assert source.get('animations') == candidate.get('animations')
    assert source['materials'] == candidate['materials'][:-1]
    original = source['meshes'][109]['primitives'][0]
    faces = accessor(source, source_bin, original['indices']).reshape(-1, 3)
    rows, assigned = [], {}
    for part in candidate['meshes'][109]['primitives']:
        assert part['attributes'] == original['attributes']
        indices = accessor(candidate, candidate_bin, part['indices']).reshape(-1, 3)
        rows.extend(tuple(int(n) for n in face) for face in indices)
        for face in indices:
            assigned[tuple(face)] = part['material'] != original['material']
    original_rows = [tuple(int(n) for n in face) for face in faces]
    assert sorted(rows) == sorted(original_rows), 'Every oriented source triangle must appear exactly once.'
    for index, mesh in enumerate(source['meshes']):
        if index not in (109, 110):
            assert mesh == candidate['meshes'][index]
    canopy = copy.deepcopy(candidate['meshes'][110])
    for index, part in enumerate(canopy['primitives']):
        part['material'] = source['meshes'][110]['primitives'][index]['material']
    assert canopy == source['meshes'][110]
    for index, row in enumerate(source['accessors']):
        assert row == candidate['accessors'][index]
        assert np.array_equal(accessor(source, source_bin, index),
                              accessor(candidate, candidate_bin, index))
    by_face = {i: assigned[tuple(face)] for i, face in enumerate(faces)}
    output = {'sourceAndCandidateShaMatch': True, 'originalBinaryPrefixExact': True,
              'allOriginalAccessorsExact': len(source['accessors']),
              'hullTriangleMultisetAndWindingExact': len(faces),
              'otherMeshesUnchanged': len(source['meshes']) - 2,
              'nodesScenesAnimationsUnchanged': True,
              'finiteSidePaneRays': rays(source, source_bin, faces, by_face),
              'limitations': 'Limited exterior rays; not a topology, full visibility or art acceptance.'}
    (BASE / '独立保留与视线检查.json').write_text(json.dumps(output, ensure_ascii=False, indent=2))
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
