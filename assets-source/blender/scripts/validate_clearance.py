"""Static exterior-only sight rays and a sampled aft egress corridor."""
import math
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def collision_tree(collection, excluded):
    vertices, faces = [], []
    for obj in collection.objects:
        if obj.type != 'MESH' or obj.name in excluded:
            continue
        offset = len(vertices)
        vertices.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
        faces.extend(tuple(offset+i for i in p.vertices) for p in obj.data.polygons)
    return BVHTree.FromPolygons(vertices, faces)


def inspect_clearance(collection):
    # P3-T01 explicitly hides the independent external canopy in cockpit mode.
    tree = collision_tree(collection, {'Canopy_Glass'})
    eye = collection.objects['Anchor_CockpitCamera'].matrix_world.translation
    blocked = []
    for yaw in (-20,-10,0,10,20):
        for pitch in (-10,0,10):
            direction = Vector((math.tan(math.radians(yaw)),1,math.tan(math.radians(pitch)))).normalized()
            if tree.ray_cast(eye,direction,12)[0] is not None:
                blocked.append([yaw,pitch])
    # Start outside the closed door; this verifies external path, not door animation.
    tree = collision_tree(collection, {'Door_Outer'})
    door = collection.objects['Door_Outer']
    aft = min((door.matrix_world @ v.co).y for v in door.data.vertices)-.08
    collisions = []
    for x in (-.5,-.25,0,.25,.5):
        for z in (-1.05,-.525,0,.525,1.05):
            if tree.ray_cast(Vector((x,aft,z)),Vector((0,-1,0)),1.5)[0] is not None:
                collisions.append([x,z])
    return {'cockpitCanopyHidden':True,'sightRayCount':15,'blockedSightRays':blocked,
            'egressSampleCount':25,'blockedEgressSamples':collisions,
            'egressSampleSizeMetres':[1,1.5,2.1]}
