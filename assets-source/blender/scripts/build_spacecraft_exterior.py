"""Run with Blender --background --factory-startup --python this_file."""
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
sys.path.insert(0, str(HERE))
from ship_geometry import material, socket
from ship_modules import hull, service_panels, pod, airlock, rcs
from ship_detail import hull_armor
from validate_spacecraft import inspect_collection

ROOT = HERE.parents[2]
SOURCE = ROOT / 'assets-source/blender/spacecraft'
OUTPUT = ROOT / 'src/assets/models'


def palette():
    return {
        'white': material('Ceramic_WarmWhite',(.69,.665,.60),.12,.34),
        'dark': material('Structure_Graphite',(.018,.025,.032),.65,.38),
        'metal': material('Brushed_Titanium',(.22,.26,.3),.85,.3),
        'glass': material('Canopy_SmokedGlass',(.012,.035,.052),.5,.13),
        'cyan': material('Navigation_Cyan',(.025,.68,.82),.25,.25,2),
        'amber': material('Maintenance_Amber',(.68,.27,.035),.25,.38),
    }


def bounds(objects):
    points = [obj.matrix_world @ Vector(corner) for obj in objects
              if obj.type == 'MESH' for corner in obj.bound_box]
    return (Vector(tuple(min(p[k] for p in points) for k in range(3))),
            Vector(tuple(max(p[k] for p in points) for k in range(3))))


def normalize(objects, transform=None):
    bpy.context.view_layer.update()
    if transform is None:
        low, high = bounds(objects)
        center = (low+high)/2
        scale = Vector((7.8,15.6,4.8))
        for k in range(3):
            scale[k] /= high[k]-low[k]
    else:
        center, scale = transform
    for obj in objects:
        if obj.type == 'MESH':
            matrix = obj.matrix_world.copy()
            for vertex in obj.data.vertices:
                position = matrix @ vertex.co
                vertex.co = Vector(((position[k]-center[k])*scale[k] for k in range(3)))
            obj.matrix_world.identity()
        else:
            obj.location = Vector(((obj.location[k]-center[k])*scale[k] for k in range(3)))
    bpy.context.view_layer.update()
    return center, scale


def consolidate(collection):
    """Merge static pieces by material, keep canopy and door independent."""
    groups = {}
    for obj in list(collection.objects):
        if obj.type != 'MESH' or obj.name.startswith(('Door_Outer','Canopy_Glass')):
            continue
        key = obj.get('module','Hull')+'_'+obj.data.materials[0].name
        groups.setdefault(key, []).append(obj)
    for name, objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects) > 1:
            bpy.ops.object.join()
        objects[0].name = 'Exterior_' + name


def build(lod, mats, transform):
    collection = bpy.data.collections.new(f'LOD{lod}')
    bpy.context.scene.collection.children.link(collection)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[collection.name]
    hull(mats,lod)
    service_panels(mats,lod)
    hull_armor(mats,lod)
    for side in (-1,1):
        before = set(collection.objects)
        pod(mats,lod,side)
        for obj in set(collection.objects)-before:
            if obj.type == 'MESH':
                obj['module'] = f'EnginePod_{side}'
    airlock(mats,lod)
    rcs(mats,lod)
    transform = normalize(list(collection.objects),transform)
    consolidate(collection)
    if lod == 2:
        for obj in collection.objects:
            if obj.type != 'MESH' or obj.name.startswith('Canopy_Glass'):
                continue
            bpy.context.view_layer.objects.active = obj
            modifier = obj.modifiers.new('Distant detail reduction','DECIMATE')
            modifier.ratio = .55
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    root = socket(f'Ship_Exterior_LOD{lod}',(0,0,0), unit='metre',
                  blenderForward='+Y', runtimeForward='-Z', lod=lod)
    # Metadata colliders do not become opaque geometry in glTF viewers.
    socket('Collider_Hull',(0,0,0),shape='box',size=[4.6,15.6,4.8],purpose='coarse-exterior-only')
    for side in (-1,1):
        socket(f'Collider_Pod_{side}',(side*2.8,-2.25,-.55),shape='box',size=[2.2,9.7,2.3])
    for obj in collection.objects:
        if obj != root:
            obj.parent = root
    return collection, transform


def export(collection, lod):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in collection.objects:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT/f'spacecraft-exterior-lod{lod}.glb'),
        export_format='GLB', use_selection=True, export_yup=True,
        export_apply=True, export_animations=False, export_cameras=False,
        export_lights=False, export_extras=True, export_texcoords=False,
        export_meshopt_compression_enable=True)


def main():
    SOURCE.mkdir(parents=True,exist_ok=True)
    OUTPUT.mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.scene.unit_settings.system = 'METRIC'
    mats, transform, reports = palette(), None, []
    collections = []
    for lod in range(3):
        collection, transform = build(lod,mats,transform)
        collections.append(collection)
        report = inspect_collection(collection,lod)
        assert report['withinBudget'] and report['dimensionsMatch'], report
        reports.append(report)
        export(collection,lod)
        for obj in collection.objects:
            if not obj.name.startswith('Ship_Exterior_LOD'):
                obj.name += f'_LOD{lod}'
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'spacecraft_export.blend'))
    for collection in collections[1:]:
        collection.hide_render = True
        collection.hide_viewport = True
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/'spacecraft_production.blend'))
    (SOURCE/'geometry-report.json').write_text(json.dumps(reports,indent=2),encoding='utf-8')
    print('GEOMETRY_REPORT',json.dumps(reports))


if __name__ == '__main__':
    main()
