"""Read accepted mechanisms, atlas static modules, export derived animated GLBs."""
import json
import sys
from pathlib import Path
import bpy

sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from pbr_materials import assign,merge_static
ROOT=HERE.parents[2]
SOURCE=ROOT/'assets-source/blender/spacecraft'
OUT=SOURCE/'pbr'
report=json.loads((OUT/'atlas-report.json').read_text(encoding='utf-8'))


def build(lod):
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE/f'mechanisms/spacecraft_mechanisms_lod{lod}.blend'))
    bpy.context.preferences.filepaths.save_version=0
    objects=list(bpy.context.scene.objects)
    assign(objects,report,OUT)
    merge_static(objects)
    objects=list(bpy.context.scene.objects)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(ROOT/f'src/assets/models/spacecraft-pbr-lod{lod}.glb'),
        export_format='GLB',use_selection=True,export_yup=True,export_apply=True,
        export_animations=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,
        export_anim_slide_to_zero=True,export_force_sampling=True,export_cameras=False,
        export_lights=False,export_extras=True,export_texcoords=True,
        export_image_format='WEBP',export_image_quality=100,export_meshopt_compression_enable=True)
    bpy.context.scene.frame_set(0)
    for obj in objects:
        if obj.name.startswith('ThrusterPlume_'):
            obj.scale=(.001,.001,.001)
        if obj.name.startswith('Console_Bar_'):
            obj.scale=(1,1,1)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'spacecraft_pbr_lod{lod}.blend'))
    meshes=[o for o in objects if o.type=='MESH']
    triangles=0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles+=len(obj.data.loop_triangles)
    assert triangles==[237312,123408][lod]
    return {'lod':lod,'triangles':triangles,'meshes':len(meshes),
            'materials':len({m.name for o in meshes for m in o.data.materials})}


results=[build(lod) for lod in range(2)]
(OUT/'geometry-report.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print('PBR_REPORT',json.dumps(results))
