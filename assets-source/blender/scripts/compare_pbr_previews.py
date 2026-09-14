"""Numerical before/after screenshot comparison, excluding the changing review toolbar."""
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

BASE=Path(__file__).resolve().parents[1]/'spacecraft'
results=[]
for path in sorted((BASE/'pbr/previews').glob('lod*.png')):
    before=Image.open(BASE/'mechanisms/previews'/path.name).convert('RGB')
    after=Image.open(path).convert('RGB')
    assert before.size==after.size
    region=(0,280,before.width,before.height)
    diff=ImageChops.difference(before.crop(region),after.crop(region))
    mae=sum(ImageStat.Stat(diff).mean)/3
    # Includes the object and background, so this is a smoke check, not a perceptual-quality score.
    assert mae<2,(path.name,mae)
    results.append({'view':path.stem,'meanAbsoluteRGBError255':mae})
assert len(results)==12
(BASE/'pbr/visual-comparison.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results))
