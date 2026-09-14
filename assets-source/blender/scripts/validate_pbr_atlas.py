"""Independently inspect the embedded lossless pixels and retained node transforms."""
import hashlib
import io
import json
import struct
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'assets-source/blender/spacecraft/pbr'
atlas=json.loads((OUT/'atlas-report.json').read_text(encoding='utf-8'))


def load(name):
    raw=(ROOT/'src/assets/models'/name).read_bytes()
    size=struct.unpack_from('<I',raw,12)[0]
    return raw,json.loads(raw[20:20+size]),raw[28+size:]


def linear(byte):
    value=byte/255
    return value/12.92 if value<=.04045 else ((value+.055)/1.055)**2.4


results=[]
image_hashes=None
for lod in range(2):
    raw,gltf,binary=load(f'spacecraft-pbr-lod{lod}.glb')
    _,source,_=load(f'spacecraft-mechanisms-lod{lod}.glb')
    previous={n['name']:n for n in source['nodes']}
    checked=0
    for node in gltf['nodes']:
        if node['name'].startswith(('Anchor_','Seat_','Thruster_','Collider_','Rig_','Console_Bar_','Door_')):
            original=previous[node['name']]
            for prop in ('translation','rotation','scale','extras'):
                assert node.get(prop)==original.get(prop),(node['name'],prop)
            checked+=1
    hashes={}
    errors={'baseLinear':0,'roughness':0,'metallic':0,'emissionLinear':0}
    for image in gltf['images']:
        name=image['name']
        view=gltf['bufferViews'][image['bufferView']]
        encoded=binary[view['byteOffset']:view['byteOffset']+view['byteLength']]
        assert encoded==(OUT/f'{name}.webp').read_bytes(),name
        hashes[name]=hashlib.sha256(encoded).hexdigest()
        pixels=Image.open(io.BytesIO(encoded)).convert('RGB')
        assert pixels.size==(2048,2048)
        _,zone,kind=name.split('_')
        for tile in atlas['zones'][zone]:
            sample=pixels.getpixel(tuple(tile['pixel']))
            assert list(sample)==tile['pixels'][kind]
            if kind=='Base':
                errors['baseLinear']=max(errors['baseLinear'],*(abs(linear(c)-v) for c,v in zip(sample,tile['baseLinear'])))
            elif kind=='ORM':
                assert sample[0]==255
                for index,key in [(1,'roughness'),(2,'metallic')]:
                    errors[key]=max(errors[key],abs(sample[index]/255-tile[key]))
            else:
                errors['emissionLinear']=max(errors['emissionLinear'],*(abs(linear(c)*2-v) for c,v in zip(sample,tile['emissionLinear'])))
    assert errors['baseLinear']<.004 and errors['emissionLinear']<.008
    assert errors['roughness']<=1/510+1e-7 and errors['metallic']<=1/510+1e-7
    if image_hashes is not None:
        assert hashes==image_hashes,'LOD atlases must match exactly before runtime sharing'
    image_hashes=hashes
    results.append({'lod':lod,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),
                    'retainedNodes':checked,'maxPixelError':errors,'imageHashes':hashes})
assert sum(r['bytes'] for r in results)<8*1024**2
(OUT/'pixel-report.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results))
