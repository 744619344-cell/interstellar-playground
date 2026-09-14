"""Extract existing disconnected parts and cut only the closed aft frame solids."""
import bpy
import bmesh
from mathutils import Vector
from ship_geometry import box, mesh, socket


def islands(obj):
    links=[[] for _ in obj.data.vertices]
    for edge in obj.data.edges:
        a,b=edge.vertices
        links[a].append(b)
        links[b].append(a)
    pending=set(range(len(links)))
    while pending:
        visited={pending.pop()}
        stack=list(visited)
        while stack:
            for other in links[stack.pop()]:
                if other in pending:
                    pending.remove(other)
                    visited.add(other)
                    stack.append(other)
        points=[obj.matrix_world@obj.data.vertices[i].co for i in visited]
        low=Vector(min(p[k] for p in points) for k in range(3))
        high=Vector(max(p[k] for p in points) for k in range(3))
        yield visited,low,high


def extract(obj,predicate,prefix):
    selections=[(indices,low,high) for indices,low,high in islands(obj) if predicate(low,high)]
    result=[]
    remove=set()
    for number,(indices,_,_) in enumerate(selections):
        ordered=sorted(indices)
        mapping={index:i for i,index in enumerate(ordered)}
        vertices=[obj.matrix_world@obj.data.vertices[i].co for i in ordered]
        faces=[tuple(mapping[i] for i in p.vertices) for p in obj.data.polygons if p.vertices[0] in indices]
        result.append(mesh(f'{prefix}_{number}',vertices,faces,obj.data.materials[0]))
        remove.update(indices)
    bm=bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[bm.verts[i] for i in remove],context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return result


def cut_portal(objects):
    cutter=box('TemporaryDoorCutter',(0,-7.6,-.06),(1.2,1.6,2.12),objects[0].data.materials[0],.015,3)
    for obj in objects:
        bpy.context.view_layer.objects.active=obj
        modifier=obj.modifiers.new('Real aft door aperture','BOOLEAN')
        modifier.operation='DIFFERENCE'
        modifier.solver='EXACT'
        modifier.object=cutter
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cutter,do_unlink=True)


def parent_at(name,position,parts):
    joint=socket(name,position)
    bpy.context.view_layer.update()
    for obj in parts:
        world=obj.matrix_world.copy()
        obj.parent=joint
        obj.matrix_world=world
    return joint


def prepare_doors(objects):
    frames=[]
    for key in ('Exterior_Hull_Structure_Graphite','Exterior_Hull_Brushed_Titanium'):
        frames+=extract(objects[key],lambda a,b:b.y < -7 and b.x-a.x>1.8 and b.z-a.z>2.5 and b.y-a.y<.4,'AftFrame')
    assert len(frames)==2, f'Expected two aft frame solids, found {len(frames)}'
    cut_portal(frames)
    seal=extract(objects['Exterior_Hull_Structure_Graphite'],
                 lambda a,b:b.y < -7.7 and b.x-a.x<.04 and b.z-a.z>1.5,'MovingOuterSeal')
    assert len(seal)==1,'Outer seal must move with the door'
    parts=[objects['Door_Outer'],objects['Door_Outer_Liner'],objects['Door_Outer_LinerSeam'],*seal]
    door_y=sum(v.co.y for v in objects['Door_Outer'].data.vertices)/len(objects['Door_Outer'].data.vertices)
    liner_y=sum(v.co.y for v in objects['Door_Outer_Liner'].data.vertices)/len(objects['Door_Outer_Liner'].data.vertices)
    core=box('OuterDoorCore',(0,(door_y+liner_y)/2,-.06),(1.12,abs(door_y-liner_y),2.07),objects['Door_Outer'].data.materials[0],.025,3)
    parts.append(core)
    outer=parent_at('Rig_OuterDoor',(0,0,0),parts)
    inner=parent_at('Rig_InnerDoor',(.575,-4.66,0),[objects['Door_Inner']])
    return outer,inner


def prepare_console(objects):
    bars=extract(objects['Furniture_Interior_Cyan'],lambda a,b:4.70<a.y<4.74 and b.z>0,'Console_Bar')
    assert len(bars)==8,f'Expected eight independent console bars, found {len(bars)}'
    for obj in bars:
        low=Vector(min(v.co[k] for v in obj.data.vertices) for k in range(3))
        high=Vector(max(v.co[k] for v in obj.data.vertices) for k in range(3))
        pivot=Vector(((low.x+high.x)/2,(low.y+high.y)/2,low.z))
        for vertex in obj.data.vertices:
            vertex.co-=pivot
        obj.location=pivot
    return bars


def prepare_thrusters(objects):
    mat=bpy.data.materials.new('Mechanism_Plasma')
    mat.diffuse_color=(.04,.7,1,1)
    mat.use_nodes=True
    shader=mat.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value=mat.diffuse_color
    shader.inputs['Emission Color'].default_value=mat.diffuse_color
    shader.inputs['Emission Strength'].default_value=3
    shader.inputs['Roughness'].default_value=.4
    plumes=[]
    for side in (-1,1):
        anchor=objects[f'Thruster_Main_{side}']
        bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=.27,radius2=.025,depth=1.6)
        obj=bpy.context.object
        obj.name=f'ThrusterPlume_{side}'
        # Build in anchor-local +Y; the anchor supplies the aft orientation.
        for vertex in obj.data.vertices:
            x,y,z=vertex.co
            vertex.co=(x,z+.8,-y)
        obj.parent=anchor
        obj.location=(0,0,0)
        obj.data.materials.append(mat)
        obj.scale=(.001,.001,.001)
        plumes.append(obj)
    return plumes
