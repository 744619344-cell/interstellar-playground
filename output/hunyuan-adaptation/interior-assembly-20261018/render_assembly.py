"""Render the actual original GLBs with manifest-only placement; never edit mesh data."""
import argparse
import json
import sys
from pathlib import Path
import bpy
from mathutils import Matrix,Vector

BASE=Path(__file__).resolve().parent
ROOT=BASE.parents[2]
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
VIEWS={
 'cockpit':([0,.1,-1.65],[0,-.50,-5.25],24),
 'aft':([0,-.12,-2.6],[0,-.30,4.2],19),
 'forward':([0,-.05,3.9],[0,-.35,-4.5],19),
 'beds':([.5,-.1,1.7],[-2.85,-1.02,1.4],23),
 'workbench':([-.3,-.1,1.8],[2.75,-1.08,1.3],30),
 'doorway':([0,-.1,2.65],[0,-.12,5.5],24),
 'exterior':([14,8,-18],[0,0,0],0),
 'shell-side':([18,2,0],[0,0,0],0),
 'roof-side':([15,5,0],[0,.2,0],0),
}


def source_import(path,modules):
    old=set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    objects=set(bpy.context.scene.objects)-old
    if modules:
        for obj in list(objects):
            if obj.type=='MESH' and obj.get('module') not in modules:
                objects.remove(obj);bpy.data.objects.remove(obj,do_unlink=True)
    assert any(o.type=='MESH' for o in objects),'Module filter must retain real source meshes'
    return objects


def import_assembly(manifest):
    records=[]
    for item in manifest['sources']:
        objects=source_import(ROOT/item['source'],item['modules'])
        root=bpy.data.objects.new('Assembly_'+item['id'],None)
        bpy.context.collection.objects.link(root)
        for obj in objects:
            if obj.parent not in objects:obj.parent=root
        rotation=Matrix.Rotation(item['rotationYDegrees']*3.141592653589793/180,4,'Y')
        m=(Matrix.Translation(Vector(item['placementCenter']))@rotation
           @Matrix.Scale(item['uniformScale'],4)@Matrix.Translation(-Vector(item['sourceCenter'])))
        root.matrix_world=C@m@C.inverted()
        bpy.context.view_layer.update()
        points=[C.inverted()@(obj.matrix_world@Vector(corner)) for obj in objects if obj.type=='MESH' for corner in obj.bound_box]
        bounds=[[min(v[k] for v in points) for k in range(3)],[max(v[k] for v in points) for k in range(3)]]
        error=max(abs(bounds[a][k]-item['displayBounds'][a][k]) for a in range(2) for k in range(3))
        assert error<.002,(item['id'],bounds,item['displayBounds'])
        records.append({'id':item['id'],'bounds':bounds,'maxBoundsError':error})
    return records


def setup(manifest,samples,percent):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=samples
    scene.cycles.use_denoising=False;scene.cycles.transparent_max_bounces=64
    scene.render.resolution_x=1200;scene.render.resolution_y=900;scene.render.resolution_percentage=percent
    scene.world=bpy.data.worlds.new('Assembly review studio');scene.world.use_nodes=True
    background=scene.world.node_tree.nodes['Background'];background.inputs['Color'].default_value=(.22,.30,.40,1);background.inputs['Strength'].default_value=.8
    for pos,power,size in [((0,-6,10),2200,10),((-9,-3,5),1600,8),((7,5,4),1800,8)]:
        bpy.ops.object.light_add(type='AREA',location=C@Vector(pos))
        light=bpy.context.object;light.data.energy=power;light.data.size=size
        light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
    for row in manifest['reviewLights']:
        bpy.ops.object.light_add(type='POINT',location=C@Vector(row['position']))
        light=bpy.context.object;light.name='InteriorReviewLight';light.data.energy=row['watts'];light.data.color=row['color'];light.data.shadow_soft_size=row['radius']
    bpy.ops.object.camera_add();scene.camera=bpy.context.object
    return scene


def main():
    p=argparse.ArgumentParser();p.add_argument('--manifest',default='assembly-v2.json');p.add_argument('--views',default='cockpit,aft,forward')
    p.add_argument('--prefix',required=True);p.add_argument('--samples',type=int,default=16);p.add_argument('--percent',type=int,default=75);p.add_argument('--delivery',action='store_true');p.add_argument('--daylight-exterior',action='store_true')
    args=p.parse_args(sys.argv[sys.argv.index('--')+1:]);manifest=json.loads((BASE/args.manifest).read_text())
    bpy.ops.wm.read_factory_settings(use_empty=True)
    groups=import_assembly(manifest);scene=setup(manifest,args.samples,args.percent);records=[]
    for view in args.views.split(','):
        for obj in scene.objects:
            if obj.name.startswith('InteriorReviewLight'):obj.hide_render=args.daylight_exterior
        pos,target,lens=VIEWS[view];camera=scene.camera;camera.location=C@Vector(pos)
        camera.rotation_euler=(C@Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
        camera.data.type='PERSP' if lens else 'ORTHO'
        if lens:camera.data.lens=lens
        else:camera.data.ortho_scale=20
        samples=(36 if view in ['cockpit','aft','forward'] else 8) if args.delivery else args.samples
        percent=(75 if view in ['cockpit','aft','forward'] else 50) if args.delivery else args.percent
        scene.cycles.samples=samples;scene.render.resolution_percentage=percent
        path=BASE/f'{args.prefix}-{view}.png';assert not path.exists()
        scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)
        records.append({'view':view,'image':path.name,'positionGLTF':pos,'targetGLTF':target,'lensMM':lens,'samples':samples,'percent':percent,'allAssemblyPartsVisible':True,'interiorReviewLightsEnabled':not args.daylight_exterior})
    (BASE/f'{args.prefix}-render.json').write_text(json.dumps({'manifest':args.manifest,'groups':groups,'views':records},indent=2))


if __name__=='__main__':main()
