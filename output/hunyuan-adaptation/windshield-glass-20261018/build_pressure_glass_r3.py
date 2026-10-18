"""Material-only pressure-window visual approximation; retain every mesh byte."""
import copy
import hashlib
import json
from pathlib import Path

from glb_surface_io import load, write

BASE = Path(__file__).resolve().parent


def main():
    source = BASE / '前挡玻璃-材质分离候选-r2.glb'
    doc, binary, raw = load(source)
    assert hashlib.sha256(raw).hexdigest() == '327f635e0df8a573d87d2626e10c459b43968d765bc255db2d5241ae071de5b0'
    before = copy.deepcopy(doc)
    material = doc['materials'][-1]
    assert '透明光学玻璃候选' in material['name']
    material.update(name='前挡与左右侧窗_航天舷窗观感_r3', alphaMode='OPAQUE')
    material['pbrMetallicRoughness'] = {
        'baseColorFactor': [.86, .91, .92, 1], 'metallicFactor': 0, 'roughnessFactor': .095}
    material['extensions'] = {
        'KHR_materials_transmission': {'transmissionFactor': .96},
        'KHR_materials_ior': {'ior': 1.46},
        'KHR_materials_specular': {'specularFactor': .5, 'specularColorFactor': [1, 1, 1]}}
    doc['extensionsUsed'] = sorted(set(doc.get('extensionsUsed', []))
                                   | set(material['extensions']))
    check = copy.deepcopy(doc)
    check['materials'][-1] = before['materials'][-1]
    check['extensionsUsed'] = before['extensionsUsed']
    assert check == before, 'Only the glass material and extension declaration may change.'
    target = BASE / '前挡玻璃-航天舷窗材质-r3.glb'
    content = write(target, doc, binary)
    review_doc = copy.deepcopy(doc)
    nodes = [i for i, node in enumerate(doc['nodes'])
             if node.get('extras', {}).get('module') in ['exterior-hull', 'exterior-glass']]
    review_doc['scenes'].append({'name': 'Pressure window material review', 'nodes': nodes})
    review_doc['scene'] = len(review_doc['scenes']) - 1
    review_path = BASE / '前挡玻璃-航天舷窗审阅-r3.glb'
    review = write(review_path, review_doc, binary)
    report = {'source': source.name, 'sourceSha256': hashlib.sha256(raw).hexdigest(),
              'candidate': target.name, 'candidateSha256': hashlib.sha256(content).hexdigest(),
              'review': review_path.name, 'reviewSha256': hashlib.sha256(review).hexdigest(),
              'glassMaterial': material, 'meshGeometryChanged': False,
              'meshAssignmentsChanged': False, 'originalMaterialsExceptGlassUnchanged': True,
              'volumeSimulation': 'Not used: source panes have open boundaries; no actual thickness added.',
              'realWindowReferences': [
                  'https://www.nasa.gov/missions/artemis/orion/orion-window-testing-brings-artemis-1-closer-into-view/',
                  'https://www.nasa.gov/missions/artemis/orion/a-window-to-space/'],
              'interpretation': 'Visual approximation only; tint and PBR numbers are art parameters, not NASA measurements.',
              'visualAccepted': False}
    (BASE / '航天舷窗-r3-材质记录.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
