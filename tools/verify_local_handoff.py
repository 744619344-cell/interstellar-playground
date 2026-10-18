"""Read-only verification of the 2026-10-18 local development handoff."""
import hashlib
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def checked_path(relative):
    path = (ROOT / relative).resolve()
    if not path.is_relative_to(ROOT) or not path.is_file():
        raise ValueError(f'Missing or invalid handoff file: {relative}')
    return path


def verify_file(row):
    data = checked_path(row['path']).read_bytes()
    if len(data) != row['bytes']:
        raise ValueError(f"Size mismatch: {row['path']}")
    if hashlib.sha256(data).hexdigest() != row['sha256']:
        raise ValueError(f"SHA256 mismatch: {row['path']}")


def verify_model(row):
    data = checked_path(row['source']).read_bytes()
    if hashlib.sha256(data).hexdigest() != row['sha256']:
        raise ValueError(f"Source SHA256 mismatch: {row['source']}")
    magic, version, size = struct.unpack_from('<4sII', data)
    if (magic, version, size) != (b'glTF', 2, len(data)):
        raise ValueError(f"Invalid GLB header: {row['source']}")


def main():
    manifest = json.loads(checked_path('docs/local-handoff-20261018.json').read_text(encoding='utf-8'))
    for row in manifest['files']:
        verify_file(row)
    assembly = json.loads(checked_path(manifest['selectedAssembly']).read_text(encoding='utf-8'))
    sources = {row['source']: row for row in assembly['sources']}
    for row in sources.values():
        verify_model(row)
    for relative in manifest['runtimeDependencies']:
        checked_path(relative)
    print(json.dumps({'handoffFilesVerified': len(manifest['files']),
                      'assemblyGroups': len(assembly['sources']),
                      'uniqueSourceModelsVerified': len(sources),
                      'wholeCabinVisualAccepted': False,
                      'limits': 'Hashes, GLB headers and runtime dependency presence only.'},
                     ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
