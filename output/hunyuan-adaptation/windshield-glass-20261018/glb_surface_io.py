"""Read and append glTF buffers without re-exporting existing mesh attributes."""
import json
import struct
from pathlib import Path

import numpy as np


def load(path):
    raw = Path(path).read_bytes()
    magic, version, total = struct.unpack_from('<III', raw)
    assert magic == 0x46546C67 and version == 2 and total == len(raw)
    length, kind = struct.unpack_from('<I4s', raw, 12)
    assert kind == b'JSON'
    doc = json.loads(raw[20:20 + length])
    size, kind = struct.unpack_from('<I4s', raw, 20 + length)
    assert kind == b'BIN\0'
    binary = raw[28 + length:28 + length + size]
    assert not doc.get('extensionsRequired'), 'Use the uncompressed source master.'
    return doc, bytearray(binary), raw


def accessor(doc, binary, index):
    row = doc['accessors'][index]
    view = doc['bufferViews'][row['bufferView']]
    assert view.get('buffer', 0) == 0 and 'sparse' not in row
    width = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[row['type']]
    dtype = np.dtype({5126: '<f4', 5125: '<u4', 5123: '<u2'}[row['componentType']])
    offset = view.get('byteOffset', 0) + row.get('byteOffset', 0)
    stride = view.get('byteStride', width * dtype.itemsize)
    return np.ndarray((row['count'], width), dtype, binary, offset,
                      strides=(stride, dtype.itemsize)).copy()


def append_indices(doc, binary, values):
    values = np.asarray(values, dtype='<u4').reshape(-1)
    binary.extend(b'\0' * (-len(binary) % 4))
    offset = len(binary)
    binary.extend(values.tobytes())
    doc['bufferViews'].append({'buffer': 0, 'byteOffset': offset,
                               'byteLength': values.nbytes, 'target': 34963})
    doc['accessors'].append({'bufferView': len(doc['bufferViews']) - 1,
                             'componentType': 5125, 'count': len(values), 'type': 'SCALAR'})
    return len(doc['accessors']) - 1


def write(path, doc, binary):
    path = Path(path)
    assert not path.exists(), 'Existing sources and candidates must never be overwritten.'
    binary.extend(b'\0' * (-len(binary) % 4))
    doc['buffers'][0]['byteLength'] = len(binary)
    data = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode()
    data += b' ' * (-len(data) % 4)
    result = (struct.pack('<III', 0x46546C67, 2, 28 + len(data) + len(binary))
              + struct.pack('<I4s', len(data), b'JSON') + data
              + struct.pack('<I4s', len(binary), b'BIN\0') + binary)
    path.write_bytes(result)
    return result
