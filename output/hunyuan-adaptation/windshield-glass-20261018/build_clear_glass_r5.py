"""Restore clear cabin visibility; material-only update from the preserved r4."""
import copy
import hashlib
import json
from pathlib import Path

from glb_surface_io import load, write

BASE = Path(__file__).resolve().parent


def main():
    source = BASE / '前挡玻璃-清晰透光-r4.glb'
    doc, binary, raw = load(source)
    assert hashlib.sha256(raw).hexdigest() == 'f639fa2dd16380dacdbf2167fcd341202b0ef82163e7a0b447b6a2da11b4b489'
    before = copy.deepcopy(doc)
    material = doc['materials'][-1]
    material.update(name='前挡与左右侧窗_清晰透光_r5', alphaMode='BLEND')
    material['pbrMetallicRoughness'] = {
        'baseColorFactor': [.008, .015, .02, .05], 'metallicFactor': 0, 'roughnessFactor': .08}
    material['extensions'] = {
        'KHR_materials_ior': {'ior': 1.46},
        'KHR_materials_specular': {'specularFactor': .15, 'specularColorFactor': [1, 1, 1]}}
    assert all('KHR_materials_transmission' not in m.get('extensions', {}) for m in doc['materials'])
    doc['extensionsUsed'] = [e for e in doc['extensionsUsed'] if e != 'KHR_materials_transmission']
    normalized = copy.deepcopy(doc)
    normalized['materials'][-1] = before['materials'][-1]
    normalized['extensionsUsed'] = before['extensionsUsed']
    assert normalized == before
    target = BASE / '前挡玻璃-清晰透光-r5.glb'
    content = write(target, doc, binary)
    report = {'source': source.name, 'sourceSha256': hashlib.sha256(raw).hexdigest(),
              'candidate': target.name, 'candidateSha256': hashlib.sha256(content).hexdigest(),
              'material': material, 'binaryAndGeometryUnchanged': True,
              'initialScene': 'Original complete assembly, including cabin furnishings',
              'intent': 'Clear interior visibility: remove r4 white diffuse veil; retain faint edge reflection.',
              'physicalMultiPaneSimulation': False, 'visualAccepted': False}
    (BASE / '清晰透光-r5-材质记录.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
