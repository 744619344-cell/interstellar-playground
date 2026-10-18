"""Offline Blender render of actual GLBs, using identical review cameras."""
import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

BASE = Path(__file__).resolve().parent
VIEWS = {
    'left': ((-16, 4, 1.1), (0, 4, 1.1), 10),
    'right': ((16, 4, 1.1), (0, 4, 1.1), 10),
    'quarter': ((-12, 15, 7), (0, 2, 0), 11),
    'front': ((0, 19, 3.8), (0, 4, .4), 10),
    'top': ((0, 5, 18), (0, 4, .4), 11),
    'eye-left': ((-.72, 3.2, -.15), (-3, 4.2, 1), 0),
    'eye-right': ((.72, 3.2, -.15), (3, 4.2, 1), 0),
    'cabin-front': ((0, 15, .4), (0, 3.7, -.55), 9),
    'cabin-left': ((-11, 12, 1), (0, 3.7, -.55), 9),
    'cabin-right': ((11, 12, 1), (0, 3.7, -.55), 9),
    'cabin-detail-front': ((0, 12, -.25), (0, 3.7, -.35), 7.5),
    'cabin-detail-left': ((-9, 11, .2), (0, 3.7, -.5), 8.25),
}


def arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True)
    parser.add_argument('--prefix', required=True)
    parser.add_argument('--views', default='left,right,quarter')
    parser.add_argument('--mode', choices=['exterior', 'glass', 'shell', 'context', 'context-no-glass'], default='exterior')
    parser.add_argument('--samples', type=int, default=48)
    parser.add_argument('--percent', type=int, choices=range(25, 101), default=100)
    parser.add_argument('--cabin-light', action='store_true')
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:])


def visibility(mode):
    for obj in list(bpy.context.scene.objects):
        if obj.type != 'MESH':
            continue
        exterior = 'Exterior_Hull' in obj.name or 'Canopy_Glass' in obj.name
        if mode not in ['context', 'context-no-glass'] and not exterior:
            bpy.data.objects.remove(obj, do_unlink=True)
            continue
        if mode in ['glass', 'shell', 'context-no-glass']:
            # Render-only visibility via neutral holdout; the GLB remains unchanged.
            for slot in obj.material_slots:
                is_glass = slot.material.name.startswith('前挡与左右侧窗')
                hide = is_glass if mode == 'context-no-glass' else is_glass != (mode == 'glass')
                if hide:
                    mat = bpy.data.materials.new('Review only transparent visibility')
                    mat.use_nodes = True
                    nodes = mat.node_tree.nodes
                    nodes.clear()
                    transparent = nodes.new('ShaderNodeBsdfTransparent')
                    output = nodes.new('ShaderNodeOutputMaterial')
                    mat.node_tree.links.new(transparent.outputs[0], output.inputs['Surface'])
                    slot.material = mat


def studio(samples, percent=100, cabin_light=False):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    scene.cycles.transparent_max_bounces = 64
    scene.render.resolution_x, scene.render.resolution_y = 1200, 900
    scene.render.resolution_percentage = percent
    scene.world = bpy.data.worlds.new('Review studio')
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes['Background']
    background.inputs['Color'].default_value = (.22, .30, .40, 1)
    background.inputs['Strength'].default_value = .8
    for pos, power, size in [((0, 10, -6), 2200, 10), ((-9, 5, -3), 1600, 8), ((7, 4, 5), 1800, 8)]:
        bpy.ops.object.light_add(type='AREA', location=pos)
        light = bpy.context.object
        light.data.energy, light.data.size, light.data.shape = power, size, 'DISK'
        light.rotation_euler = (-light.location).to_track_quat('-Z', 'Y').to_euler()
    if cabin_light:
        for x in [-.9, .9]:
            bpy.ops.object.light_add(type='POINT', location=(x, 3.8, 0))
            light = bpy.context.object
            light.data.energy = 90
            light.data.color = (1, .94, .86)
            light.data.shadow_soft_size = .5
    bpy.ops.object.camera_add()
    scene.camera = bpy.context.object
    return scene


def main():
    args = arguments()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(Path(args.source).resolve()))
    visibility(args.mode)
    scene = studio(args.samples, args.percent, args.cabin_light)
    records = []
    for name in args.views.split(','):
        pos, target, scale = VIEWS[name]
        camera = scene.camera
        camera.location = pos
        camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
        camera.data.type = 'ORTHO' if scale else 'PERSP'
        if scale:
            camera.data.ortho_scale = scale
        else:
            camera.data.lens = 22
        path = BASE / f'{args.prefix}-{name}.png'
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        records.append({'image': path.name, 'positionBlender': pos, 'targetBlender': target,
                        'orthographicScale': scale, 'samples': args.samples, 'mode': args.mode,
                        'resolutionPercent': args.percent, 'cabinLight': args.cabin_light})
    (BASE / f'{args.prefix}-render.json').write_text(json.dumps(records, indent=2))


if __name__ == '__main__':
    main()
