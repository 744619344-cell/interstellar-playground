"""Fetch only the user-approved character at a pinned public Microsoft revision."""
import concurrent.futures
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
PLAN = json.loads((ROOT / 'download-plan.json').read_text(encoding='utf-8'))


def fetch(entry):
    source = entry['path']
    relative = source.split('/Medical_Female_03/', 1)[-1]
    target = ROOT / 'original' / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        data = target.read_bytes()
    else:
        request = Request(entry['url'], headers={'User-Agent': 'Character-source-review'})
        with urlopen(request, timeout=90) as response:
            data = response.read()
        target.open('xb').write(data)
    git_sha = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
    if entry.get('size') is not None and len(data) != entry['size']:
        raise ValueError(f'Unexpected size: {relative}')
    if entry.get('sha') is not None and git_sha != entry['sha']:
        raise ValueError(f'Unexpected Git blob: {relative}')
    print(f'Verified {relative}: {len(data)} bytes', flush=True)
    return {**entry, 'local': 'original/' + relative, 'bytes': len(data),
            'gitBlob': git_sha, 'sha256': hashlib.sha256(data).hexdigest()}


if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(fetch, PLAN['files']))
    ledger = {**PLAN, 'retrieved': '2026-10-27', 'files': results}
    ledger_path = ROOT / 'source-manifest.json'
    with ledger_path.open('x', encoding='utf-8') as out:
        json.dump(ledger, out, indent=2, ensure_ascii=False)
        out.write('\n')
