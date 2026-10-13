"""Asset sanity checks; explicitly not a replacement for Khronos glTF Validator."""
import hashlib
import io
import json
from pathlib import Path
import sys
import numpy as np
from PIL import Image
from mesh_asset_io import load, accessor


def verify(path):
    doc, binary, raw = load(path)
    assert len(doc['buffers']) == 1
    assert doc['buffers'][0]['byteLength'] <= len(binary)
    for view in doc['bufferViews']:
        assert view.get('buffer', 0) == 0
        assert view.get('byteOffset', 0) + view['byteLength'] <= len(binary)
        assert view.get('byteOffset', 0) % 4 == 0
    arrays = [accessor(doc, binary, i) for i in range(len(doc['accessors']))]
    for descriptor, values in zip(doc['accessors'], arrays):
        assert np.isfinite(values).all()
        if 'min' in descriptor:
            assert np.allclose(values.min(0), descriptor['min'], atol=1e-6)
            assert np.allclose(values.max(0), descriptor['max'], atol=1e-6)
    meshes = []
    for mesh in doc['meshes']:
        triangles, degenerate, opposed, normal_error = 0, 0, 0, 0.0
        for p in mesh['primitives']:
            assert p.get('mode', 4) == 4
            pos = arrays[p['attributes']['POSITION']]
            normal = arrays[p['attributes']['NORMAL']]
            assert pos.shape == normal.shape
            error = float(abs(np.linalg.norm(normal, axis=1) - 1).max())
            assert error < .02, 'Normals must be normalized.'
            normal_error = max(normal_error, error)
            ids = arrays[p['indices']].reshape(-1, 3)
            assert ids.min() >= 0 and ids.max() < len(pos)
            mat = doc['materials'][p['material']]['pbrMetallicRoughness']
            if mat.get('baseColorTexture'):
                uv = arrays[p['attributes']['TEXCOORD_0']]
                assert len(uv) == len(pos)
                assert mat['baseColorTexture']['index'] < len(doc['textures'])
            points = pos[ids]
            faces = np.cross(points[:, 1] - points[:, 0], points[:, 2] - points[:, 0])
            area = np.linalg.norm(faces, axis=1)
            degenerate += int((area < 1e-12).sum())
            dot = (faces * normal[ids].mean(1)).sum(1)
            opposed += int(((dot < -1e-12) & (area > 1e-12)).sum())
            triangles += len(ids)
        meshes.append({'triangles': triangles, 'degenerateFaces': degenerate,
                       'opposedFaceNormals': opposed, 'maxNormalLengthError': normal_error})
    roots = doc['scenes'][doc.get('scene', 0)]['nodes']
    visited = set()

    def count(node_index, ancestors):
        assert node_index not in ancestors and node_index not in visited
        visited.add(node_index)
        node = doc['nodes'][node_index]
        total = meshes[node['mesh']]['triangles'] if 'mesh' in node else 0
        for child in node.get('children', []):
            total += count(child, {*ancestors, node_index})
        return total

    scene_triangles = sum(count(i, set()) for i in roots)
    images = []
    for image in doc.get('images', []):
        view = doc['bufferViews'][image['bufferView']]
        start = view.get('byteOffset', 0)
        with Image.open(io.BytesIO(binary[start:start+view['byteLength']])) as bitmap:
            bitmap.load()
            images.append({'size': bitmap.size, 'mode': bitmap.mode})
    return {'file': Path(path).name, 'sha256': hashlib.sha256(raw).hexdigest(),
            'bytes': len(raw), 'sceneTrianglesIncludingInstances': scene_triangles,
            'meshes': meshes, 'images': images,
            'status': 'container/accessor/index/material/scene/image checks passed',
            'limits': 'Not Khronos Validator; no self-intersection, collision, visual or runtime acceptance.'}


if __name__ == '__main__':
    path = Path(sys.argv[1])
    result = verify(path)
    if len(sys.argv) > 2:
        Path(sys.argv[2]).write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    print(json.dumps(result, ensure_ascii=False))
