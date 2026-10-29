"""Lossless TGA -> PNG and Y-origin conversion for glTF texture convention."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
target = root / 'converted-textures'
target.mkdir(exist_ok=True)
for path in (root / 'original' / 'Textures').glob('*.tga'):
    image = Image.open(path)
    result = image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    result.save(target / (path.stem + '.png'), optimize=True)
    print(path.name, image.size, image.mode)
