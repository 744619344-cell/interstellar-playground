"""Studio cutaway and static cabin review views from the actual Blender asset."""
from pathlib import Path
import bpy
from mathutils import Vector

SOURCE=Path(__file__).resolve().parents[1]/'spacecraft/interior'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE/'spacecraft_interior_production.blend'))
scene=bpy.context.scene
with bpy.data.libraries.load(str(SOURCE.parent/'spacecraft_production.blend'),link=False) as (source,data):
    data.collections=['LOD0']
exterior=data.collections[0]
scene.collection.children.link(exterior)
for obj in exterior.objects:
    if obj.name.startswith('Canopy_Glass'):
        obj.hide_render=True
scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x=1440
scene.render.resolution_y=1080
scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Interior review studio')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.09,.12,.16,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
for position,power,size in [((4,4,10),2000,8),((-5,-3,8),1800,7),((1,-8,6),1400,5)]:
    light=bpy.data.lights.new('Review light','AREA')
    light.energy,light.size=power,size
    obj=bpy.data.objects.new('Review light',light)
    scene.collection.objects.link(obj)
    obj.location=position
    obj.rotation_euler=(-obj.location).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.objects.new('Review camera',bpy.data.cameras.new('Review camera'))
scene.collection.objects.link(camera)
scene.camera=camera
output=SOURCE/'previews'
output.mkdir(exist_ok=True)
views=[('cutaway',(11,13,11),(0,-1,0),True),('plan',(0,-1,20),(0,-1,0),True),
       ('cabin',(0,-3.9,.6),(0,4.5,0),False),('cockpit',(0,2.65,.6),(0,4.8,-.1),False),
       ('airlock',(-.35,-4.85,.5),(.3,-6.2,-.1),False)]
eye=bpy.data.objects['Anchor_CockpitCamera_LOD0'].matrix_world.translation.copy()
views.append(('pilot',eye,eye+Vector((0,1,-.6)),False))
for name,position,target,cutaway in views:
    exterior.hide_render=cutaway
    for obj in bpy.data.collections['Interior_LOD0'].objects:
        if obj.type=='MESH':
            obj.hide_render=(cutaway and obj.name.startswith(('Ceiling','Walls'))) or obj.name.startswith('Door_Inner')
    camera.data.type='ORTHO' if cutaway else 'PERSP'
    camera.data.ortho_scale=19
    camera.data.lens=20
    camera.data.clip_start=.05
    camera.location=position
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(output/f'{name}.png')
    bpy.ops.render.render(write_still=True)
