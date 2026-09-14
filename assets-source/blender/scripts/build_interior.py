"""Build both interior LODs aligned to the accepted exterior source."""
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector

sys.dont_write_bytecode=True
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from ship_geometry import material, socket
from interior_modules import room_shell, cockpit, equipment, airlock
from validate_interior import inspect_interior

ROOT=HERE.parents[2]
SOURCE=ROOT/'assets-source/blender/spacecraft/interior'


def materials():
    return {'white':material('Interior_Ceramic',(.64,.62,.57),.08,.46),
            'dark':material('Interior_Graphite',(.024,.032,.039),.35,.43),
            'metal':material('Interior_Titanium',(.24,.29,.32),.7,.34),
            'floor':material('Interior_Floor',(.13,.16,.18),.2,.65),
            'fabric':material('Interior_Cushion',(.09,.14,.17),0,.85),
            'screen':material('Interior_Display',(.006,.025,.038),.15,.27),
            'cyan':material('Interior_Cyan',(.025,.6,.71),.1,.35,1.6),
            'light':material('Interior_Light',(.85,.88,.82),0,.4,2),
            'amber':material('Interior_Amber',(.66,.3,.055),.15,.45)}


def group_meshes(collection):
    groups={}
    for obj in list(collection.objects):
        if obj.type!='MESH' or obj.name=='Door_Inner' or obj.name.startswith('Door_Outer_Liner'):
            continue
        zone='Ceiling' if 'Ceiling' in obj.name or obj.name.startswith('AirlockLight') else (
            'Walls' if 'WallPanel' in obj.name or 'AirlockWall' in obj.name else 'Furniture')
        groups.setdefault(zone+'_'+obj.data.materials[0].name,[]).append(obj)
    for name,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        if len(objects)>1:
            bpy.ops.object.join()
        objects[0].name=name
    for obj in collection.objects:
        if obj.type=='MESH':
            matrix=obj.matrix_world.copy()
            for vertex in obj.data.vertices:
                vertex.co=matrix@vertex.co
            obj.matrix_world.identity()


def create(lod,m,anchors):
    collection=bpy.data.collections.new(f'Interior_LOD{lod}')
    bpy.context.scene.collection.children.link(collection)
    bpy.context.view_layer.active_layer_collection=bpy.context.view_layer.layer_collection.children[collection.name]
    room_shell(m,lod)
    cockpit(m,lod,anchors)
    equipment(m,lod)
    airlock(m,lod)
    for name,position in anchors.items():
        socket(name,position)
    bpy.context.view_layer.update()
    report=inspect_interior(collection,lod,anchors)
    assert report['withinBudget'],report
    assert not report['corridorObstructions'],report
    assert report['shellMaxRadiusRatio']<=1.0,report
    group_meshes(collection)
    lining=socket('Door_Outer_Lining',(0,0,0),purpose='static-inner-facing-lining; animate-with-outer-door-in-P3-T04')
    for obj in collection.objects:
        if obj.name.startswith('Door_Outer_Liner'):
            obj.parent=lining
    root=socket(f'Ship_Interior_LOD{lod}',(0,0,0),unit='metre',blenderForward='+Y',runtimeForward='-Z')
    for obj in collection.objects:
        if obj!=root and obj.parent is None:
            obj.parent=root
    report['meshes']=sum(obj.type=='MESH' for obj in collection.objects)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in collection.objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ROOT/f'src/assets/models/spacecraft-interior-lod{lod}.glb'),
        export_format='GLB',use_selection=True,export_yup=True,export_apply=True,
        export_animations=False,export_cameras=False,export_lights=False,export_extras=True,
        export_texcoords=False,export_meshopt_compression_enable=True)
    for obj in collection.objects:
        obj.name+=f'_LOD{lod}'
    return collection,report


def main():
    SOURCE.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE.parent/'spacecraft_production.blend'))
    bpy.context.view_layer.update()
    names=['Seat_Pilot','Seat_Copilot','Anchor_CockpitCamera']
    anchors={name:list(bpy.data.objects[name+'_LOD0'].matrix_world.translation) for name in names}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    bpy.context.scene.unit_settings.system='METRIC'
    m=materials()
    collections,reports=[],[]
    for lod in range(2):
        collection,report=create(lod,m,anchors)
        collections.append(collection)
        reports.append(report)
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'spacecraft_interior_export.blend'))
    collections[1].hide_viewport=True
    collections[1].hide_render=True
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'spacecraft_interior_production.blend'))
    (SOURCE/'geometry-report.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
    print('INTERIOR_REPORT',json.dumps(reports))


if __name__=='__main__':
    main()
