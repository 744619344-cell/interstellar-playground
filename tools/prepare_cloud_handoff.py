"""Inventory a portable, explicit cloud handoff; never stage or modify model files."""
import hashlib,json,re,subprocess,struct,sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DESIGN='output/hunyuan-adaptation/hunyuan-design-20261009'
SOURCE='assets-source/blender/spacecraft/redesign/hunyuan-adaptation/hunyuan-design-20261009'

def git_paths(*args):
 result=subprocess.run(['git',*args],cwd=ROOT,capture_output=True,check=True)
 return [row.decode('utf8') for row in result.stdout.split(b'\0') if row]

def selected_paths():
 files=set(git_paths('diff','HEAD','--name-only','-z'))
 files.discard('docs/cloud-handoff-manifest.json')
 files.update(git_paths('ls-files','--others','--exclude-standard','-z','--','src'))
 files.update(['tools/prepare_cloud_handoff.py','docs/tasks/2026-09-23-p3-r01-spacecraft-art-redesign.md',
 'docs/tasks/2026-09-21-p4-t01-astronaut-rig.md','docs/space-exploration/16-ASTRONAUT-CANDIDATE.md'])
 for name in ['驾驶围护局部调整','驾驶围护同舱试装-v9','前窗同舱试装-v2','门叶同框试装-v2']:
  files.update(f'{DESIGN}/{name}{ext}' for ext in ['.html','.mjs'])
 files.add(f'{DESIGN}/驾驶围护观察移动.mjs')
 for name in ['build_v9_local_revision','v9_local_asset','v9_roof_tuning','v9_front_fit','v9_handle_local','verify_v9_local_revision']:
  files.add(f'{DESIGN}/{name}.py')
 for name in ['mesh_asset_io','verify_static_asset']:
  files.add(f'output/hunyuan-adaptation/repair/{name}.py')
 for name in ['内门隔舱总成-v15','内门门叶-v2','前窗总成-v2','驾驶围护总成-v9']:
  files.add(f'{DESIGN}/{name}/混元原始模型.glb')
  files.update(p.relative_to(ROOT).as_posix() for p in (ROOT/DESIGN/name).glob('*.json'))
 for name in ['驾驶围护总成-v9','前窗总成-v2','内门门叶-v2','内门隔舱总成-v15']:
  folder=ROOT/SOURCE/name
  if folder.exists():
   files.update(p.relative_to(ROOT).as_posix() for p in folder.iterdir() if p.suffix in ['.png','.md','.json','.txt'] and '初稿' not in p.name and '未提交' not in p.name)
 tune=ROOT/DESIGN/'局部调整-v9-20261012'
 files.update(p.relative_to(ROOT).as_posix() for p in tune.iterdir() if 'r9' in p.name or p.name=='实装观察结论.json')
 master=ROOT/'output/hunyuan-adaptation/master-design-20261009'
 files.add((master/'整舱统一母版-v6.glb').relative_to(ROOT).as_posix())
 for name in ['v6-structure-检查.json','v6-hull-检查.json','v6-sweep-检查.json','v6-berths-检查.json','装配清单-v6.json','模块装配坐标-v6.json']:
  files.add((master/name).relative_to(ROOT).as_posix())
 return sorted(files)

def audit(files,from_index=False):
 findings=[];rows=[]
 for name in files:
  path=ROOT/name
  if not path.is_file():raise FileNotFoundError(name)
  raw=subprocess.run(['git','show',':'+name],cwd=ROOT,capture_output=True,check=True).stdout if from_index else path.read_bytes()
  if len(raw)>=100*1024*1024:findings.append({'file':name,'issue':'over GitHub single-file size limit'})
  if path.suffix.lower() in ['.md','.json','.ts','.tsx','.js','.mjs','.html','.css','.py','.txt','.ps1','.glb']:
   if path.suffix.lower()=='.glb':
    size=struct.unpack_from('<I',raw,12)[0];text=raw[20:20+size].decode('utf8')
   else:text=raw.decode('utf-8-sig')
   if re.search(r'[A-Za-z]:[\\/]+(?:Users|Desktop|Windows)[\\/]',text):findings.append({'file':name,'issue':'machine absolute path'})
   if re.search(r'https?://[^\s"<>]*[?&](?:token|signature|sign|credential)=',text,re.I):findings.append({'file':name,'issue':'signed or credential URL'})
   if re.search(r'\b(?:api_key|access_token|refresh_token|cookie)\s*[:=]\s*[\"\'][A-Za-z0-9_+/=-]{16,}',text,re.I):findings.append({'file':name,'issue':'possible credential value'})
  rows.append({'path':name,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()})
 return rows,findings

def main():
 files=selected_paths();from_index='--from-index' in sys.argv;rows,findings=audit(files,from_index)
 if findings:
  print(json.dumps({'auditFindings':findings},ensure_ascii=False));raise SystemExit(1)
 manifest={'branch':'codex/cloud-handoff-20261013','activeTask':'docs/tasks/2026-09-23-p3-r01-spacecraft-art-redesign.md',
 'selectedAsset':'output/hunyuan-adaptation/hunyuan-design-20261009/局部调整-v9-20261012/围护v9-局部修订-r9.glb',
 'explicitGeometryScope':['v9 front-window/roof interface','two deformed v9 handles','missing v9 ceiling strips'],
 'wholeCabinAccepted':False,'productReplaced':False,'cloudJobsAdded':0,
 'hashScope':'Git index blob bytes; normalized text line endings' if from_index else 'Pre-stage local bytes; refresh from index before commit',
 'excludedLocalOnly':['intermediate/rejected GLB archives','Python caches and render/build logs','Blender history','local ZIP imports','legacy hunyuanPreview high-poly diagnostic assets'],
 'pythonChecksRequire':['numpy','Pillow'],'files':rows}
 (ROOT/'docs/cloud-handoff-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n','utf8')
 (ROOT/'output/cloud-handoff-paths.json').write_text(json.dumps(files+['docs/cloud-handoff-manifest.json'],ensure_ascii=False,indent=2)+'\n','utf8')
 (ROOT/'output/cloud-handoff-pathspec.txt').write_bytes(b'\0'.join(name.encode('utf8') for name in files+['docs/cloud-handoff-manifest.json'])+b'\0')
 print(json.dumps({'files':len(files)+1,'bytes':sum(row['bytes'] for row in rows),'largest':max(row['bytes'] for row in rows)},ensure_ascii=False))

if __name__=='__main__':main()
