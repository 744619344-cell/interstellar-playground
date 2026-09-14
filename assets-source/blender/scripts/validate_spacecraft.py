"""Inspect actual evaluated meshes, finite positions, transforms and dimensions."""
import math
from mathutils import Vector
from validate_clearance import inspect_clearance


def inspect_collection(collection, lod):
    meshes = [obj for obj in collection.objects if obj.type == 'MESH']
    vertices = [obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices]
    assert vertices and all(math.isfinite(v) for point in vertices for v in point)
    triangles = 0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        assert all(abs(v-1)<1e-6 for v in obj.scale), obj.name
    low = [min(p[k] for p in vertices) for k in range(3)]
    high = [max(p[k] for p in vertices) for k in range(3)]
    dimensions = [round(high[k]-low[k],5) for k in range(3)]
    names = [obj.name for obj in collection.objects]
    for prefix in ['Ship_Exterior_LOD','Door_Outer','Canopy_Glass','Anchor_EVA',
                   'Anchor_Tether','Anchor_CockpitCamera','Anchor_ThirdPersonCamera',
                   'Thruster_Main_','Thruster_RCS_','Collider_']:
        assert any(name.startswith(prefix) for name in names), prefix
    limit = [(80000,120000),(35000,60000),(8000,20000)][lod]
    return {'lod':lod,'triangles':triangles,'vertices':len(vertices),
            'dimensionsBlenderXYZ':dimensions,'meshObjects':len(meshes),
            'materialCount':len({m.name for obj in meshes for m in obj.data.materials}),
            'budget':limit,'withinBudget':limit[0]<=triangles<=limit[1],
            'dimensionsMatch':all(abs(a-b)<.02 for a,b in zip(dimensions,[7.8,15.6,4.8])),
            'nodes':names,'clearance':inspect_clearance(collection)}
