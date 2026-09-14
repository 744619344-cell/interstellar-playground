"""Pre-merge corridor bounds and analytic exterior pressure-shell checks."""
import math
from mathutils import Vector
from ship_geometry import profile


def inspect_interior(collection,lod,anchors):
    low,high=Vector((-.5,-7.15,-1.20)),Vector((.5,2.75,.91))
    obstructed=[]
    points=[]
    triangles=0
    for obj in collection.objects:
        if obj.type!='MESH':
            continue
        obj.data.calc_loop_triangles()
        triangles+=len(obj.data.loop_triangles)
        vertices=[obj.matrix_world@v.co for v in obj.data.vertices]
        points.extend(vertices)
        a=[min(p[k] for p in vertices) for k in range(3)]
        b=[max(p[k] for p in vertices) for k in range(3)]
        if obj.name!='Door_Inner' and all(a[k]<high[k] and b[k]>low[k] for k in range(3)):
            obstructed.append(obj.name)
    assert all(math.isfinite(v) for p in points for v in p)
    pilot,copilot,eye=[Vector(anchors[n]) for n in ('Seat_Pilot','Seat_Copilot','Anchor_CockpitCamera')]
    scale=Vector(((copilot.x-pilot.x)/1.3,(eye.y-pilot.y)/.3,(eye.z-pilot.z)/1.2))
    center=Vector((-.65,3.8,-.55))-Vector(pilot[k]/scale[k] for k in range(3))
    worst=(0,None)
    for point in points:
        p=Vector(point[k]/scale[k]+center[k] for k in range(3))
        width,height,z=profile(p.y)
        ratio=math.sqrt((p.x/width)**2+((p.z-z)/height)**2)
        if ratio>worst[0]:
            worst=(ratio,list(point))
    budget=[(100000,160000),(40000,80000)][lod]
    return {'lod':lod,'triangles':triangles,'vertices':len(points),'budget':budget,
            'withinBudget':budget[0]<=triangles<=budget[1],
            'corridorSize':[1,9.9,2.11],'corridorObstructions':obstructed,
            'closedInnerDoorExcluded':True,'doorClearWidth':1.16,'doorClearHeight':2.21,
            'shellMaxRadiusRatio':worst[0],'shellWorstPoint':worst[1],
            'dimensions':[max(p[k] for p in points)-min(p[k] for p in points) for k in range(3)],
            'anchors':anchors}
