"""Blender node graph and UV assignment for constant-material PBR atlases."""
import bpy


def material(zone,folder):
    mat=bpy.data.materials.new(f'Atlas_{zone}')
    mat.use_nodes=True
    nodes=mat.node_tree.nodes
    links=mat.node_tree.links
    shader=nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=(1,1,1,1)
    shader.inputs['Metallic'].default_value=1
    shader.inputs['Roughness'].default_value=1
    shader.inputs['Emission Color'].default_value=(1,1,1,1)
    shader.inputs['Emission Strength'].default_value=2
    textures={}
    for kind in ('Base','ORM','Emission'):
        image=bpy.data.images.load(str(folder/f'Atlas_{zone}_{kind}.webp'),check_existing=True)
        image.name=f'Atlas_{zone}_{kind}'
        image.colorspace_settings.name='Non-Color' if kind=='ORM' else 'sRGB'
        image.pack()
        node=nodes.new('ShaderNodeTexImage')
        node.image=image
        node.interpolation='Linear'
        textures[kind]=node
    links.new(textures['Base'].outputs['Color'],shader.inputs['Base Color'])
    links.new(textures['Emission'].outputs['Color'],shader.inputs['Emission Color'])
    separate=nodes.new('ShaderNodeSeparateColor')
    links.new(textures['ORM'].outputs['Color'],separate.inputs['Color'])
    links.new(separate.outputs['Green'],shader.inputs['Roughness'])
    links.new(separate.outputs['Blue'],shader.inputs['Metallic'])
    return mat


def assign(objects,report,folder):
    materials={zone:material(zone,folder) for zone in report['zones']}
    tiles={tile['material']:(zone,tile) for zone,items in report['zones'].items() for tile in items}
    for obj in objects:
        if obj.type!='MESH':
            continue
        if obj.name.startswith('ThrusterPlume_'):
            for old in list(obj.data.uv_layers):
                obj.data.uv_layers.remove(old)
            continue
        used={p.material_index for p in obj.data.polygons}
        mapped={i:tiles[obj.data.materials[i].name] for i in used}
        zones={zone for zone,_ in mapped.values()}
        assert len(zones)==1,obj.name
        zone=zones.pop()
        for old in list(obj.data.uv_layers):
            obj.data.uv_layers.remove(old)
        layer=obj.data.uv_layers.new(name='PBR_Atlas')
        for polygon in obj.data.polygons:
            _,tile=mapped[polygon.material_index]
            for index in polygon.loop_indices:
                layer.data[index].uv=tile['uv']
            polygon.material_index=0
        obj.data.materials.clear()
        obj.data.materials.append(materials[zone])


def merge_static(objects):
    prefixes=['Exterior_Hull_','Exterior_EnginePod_1_','Exterior_EnginePod_-1_',
              'Furniture_','Ceiling_','AftFrame_']
    for prefix in prefixes:
        group=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith(prefix)]
        if len(group)<2:
            continue
        assert len({o.parent for o in group})==1
        bpy.ops.object.select_all(action='DESELECT')
        for obj in group:
            assert obj.animation_data is None
            obj.select_set(True)
        bpy.context.view_layer.objects.active=group[0]
        bpy.ops.object.join()
        group[0].name=prefix+'Atlas'
