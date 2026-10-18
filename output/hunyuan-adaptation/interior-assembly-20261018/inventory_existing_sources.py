"""Read actual local assets; distinguish old references from missing new Hunyuan sources."""
import hashlib
import json
from pathlib import Path
import sys
import numpy as np

BASE=Path(__file__).resolve().parent
ROOT=BASE.parents[2]
sys.path.insert(0,str(ROOT/'output/hunyuan-adaptation/windshield-glass-20261018'))
from glb_surface_io import accessor,load

SOURCES=[
 ('玻璃r10及外壳','output/hunyuan-adaptation/windshield-glass-20261018/前挡玻璃-r2交点顺光-r10.glb','8a5cbaf4d60a92d348326c872e5145646525a131006ae7d79fd0b6f7882ab066','user-accepted-exterior-glazing'),
 ('隔舱v15','output/hunyuan-adaptation/hunyuan-design-20261009/内门隔舱总成-v15/混元原始模型.glb','4a2c3f8c91b7d7d7544de31ffecb8002a3f588d67d4aef8fc331cb33edd375d7','conditional-reuse-requires-new-main-structure'),
 ('门叶v2','output/hunyuan-adaptation/hunyuan-design-20261009/内门门叶-v2/混元原始模型.glb','69c05d08b54ef36cacf2f0ed3b5fbcf820d71160bab40b07043534012a0c0da9','conditional-reuse-requires-new-opening'),
 ('围护v9原件','output/hunyuan-adaptation/hunyuan-design-20261009/驾驶围护总成-v9/混元原始模型.glb','c69f8a15369ca2e18546a66748d9c50d3752bd400b883ae98fab3845eeef66e0','legacy-reference-not-current-main-structure'),
 ('围护v9局部r9','output/hunyuan-adaptation/hunyuan-design-20261009/局部调整-v9-20261012/围护v9-局部修订-r9.glb','da9a6c56a79979ba11588fa06c01057bfbbce2be34a88f929c28eda46af4903e','legacy-reference-not-current-main-structure'),
 ('前窗v2','output/hunyuan-adaptation/hunyuan-design-20261009/前窗总成-v2/混元原始模型.glb',None,'legacy-reference-current-glass-is-r10'),
 ('主结构v7','output/hunyuan-adaptation/hunyuan-design-20261009/整舱重设计-20261016/全空间重设计-v7-20261017/主结构-v7/混元原始模型.glb','25be9a6be9dfca5ada4cf3f6ef45862e0c4750f1bb7b2ecef9e76681ab968f4f','current-assembly-candidate-not-accepted'),
 ('主仪表台v2','output/hunyuan-adaptation/hunyuan-design-20261009/内舱装配-20261013/主仪表台-v2/混元原始模型.glb','5cfc76c2c01da05a40b58d4ed8fc1a684d181a1e2a0e093f2e5ad442e9feddc5','current-assembly-source'),
 ('折叠床v1','output/hunyuan-adaptation/hunyuan-design-20261009/内舱装配-20261013/折叠床-v1/混元原始模型.glb','d51982853187c866f4e581f98d9658f981295f734acb668392924a5fd5d12d26','current-assembly-shared-two-instances'),
 ('工作台v1','output/hunyuan-adaptation/hunyuan-design-20261009/内舱装配-20261013/工作台-v1/混元原始模型.glb','4a03a5bbc05902c35411020a3c536cec94822a25a2db56a919e861cb7e86643e','current-assembly-source'),
]


def transform(n):
    if 'matrix' in n:
        return np.array(n['matrix']).reshape(4,4,order='F')
    x,y,z,w=n.get('rotation',[0,0,0,1])
    r=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],
                [2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],
                [2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])
    out=np.eye(4);out[:3,:3]=r@np.diag(n.get('scale',[1,1,1]));out[:3,3]=n.get('translation',[0,0,0])
    return out


def inspect_source(row):
    name,relative,expected,status=row
    path=ROOT/relative;d,b,raw=load(path);sha=hashlib.sha256(raw).hexdigest()
    assert not expected or sha==expected, f'Protected source hash mismatch: {name}'
    points=[];triangles=0
    def visit(index,parent):
        nonlocal triangles
        n=d['nodes'][index];world=parent@transform(n)
        if 'mesh' in n:
            for p in d['meshes'][n['mesh']]['primitives']:
                v=accessor(d,b,p['attributes']['POSITION'])
                points.append(v@world[:3,:3].T+world[:3,3])
                assert p.get('mode',4)==4
                triangles+=d['accessors'][p['indices']]['count']//3
        for child in n.get('children',[]):
            visit(child,world)
    for index in d['scenes'][d.get('scene',0)]['nodes']:
        visit(index,np.eye(4))
    vertices=np.concatenate(points)
    assert hashlib.sha256(path.read_bytes()).hexdigest()==sha
    return {'name':name,'path':relative,'bytes':len(raw),'sha256':sha,
        'referenceHashMatched':expected is not None,'classification':status,
        'sceneTrianglesIncludingInstances':triangles,
        'boundsSourceUnits':[vertices.min(0).tolist(),vertices.max(0).tolist()],
        'sizeSourceUnits':np.ptp(vertices,axis=0).tolist(),
        'imageCount':len(d.get('images',[])),'animations':len(d.get('animations',[])),
        'sourceBytesUnchanged':True,'installationAccepted':False}


def main():
    report={'date':'2026-10-18','branch':'codex/cloud-handoff-20261013',
        'glassLocalUserAccepted':True,'wholeCabinAccepted':False,
        'available':[inspect_source(row) for row in SOURCES],
        'missing':[], 'assemblyBlockedBy':None,
        'resolvedByCommit':'0f620b9b9623afbf86b4273e30f3d80407dfb94b',
        'productReplaced':False,'geometryModified':False}
    (BASE/'已有来源与缺件.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({'available':[(x['name'],x['bytes'],x['sceneTrianglesIncludingInstances']) for x in report['available']],
                      'missing':[x['name'] for x in report['missing']]},ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
