"""Make the exterior the initial scene in the downloadable review copy."""
import hashlib
import json
from pathlib import Path

from glb_surface_io import load, write

BASE = Path(__file__).resolve().parent
doc, binary, original = load(BASE / '前挡玻璃-材质分离候选-r2.glb')
nodes = [i for i, node in enumerate(doc['nodes'])
         if node.get('extras', {}).get('module') in ['exterior-hull', 'exterior-glass']]
assert len(nodes) == 2
doc['scenes'].append({'name': 'Exterior glass review', 'nodes': nodes})
doc['scene'] = len(doc['scenes']) - 1
target = BASE / '前挡玻璃-外观审阅.glb'
content = write(target, doc, binary)
report = {'file': target.name, 'sha256': hashlib.sha256(content).hexdigest(),
          'basedOn': '前挡玻璃-材质分离候选-r2.glb',
          'basedOnSha256': hashlib.sha256(original).hexdigest(),
          'initialScene': 'Exterior glass review', 'activeNodes': nodes,
          'change': 'Only add and select the exterior review scene; keep all mesh and material data.'}
(BASE / '外观审阅文件.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False, indent=2))
