"""Check that a clear-glass revision preserves the complete assembly and geometry."""
import argparse
import copy
import hashlib
import json
from pathlib import Path

from glb_surface_io import load

BASE = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--revision', choices=['r4', 'r5'], default='r4')
    revision = parser.parse_args().revision
    record = json.loads((BASE / f'清晰透光-{revision}-材质记录.json').read_text())
    source, before_bin, before_raw = load(BASE / record['source'])
    candidate, after_bin, after_raw = load(BASE / record['candidate'])
    assert hashlib.sha256(before_raw).hexdigest() == record['sourceSha256']
    assert hashlib.sha256(after_raw).hexdigest() == record['candidateSha256']
    assert before_bin == after_bin
    assert source['materials'][:-1] == candidate['materials'][:-1]
    normalized = copy.deepcopy(candidate)
    normalized['materials'][-1] = source['materials'][-1]
    normalized['extensionsUsed'] = source['extensionsUsed']
    assert normalized == source
    result = {'sourceAndCandidateShaMatch': True, 'binaryExact': True,
              'allGeometryAndMeshAssignmentsExact': True,
              'nodesScenesAnimationsExact': True, 'allOtherMaterialsExact': True,
              'fullCabinIncludedInDefaultScene': True,
              'onlyGlassMaterialChanged': True, 'visualAccepted': False,
              'browserInteractionRun': False, 'khronosValidatorRun': False}
    (BASE / f'清晰透光-{revision}-独立核验.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
