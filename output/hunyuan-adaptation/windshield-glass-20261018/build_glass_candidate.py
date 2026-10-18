"""User-authorized pane material reassignment; no vertices or triangles are added."""
import copy
import hashlib
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image

from glb_surface_io import accessor, append_indices, load, write

BASE = Path(__file__).resolve().parent
ROOT = BASE.parents[2]
SOURCE = ROOT / 'output/hunyuan-adaptation/master-design-20261009/整舱统一母版-v6.glb'


def pane_mask(doc, binary, primitive):
    vertices = accessor(doc, binary, primitive['attributes']['POSITION'])
    faces = accessor(doc, binary, primitive['indices']).reshape(-1, 3)
    uv = accessor(doc, binary, primitive['attributes']['TEXCOORD_0'])
    material = doc['materials'][primitive['material']]
    texture = material['pbrMetallicRoughness']['baseColorTexture']['index']
    image = doc['images'][doc['textures'][texture]['source']]
    view = doc['bufferViews'][image['bufferView']]
    pixels = np.asarray(Image.open(io.BytesIO(binary[view['byteOffset']:
                                 view['byteOffset'] + view['byteLength']])))
    xy = (uv[faces].mean(1) * [pixels.shape[1], pixels.shape[0]]).astype(int)
    colors = pixels[xy[:, 1] % pixels.shape[0], xy[:, 0] % pixels.shape[1], :3]
    center = vertices[faces].mean(1)
    x, y, z = center.T
    # Anatomical side-pane bounds, independent of the rest of the ship's dark details.
    region = ((np.abs(x) > 2.1) & (z > -5.35) & (z < -2.85) & (y < 2.08)
              & (y > .21 + .29 * (z + 4)) & (z < -3.03 + .18 * (y - 1)))
    mask = region & (colors.max(1) < 150)
    return faces, center, mask


def main():
    doc, binary, raw = load(SOURCE)
    original_binary = bytes(binary)
    hull = next(n for n in doc['nodes'] if n.get('extras', {}).get('module') == 'exterior-hull')
    mesh = doc['meshes'][hull['mesh']]
    assert len(mesh['primitives']) == 1
    primitive = mesh['primitives'][0]
    faces, center, mask = pane_mask(doc, binary, primitive)
    material = len(doc['materials'])
    doc['materials'].append({'name': '前挡与左右侧窗_透明光学玻璃候选', 'doubleSided': True, 'alphaMode': 'BLEND',
        'pbrMetallicRoughness': {'baseColorFactor': [.82, .94, 1, .28],
                               'metallicFactor': 0, 'roughnessFactor': .14},
        'extensions': {'KHR_materials_transmission': {'transmissionFactor': .98},
                       'KHR_materials_ior': {'ior': 1.45}}})
    doc.setdefault('extensionsUsed', []).extend(['KHR_materials_transmission', 'KHR_materials_ior'])
    groups = [('retained-hull', ~mask, primitive['material']),
              ('left-pane', mask & (center[:, 0] < 0), material),
              ('right-pane', mask & (center[:, 0] > 0), material)]
    mesh['primitives'] = []
    report = {'source': str(SOURCE.relative_to(ROOT)), 'sourceSha256': hashlib.sha256(raw).hexdigest(),
              'hullTriangles': len(faces), 'groups': {}, 'vertexAttributesUnchanged': True}
    for name, selection, mat in groups:
        assert selection.any()
        part = copy.deepcopy(primitive)
        part.update(indices=append_indices(doc, binary, faces[selection]), material=mat,
                    extras={'reviewRegion': name})
        mesh['primitives'].append(part)
        report['groups'][name] = {'triangles': int(selection.sum()),
            'centroidBounds': [center[selection].min(0).tolist(), center[selection].max(0).tolist()]}
    canopy = next(n for n in doc['nodes'] if n.get('extras', {}).get('module') == 'exterior-glass')
    for part in doc['meshes'][canopy['mesh']]['primitives']:
        part['material'] = material
    assert bytes(binary[:len(original_binary)]) == original_binary
    assert sum(v['triangles'] for v in report['groups'].values()) == len(faces)
    output = BASE / '前挡玻璃-材质分离候选-r2.glb'
    content = write(output, doc, binary)
    report.update(candidate=output.name, candidateSha256=hashlib.sha256(content).hexdigest(),
                  geometryAdded=False, sourceOverwritten=False, visualAccepted=False)
    (BASE / '材质分离-r2-检查.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
