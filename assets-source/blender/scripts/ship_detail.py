"""Layered exterior armor and service hardware; no textures or runtime logic."""
import math
import bpy
from mathutils import Vector
from ship_geometry import box, cylinder, mesh, patch, surface, tube


def mounted_box(name, y, angle, size, mat, offset=.1, bevel=.035):
    obj = box(name, surface(y, angle, offset), size, mat, bevel, 2)
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((0,0,1)).rotation_difference(
        Vector((math.cos(angle),0,math.sin(angle))))
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return obj


def hull_armor(m, lod):
    # Offset curved armor carries its own seal; stagger joints across the roof.
    for side in (-1,1):
        for bay, (a,b) in enumerate(((-6.05,-3.65),(-3.35,-.18),(.18,2.92))):
            low, high = (.38,1.13) if side == 1 else (math.pi-1.13,math.pi-.38)
            patch('ShoulderSeal',a,b,low,high,8,6,m['dark'],.065)
            patch('ShoulderArmor',a+.065,b-.065,low+.025,high-.025,
                  [14,8,4][lod],[10,6,3][lod],m['white'],.095)
            angle = .72 if side == 1 else math.pi-.72
            mounted_box('RecessedServiceWell',(a+b)/2,angle,(.62,.86,.045),m['dark'],.14)
            if lod < 2:
                for dy in (-.25,0,.25):
                    mounted_box('ServiceLouver',(a+b)/2+dy,angle,
                                (.5,.07,.04),m['metal'],.18,.01)
                mounted_box('ServiceLatch',a+.28,angle,(.14,.22,.025),m['amber'],.15,.015)
        for y in (-5.9,-3.48,-.03,2.8):
            angle = .32 if side == 1 else math.pi-.32
            mounted_box('ArmorBridge',y,angle,(.23,.24,.045),m['metal'],.08,.02)
        angle = .2 if side == 1 else math.pi-.2
        mounted_box('NavigationBezel',2.5,angle,(.44,.6,.08),m['dark'],.12)
        mounted_box('NavigationLens',2.5,angle,(.25,.32,.03),m['cyan'],.18,.02)
    # The dark nose chin reads as a sensor grille, framed by the ceramic shell.
    box('ChinGrille',(0,7.49,-.78),(1.04,.12,.3),m['dark'],.07,3)
    if lod < 2:
        for x in (-.34,-.17,0,.17,.34):
            box('ChinGrilleSlat',(x,7.56,-.78),(.035,.025,.2),m['metal'],.009,2)


def pod_armor(m, lod, side):
    x = side*2.85
    segments = [12,8,4][lod]
    # Six broad armor petals around a graphite core, with exposed service breaks.
    for bay,(a,b) in enumerate(((-5.55,-4.8),(-4.4,-1.98),(-1.6,1.12))):
        for sector in range(6):
            vertices, faces = [], []
            angle0 = sector*math.pi/3+.035
            for i in range(5):
                for j in range(segments+1):
                    angle = angle0+(math.pi/3-.07)*j/segments
                    inset = .12*abs(2*j/segments-1)**6
                    y = a+inset+(b-a-2*inset)*i/4
                    radius = 1.067
                    vertices.append((x+radius*math.cos(angle),y,-.55+radius*math.sin(angle)))
            for i in range(4):
                for j in range(segments):
                    k = i*(segments+1)+j
                    faces.append((k+segments+1,k+segments+2,k+1,k))
            obj = mesh('PodArmorPetal',vertices,faces,m['white'])
            modifier = obj.modifiers.new('Armor thickness','SOLIDIFY')
            modifier.thickness = .028
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    for y in (-4.63,-1.8):
        for j in range([12,8,6][lod]):
            angle = j*2*math.pi/[12,8,6][lod]
            cylinder('PodCouplingBolt',(x+1.085*math.cos(angle),y,-.55+1.085*math.sin(angle)),
                     .055,.06,m['metal'],[12,8,6][lod],(math.cos(angle),0,math.sin(angle)))
    box('PodVentHousing',(x,-.1,.53),(.68,1.6,.12),m['dark'],.09,3)
    for i in range([8,5,3][lod]):
        count = [8,5,3][lod]
        box('PodVentFin',(x,-.72+i*1.24/(count-1),.61),(.52,.045,.055),m['metal'],.012,2)
    box('PodServiceMarker',(x,.87,.57),(.35,.12,.035),m['amber'],.02,2)
    for y in (-4.8,.6):
        tube('PylonHydraulicLine',[(side*1.85,y,.1),(side*2.3,y,.22),
                                  (side*2.6,y,.3)],.06,m['metal'],8)


def nozzle(m, lod, x):
    segments = [64,40,20][lod]
    # Rear opening has an actual annular lip and recessed converging throat.
    rings = [(-6.6,.69),(-6.95,.76),(-7.06,.7),(-7.06,.59),(-6.94,.55),(-6.7,.32)]
    vertices, faces = [], []
    for y,radius in rings:
        vertices.extend((x+radius*math.cos(j*2*math.pi/segments),y,
                         -.55+radius*math.sin(j*2*math.pi/segments)) for j in range(segments))
    for i in range(len(rings)-1):
        for j in range(segments):
            a,b = i*segments+j,i*segments+(j+1)%segments
            faces.append((a+segments,b+segments,b,a))
    mesh('MainNozzleBell',vertices,faces,m['metal'])
    cylinder('MainNozzleThroat',(x,-6.69,-.55),.33,.025,m['dark'],segments)
    points = [(x+.25*math.cos(j*2*math.pi/segments),-6.72,
               -.55+.25*math.sin(j*2*math.pi/segments)) for j in range(segments+1)]
    tube('MainNozzleIonRing',points,.045,m['cyan'],8)
