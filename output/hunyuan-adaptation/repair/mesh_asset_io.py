"""Small, uncompressed static GLB helpers for source-preserving asset repairs."""
import json
import struct
from pathlib import Path
import numpy as np


def load(path):
    data = Path(path).read_bytes()
    assert struct.unpack_from('<III', data) == (0x46546C67, 2, len(data))
    size = struct.unpack_from('<I', data, 12)[0]
    doc = json.loads(data[20:20 + size])
    return doc, data[28 + size:], data


def accessor(doc, binary, index):
    a = doc['accessors'][index]
    view = doc['bufferViews'][a['bufferView']]
    assert not a.get('sparse') and not a.get('normalized')
    count = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    dtype = np.dtype({5126: '<f4', 5125: '<u4', 5123: '<u2'}[a['componentType']])
    offset = view.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = view.get('byteStride', count * dtype.itemsize)
    assert offset + (a['count'] - 1) * stride + count * dtype.itemsize <= len(binary)
    return np.ndarray((a['count'], count), dtype=dtype, buffer=binary,
                      offset=offset, strides=(stride, dtype.itemsize)).copy()


def mesh_arrays(doc, binary, index):
    primitives = doc['meshes'][index]['primitives']
    first = primitives[0]
    attrs = {k: accessor(doc, binary, v) for k, v in first['attributes'].items()}
    assert all(p['attributes'] == first['attributes'] for p in primitives)
    groups = [(p.get('material', 0), accessor(doc, binary, p['indices']).reshape(-1, 3))
              for p in primitives]
    return attrs, groups


def material(name, color, metallic=.15, roughness=.65):
    return {'name': name, 'pbrMetallicRoughness': {
        'baseColorFactor': [*color, 1], 'metallicFactor': metallic,
        'roughnessFactor': roughness}}


def declared_extensions(value):
    names = set()
    if isinstance(value, dict):
        names.update(value.get('extensions', {}))
        for child in value.values():
            names.update(declared_extensions(child))
    elif isinstance(value, list):
        for child in value:
            names.update(declared_extensions(child))
    return names


def save(path, meshes, materials, nodes, image_data=None):
    path = Path(path)
    assert not path.exists(), 'Do not overwrite an existing asset.'
    doc = {'asset': {'version': '2.0', 'generator': 'Source mesh repair'},
           'scenes': [{'nodes': list(range(len(nodes)))}], 'scene': 0,
           'nodes': nodes, 'materials': materials, 'meshes': [],
           'accessors': [], 'bufferViews': [], 'buffers': []}
    chunks, size = [], 0

    def write(values, kind, target):
        nonlocal size
        values = np.asarray(values, dtype='<u4' if kind == 'SCALAR' else '<f4')
        padding = (-size) % 4
        chunks.append(b'\0' * padding)
        size += padding
        view = {'buffer': 0, 'byteOffset': size, 'byteLength': values.nbytes, 'target': target}
        doc['bufferViews'].append(view)
        chunks.append(values.tobytes())
        size += values.nbytes
        a = {'bufferView': len(doc['bufferViews']) - 1,
             'componentType': 5125 if kind == 'SCALAR' else 5126,
             'count': values.size if kind == 'SCALAR' else len(values), 'type': kind}
        if kind == 'VEC3':
            a.update(min=values.min(0).tolist(), max=values.max(0).tolist())
        doc['accessors'].append(a)
        return len(doc['accessors']) - 1

    for attrs, groups in meshes:
        encoded = {k: write(v, 'VEC3' if v.shape[1] == 3 else 'VEC2', 34962)
                   for k, v in attrs.items()}
        doc['meshes'].append({'primitives': [
            {'attributes': encoded, 'indices': write(tri, 'SCALAR', 34963), 'material': mat}
            for mat, tri in groups if len(tri)]})
    image_list = ([image_data] if image_data and isinstance(image_data[0], bytes) else image_data) or []
    for image, mime_type in image_list:
        padding = (-size) % 4
        chunks.append(b'\0' * padding)
        size += padding
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': size, 'byteLength': len(image)})
        chunks.append(image)
        size += len(image)
        doc.setdefault('images', []).append({'bufferView': len(doc['bufferViews']) - 1, 'mimeType': mime_type})
        doc.setdefault('textures', []).append({'source': len(doc['images']) - 1})
    doc['buffers'] = [{'byteLength': size}]
    used = declared_extensions(doc)
    if used:
        doc['extensionsUsed'] = sorted(used)
    encoded = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode()
    encoded += b' ' * ((-len(encoded)) % 4)
    binary = b''.join(chunks) + b'\0' * ((-size) % 4)
    result = (struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary))
              + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
              + struct.pack('<II', len(binary), 0x004E4942) + binary)
    path.write_bytes(result)
    return result
