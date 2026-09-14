"""Create derived animated assemblies without overwriting accepted static assets."""
import json
import re
import sys
from pathlib import Path
import bpy

sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from mechanism_geometry import prepare_doors,prepare_console,prepare_thrusters
from mechanism_animation import animate
from ship_geometry import socket

ROOT=HERE.parents[2]
SOURCE=ROOT/'assets-source/blender/spacecraft'
OUTPUT=SOURCE/'mechanisms'


def load_parts(lod,assembly):
    objects={}
    for path,name in [(SOURCE/'spacecraft_production.blend',f'LOD{lod}'),
                      (SOURCE/'interior/spacecraft_interior_production.blend',f'Interior_LOD{lod}')]:
        with bpy.data.libraries.load(str(path),link=False) as (_,data):
            data.collections=[name]
        collection=data.collections[0]
        bpy.context.scene.collection.children.link(collection)
        collection.hide_viewport=False
        collection.hide_render=False
        bpy.context.view_layer.update()
        for obj in list(collection.all_objects):
            world=obj.matrix_world.copy()
            obj.parent=None
            obj.matrix_world=world
            if obj.name.startswith('Ship_'):
                bpy.data.objects.remove(obj,do_unlink=True)
                continue
            canonical=re.sub(r'_LOD\d+$','',obj.name)
            if canonical in objects:
                assert canonical in ('Seat_Pilot','Seat_Copilot','Anchor_CockpitCamera'),canonical
                assert (objects[canonical].location-obj.location).length<1e-6
                bpy.data.objects.remove(obj,do_unlink=True)
                continue
            obj.name=canonical
            obj.hide_viewport=False
            obj.hide_render=False
            for old in list(obj.users_collection):
                old.objects.unlink(obj)
            assembly.objects.link(obj)
            objects[canonical]=obj
        bpy.data.collections.remove(collection)
    return objects


def build(lod):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    scene=bpy.context.scene
    scene.unit_settings.system='METRIC'
    scene.render.fps=30
    scene.frame_start=1
    scene.frame_end=61
    assembly=bpy.data.collections.new('Mechanisms')
    scene.collection.children.link(assembly)
    bpy.context.view_layer.active_layer_collection=bpy.context.view_layer.layer_collection.children[assembly.name]
    objects=load_parts(lod,assembly)
    outer,inner=prepare_doors(objects)
    bars=prepare_console(objects)
    plumes=prepare_thrusters(objects)
    root=socket(f'Ship_Mechanisms_LOD{lod}',(0,0,0),unit='metre',purpose='animated-assembly-review')
    for obj in assembly.objects:
        if obj!=root and obj.parent is None:
            obj.parent=root
    animate(outer,inner,bars,plumes)
    meshes=[obj for obj in assembly.objects if obj.type=='MESH']
    triangles=0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles+=len(obj.data.loop_triangles)
    assert triangles<=[280000,140000][lod],triangles
    bpy.ops.object.select_all(action='DESELECT')
    for obj in assembly.objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT/f'src/assets/models/spacecraft-mechanisms-lod{lod}.glb'),
        export_format='GLB',use_selection=True,export_yup=True,export_apply=True,
        export_animations=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,
        export_anim_slide_to_zero=True,
        export_force_sampling=True,export_cameras=False,export_lights=False,export_extras=True,
        export_texcoords=False,export_meshopt_compression_enable=True)
    scene.frame_set(0)
    for plume in plumes:
        plume.scale=(.001,.001,.001)
    for bar in bars:
        bar.scale=(1,1,1)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT/f'spacecraft_mechanisms_lod{lod}.blend'))
    return {'lod':lod,'triangles':triangles,'meshes':len(meshes),'consoleBars':len(bars),
            'sourceExterior':f'LOD{lod}','sourceInterior':f'Interior_LOD{lod}',
            'materials':len({m.name for obj in meshes for m in obj.data.materials})}


OUTPUT.mkdir(parents=True,exist_ok=True)
reports=[build(lod) for lod in range(2)]
(OUTPUT/'geometry-report.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
print('MECHANISMS_REPORT',json.dumps(reports))
