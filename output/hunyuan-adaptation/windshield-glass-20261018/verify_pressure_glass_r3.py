"""Independently verify that the r3 update changes only the glass material."""
import copy
import hashlib
import json
from pathlib import Path

from glb_surface_io import load

BASE = Path(__file__).resolve().parent


def main():
    report = json.loads((BASE / '航天舷窗-r3-材质记录.json').read_text())
    source, source_bin, original = load(BASE / report['source'])
    candidate, binary, raw = load(BASE / report['candidate'])
    review, review_bin, review_raw = load(BASE / report['review'])
    for data, key in [(original, 'sourceSha256'), (raw, 'candidateSha256'), (review_raw, 'reviewSha256')]:
        assert hashlib.sha256(data).hexdigest() == report[key]
    assert source_bin == binary == review_bin
    assert source['meshes'] == candidate['meshes'] == review['meshes']
    assert source['accessors'] == candidate['accessors'] == review['accessors']
    assert source['materials'][:-1] == candidate['materials'][:-1]
    assert candidate['materials'] == review['materials']
    normalized = copy.deepcopy(candidate)
    normalized['materials'][-1] = source['materials'][-1]
    normalized['extensionsUsed'] = source['extensionsUsed']
    assert normalized == source
    normalized_review = copy.deepcopy(review)
    normalized_review['scenes'] = candidate['scenes']
    normalized_review['scene'] = candidate.get('scene', 0)
    assert normalized_review == candidate
    material_index = len(candidate['materials']) - 1
    assignments = []
    for index, mesh in enumerate(candidate['meshes']):
        for primitive in mesh['primitives']:
            if primitive.get('material') == material_index:
                assignments.append({'mesh': index, 'triangles': candidate['accessors'][primitive['indices']]['count'] // 3})
    assert len(assignments) == 3
    result = {'sourceAndRevisionShaMatch': True, 'binaryExact': True,
              'allMeshAndMaterialAssignmentsExact': True, 'onlyGlassMaterialChanged': True,
              'allOtherDocumentFieldsExact': True, 'allOtherMaterialsExact': True,
              'activeReviewSceneOnlyDifference': True, 'glassPrimitives': assignments,
              'physicalThicknessAdded': False, 'visualAccepted': False,
              'khronosValidatorRun': False, 'browserInteractionRun': False}
    (BASE / '航天舷窗-r3-独立核验.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
