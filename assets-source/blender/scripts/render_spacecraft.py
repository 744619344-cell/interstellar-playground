"""Render reproducible studio review views of the saved production model."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

SOURCE = Path(__file__).resolve().parents[1] / 'spacecraft'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'spacecraft_production.blend'))
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 1280
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('Review studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.11,.14,.18,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .4
for name,position,power,size in [('Key',(5,8,14),2400,9),
                                ('Fill',(-8,2,8),1800,8),('Rim',(2,-10,10),2700,7)]:
    data = bpy.data.lights.new(name,'AREA')
    data.energy, data.shape, data.size = power,'DISK',size
    obj = bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (-obj.location).to_track_quat('-Z','Y').to_euler()
camera = bpy.data.objects.new('Review camera',bpy.data.cameras.new('Review camera'))
scene.collection.objects.link(camera)
scene.camera = camera
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 20
output = SOURCE / 'previews'
output.mkdir(exist_ok=True)
views = [('hero',(15,20,13)),('rear',(15,-20,10)),('front',(0,24,0)),
         ('side',(24,0,0)),('top',(0,0,25))]
views += [(f'orbit-{angle}',(24*math.sin(math.radians(angle)),
           24*math.cos(math.radians(angle)),12)) for angle in (45,135,225,315)]
for name, position in views:
    camera.data.ortho_scale = 24 if name == 'top' else 20
    camera.location = position
    camera.rotation_euler = (-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath = str(output/f'{name}.png')
    bpy.ops.render.render(write_still=True)
