"""Deterministic metre-scale hard-surface primitives; Blender Python only."""
import math
import bpy
from mathutils import Vector


def material(name, color, metallic=0.0, roughness=0.4, emission=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metallic
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Emission Color'].default_value = (*color, 1)
    shader.inputs['Emission Strength'].default_value = emission
    return mat


def mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for polygon in data.polygons:
        polygon.use_smooth = True
    return obj


def box(name, location, size, mat, bevel=0.06, segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Machined edge radius', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        bpy.ops.object.modifier_apply(modifier=mod.name)
        normal = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=normal.name)
    return obj


def cylinder(name, center, radius, depth, mat, segments=48, direction=(0, 1, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=segments, radius=radius,
                                     depth=depth, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(Vector(direction))
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(mat)
    for poly in obj.data.polygons:
        poly.use_smooth = len(poly.vertices) == 4
    return obj


def tube(name, points, radius, mat, sides=10):
    vertices, faces = [], []
    for i, point in enumerate(points):
        tangent = Vector(points[min(i+1, len(points)-1)]) - Vector(points[max(0, i-1)])
        tangent.normalize()
        axis = Vector((0, 0, 1)) if abs(tangent.z) < 0.9 else Vector((1, 0, 0))
        u = tangent.cross(axis).normalized()
        v = tangent.cross(u).normalized()
        for j in range(sides):
            angle = 2 * math.pi * j / sides
            vertices.append(Vector(point) + radius * (math.cos(angle)*u + math.sin(angle)*v))
    for i in range(len(points)-1):
        for j in range(sides):
            a, b = i*sides+j, i*sides+(j+1)%sides
            faces.append((a, b, b+sides, a+sides))
    faces.extend([tuple(reversed(range(sides))),
                  tuple((len(points)-1)*sides+j for j in range(sides))])
    return mesh(name, vertices, faces, mat)


def profile(y):
    """C1 smooth oval pressure vessel, positive Y nose."""
    stations = [(-7.45, 1.5, 1.65, 0), (-6.2, 2.1, 2.02, 0),
                (-3.5, 2.22, 2.2, 0), (0, 2.22, 2.2, 0),
                (3.1, 2.12, 2.03, 0), (5, 1.8, 1.48, -0.1),
                (6.7, 1.2, 0.72, -0.4), (7.45, 0.52, 0.36, -0.55)]
    for index,(a, b) in enumerate(zip(stations, stations[1:])):
        if y <= b[0]:
            t = max(0, (y-a[0])/(b[0]-a[0]))
            values = []
            for k in range(1,4):
                delta = (b[k]-a[k])/(b[0]-a[0])
                prev = stations[max(0,index-1)]
                after = stations[min(len(stations)-1,index+2)]
                left = (a[k]-prev[k])/(a[0]-prev[0]) if index else delta
                right = (after[k]-b[k])/(after[0]-b[0]) if index+2<len(stations) else delta
                slope_a = 2*left*delta/(left+delta) if left*delta>0 else 0
                slope_b = 2*right*delta/(right+delta) if right*delta>0 else 0
                values.append((2*t**3-3*t*t+1)*a[k]+(-2*t**3+3*t*t)*b[k]
                              +(t**3-2*t*t+t)*(b[0]-a[0])*slope_a
                              +(t**3-t*t)*(b[0]-a[0])*slope_b)
            return tuple(values)
    return stations[-1][1:]


def surface(y, angle, offset=0):
    width, height, z = profile(y)
    return ((width+offset)*math.cos(angle), y, z+(height+offset)*math.sin(angle))


def patch(name, start, end, angle_a, angle_b, steps, slices, mat, offset=0):
    vertices, faces = [], []
    for i in range(steps+1):
        y = start+(end-start)*i/steps
        for j in range(slices+1):
            vertices.append(surface(y, angle_a+(angle_b-angle_a)*j/slices, offset))
    for i in range(steps):
        for j in range(slices):
            k = i*(slices+1)+j
            faces.append((k+slices+1, k+slices+2, k+1, k))
    return mesh(name, vertices, faces, mat)


def socket(name, position, direction=None, **extras):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    obj.empty_display_size = 0.2
    obj['semanticName'] = name
    if direction:
        obj.rotation_mode = 'QUATERNION'
        obj.rotation_quaternion = Vector((0, 1, 0)).rotation_difference(Vector(direction))
    for key, value in extras.items():
        obj[key] = value
    return obj
