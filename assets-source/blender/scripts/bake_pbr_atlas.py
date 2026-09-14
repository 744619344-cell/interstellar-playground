"""Analytically bake the accepted constant PBR materials into two lossless 2K atlases."""
import json
import struct
from pathlib import Path
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[3]
OUT=ROOT/'assets-source/blender/spacecraft/pbr'
OUT.mkdir(parents=True,exist_ok=True)
raw=(ROOT/'src/assets/models/spacecraft-mechanisms-lod0.glb').read_bytes()
source=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])


def byte(value,srgb=False):
    if srgb:
        value=12.92*value if value<=.0031308 else 1.055*value**(1/2.4)-.055
    return round(max(0,min(1,value))*255)


report={'size':2048,'emissionStrength':2,'zones':{},'source':'spacecraft-mechanisms-lod0.glb'}
for zone in ('Exterior','Interior'):
    materials=[m for m in source['materials'] if m['name']!='Mechanism_Plasma'
               and m['name'].startswith('Interior_')==(zone=='Interior')]
    images={kind:Image.new('RGB',(2048,2048)) for kind in ('Base','ORM','Emission')}
    tiles=[]
    for index,material in enumerate(materials):
        pbr=material['pbrMetallicRoughness']
        base=pbr.get('baseColorFactor',[1,1,1,1])[:3]
        rough=pbr.get('roughnessFactor',1)
        metal=pbr.get('metallicFactor',1)
        strength=material.get('extensions',{}).get('KHR_materials_emissive_strength',{}).get('emissiveStrength',1)
        emission=[c*strength for c in material.get('emissiveFactor',[0,0,0])]
        assert max(emission)<=2
        colors={'Base':tuple(byte(c,True) for c in base),'ORM':(255,byte(rough),byte(metal)),
                'Emission':tuple(byte(c/2,True) for c in emission)}
        x,y=index%4*512,index//4*512
        for kind,img in images.items():
            ImageDraw.Draw(img).rectangle((x,y,x+511,y+511),fill=colors[kind])
        tiles.append({'material':material['name'],'uv':[(x+256)/2048,1-(y+256)/2048],
                      'pixel':[x+256,y+256],'baseLinear':base,'roughness':rough,
                      'metallic':metal,'emissionLinear':emission,'pixels':colors})
    for kind,img in images.items():
        img.save(OUT/f'Atlas_{zone}_{kind}.webp',lossless=True,method=6)
    report['zones'][zone]=tiles
(OUT/'atlas-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print('Baked 6 lossless 2048px WebP atlases from 15 constant source materials.')
