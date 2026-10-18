"""Verify the cloud interior handoff using only Python's standard library."""
import argparse
import hashlib
import json
import struct
from pathlib import Path


def contained(root, relative):
    path = (root / relative).resolve()
    try:
        path.relative_to(root)
    except ValueError:
        raise ValueError('Manifest path escapes the project root')
    return path


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            result.update(block)
    return result.hexdigest()


def check_glb(path):
    with path.open('rb') as source:
        magic, version, length = struct.unpack('<4sII', source.read(12))
        if (magic, version, length) != (b'glTF', 2, path.stat().st_size):
            raise ValueError('Invalid GLB header: ' + path.name)
        size, kind = struct.unpack('<II', source.read(8))
        if kind != 0x4E4F534A or size > length - 20:
            raise ValueError('Invalid GLB JSON chunk: ' + path.name)
        document = json.loads(source.read(size))
    for key in ('buffers', 'images'):
        for resource in document.get(key, []):
            uri = resource.get('uri', '')
            if uri and not uri.startswith('data:'):
                raise ValueError('GLB requires an external resource: ' + path.name)


def verify(root, manifest):
    checked = set()
    for row in manifest['files']:
        path = contained(root, row['path'])
        if path.stat().st_size != row['bytes'] or digest(path) != row['sha256']:
            raise ValueError('Binary asset differs: ' + row['path'])
        checked.add(row['path'])
    records = set()
    for name in manifest['textRecords']:
        record = contained(root, name)
        text = record.read_text('utf-8-sig')
        if record.suffix == '.json':
            json.loads(text)
        records.add(name)
    for model in manifest['models']:
        path = contained(root, model['model'])
        if model['model'] not in checked:
            raise ValueError('Model missing from binary manifest')
        check_glb(path)
        for name in model['historicalMetadata']:
            record = contained(root, name)
            text = record.read_text('utf-8-sig')
            if record.suffix == '.json':
                data = json.loads(text)
                if record.name == '混元执行记录.json':
                    for relative in data.get('inputFiles', []):
                        candidate = (record.parent / relative).resolve()
                        key = candidate.relative_to(root).as_posix()
                        if key not in checked:
                            raise ValueError('Generation input missing: ' + key)
            records.add(name)
    return {'models': len(manifest['models']), 'binaryAssets': len(checked),
            'historicalRecords': len(records), 'sha256': 'passed',
            'glbHeadersAndEmbeddedResources': 'passed',
            'visualOrAssemblyAcceptance': 'not evaluated'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    root = args.root.resolve()
    manifest = json.loads((root / 'docs/cloud-interior-assets-20261018.json').read_text('utf8'))
    print(json.dumps(verify(root, manifest), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
