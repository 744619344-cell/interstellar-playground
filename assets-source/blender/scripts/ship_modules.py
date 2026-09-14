"""Exterior pressure shell, canopy, service equipment and propulsion pods."""
import math
from ship_geometry import box, cylinder, mesh, patch, profile, surface, tube, socket
from ship_detail import pod_armor, nozzle


def hull(m, lod):
    steps, slices = [(24, 64), (12, 40), (6, 16)][lod]
    patch('PressureShell', -7.45, 3.1, 0, 2*math.pi, steps, slices, m['dark'])
    # Real seams between discrete ceramic panels, backed by the pressure shell.
    for bay, (a, b) in enumerate(zip([-7.45,-6.2,-3.5,0,1.55], [-6.2,-3.5,0,1.55,3.1])):
        for sector in range(8):
            angle = sector*math.pi/4
            panel_mat = m['white'] if sector < 5 or sector == 7 else m['dark']
            patch(f'HullPanel_{bay}_{sector}', a+.025, b-.025, angle+.006,
                  angle+math.pi/4-.006, steps, slices//8, panel_mat, .028)
    patch('NoseLower', 3.1, 7.45, math.pi, 2*math.pi, steps*2, slices//2, m['white'])
    patch('Canopy_Glass', 3.1, 7.45, 0, math.pi, steps*2, slices//2, m['glass'], .035)
    for y in (3.1, 5.15, 7.43):
        points = [surface(y, math.pi*j/32, .09) for j in range(33)]
        tube('CanopyFrame', points, .052, m['white'], 8+4*(2-lod))
    for angle in (0, math.pi/2, math.pi):
        points = [surface(3.1+4.34*j/32, angle, .09) for j in range(33)]
        tube('CanopyLongeron', points, .045, m['dark'], 8)
    box('NoseBumper', (0,7.46,-.6), (1.12,.2,.56), m['dark'], .14, 4)
    for x in (-.38,.38):
        box('ForwardRunningLight', (x,7.575,-.55), (.16,.04,.1), m['cyan'], .025)
    box('Keel', (0,-.7,-2.22), (1.6,8.8,.3), m['dark'], .12)


def service_panels(m, lod):
    segments = [6,4,2][lod]
    for y in (-4.8,-1.8,.8):
        for side in (-1,1):
            box('ServiceFrame', (side*2.21,y,.05), (.11,1.45,.85), m['dark'], .09, segments)
            box('ServiceCover', (side*2.275,y,.05), (.08,1.25,.66), m['white'], .06, segments)
            box('AmberLatch', (side*2.33,y+.4,.05), (.04,.08,.25), m['amber'], .02)
            if lod < 2:
                for z in (-.2,.3):
                    for dy in (-.48,.48):
                        cylinder('Fastener', (side*2.33,y+dy,z), .035,.025,
                                 m['metal'], 12, (side,0,0))
        box('DorsalRadiatorFrame', (0,y,2.235), (1.35,1.9,.16), m['dark'], .08, segments)
        for i in range([12,8,4][lod]):
            count = [12,8,4][lod]
            box('RadiatorFin', (0,y-.78+1.56*i/max(1,count-1),2.33),
                (1.12,.045,.07), m['metal'], .015, 2)
    for side in (-1,1):
        points = [(side*1.65,y,profile(y)[1]*.72) for y in (-5.8,-5,-4)]
        tube('HullHandrail', points, .045, m['metal'])


def pod(m, lod, side):
    segments = [72,44,24][lod]
    x = side*2.85
    # Lathed nacelle with open aft nozzle; positive Y nose.
    rings = [(-6.7,.7),(-6.4,.85),(-5.8,1.0),(-4.6,1.05),
             (-1.8,1.05),(1.3,1.0),(2.1,.85),(2.5,.58)]
    vertices, faces = [], []
    detail = [12,6,3][lod]
    for index, (a,b) in enumerate(zip(rings,rings[1:])):
        for step in range(detail):
            t = step/detail
            radius = a[1]+(b[1]-a[1])*(t*t*(3-2*t))
            y = a[0]+(b[0]-a[0])*t
            for j in range(segments):
                angle = j*2*math.pi/segments
                vertices.append((x+radius*math.cos(angle),y,-.55+radius*math.sin(angle)))
    for j in range(segments):
        angle = j*2*math.pi/segments
        vertices.append((x+rings[-1][1]*math.cos(angle),rings[-1][0],-.55+rings[-1][1]*math.sin(angle)))
    for i in range(len(vertices)//segments-1):
        for j in range(segments):
            a = i*segments+j
            b = i*segments+(j+1)%segments
            faces.append((a+segments,b+segments,b,a))
    mesh(f'EnginePod_{side}',vertices,faces,m['dark'])
    pod_armor(m,lod,side)
    for y in (-5.7,-1.8,1.3):
        points = [(x+1.055*math.cos(j*2*math.pi/segments),y,
                   -.55+1.055*math.sin(j*2*math.pi/segments)) for j in range(segments+1)]
        tube('PodStructuralBand',points,.065,m['dark'],8)
    for y in (-4.8,.6):
        box('EnginePylon',(side*2.25,y,-.5),(1.2,.75,.55),m['dark'],.12)
    nozzle(m,lod,x)
    for y, radius, depth, mat in [(2.52,.52,.055,m['dark']),
                                (2.56,.19,.04,m['cyan'])]:
        cylinder('EngineNozzle', (x,y,-.55), radius,depth,mat,segments)
    socket(f'Thruster_Main_{side}',(x,-7.06,-.55),(0,-1,0))
    socket(f'Thruster_Reverse_{side}',(x,2.6,-.55),(0,1,0))


def airlock(m, lod):
    box('AftBulkhead',(0,-7.44,0),(2.9,.18,3.18),m['dark'],.5,8)
    box('AirlockSurround',(0,-7.57,0),(2.12,.15,2.7),m['metal'],.32,8)
    box('Door_Outer',(0,-7.68,0),(1.62,.12,2.25),m['white'],.26,8)
    box('DoorSealLine',(0,-7.749,0),(.02,.008,1.75),m['dark'],0)
    for side in (-1,1):
        box('DoorHinge',(side*.91,-7.69,.55),(.12,.2,.38),m['dark'],.03)
        tube('AirlockGrabHandle',[(side*1.2,-7.5,-.6),(side*1.2,-7.73,-.6),
                                 (side*1.2,-7.73,.6),(side*1.2,-7.5,.6)],.055,m['amber'])
    box('AirlockStatus',(1.04,-7.68,.95),(.18,.04,.08),m['cyan'],.02)
    socket('Anchor_EVA',(0,-8.95,0))
    socket('Anchor_Tether',(1.25,-7.6,.25))
    socket('Anchor_CockpitCamera',(-.65,4.1,.65))
    socket('Anchor_ThirdPersonCamera',(0,-20,8))
    socket('Seat_Pilot',(-.65,3.8,-.55))
    socket('Seat_Copilot',(.65,3.8,-.55))


def rcs(m, lod):
    for side in (-1,1):
        for bay,y in enumerate((-5.6,2.2)):
            for axis,(z, direction) in enumerate([(1.1,(side,0,0)),(1.7,(0,0,1)),(-1.7,(0,0,-1))]):
                x = side*(1.8 if abs(z)>1.5 else 2.12)
                box('RCSHousing',(x,y,z),(.32,.48,.32),m['dark'],.07)
                cylinder('RCSThroat',(x+direction[0]*.17,y,z+direction[2]*.17),
                         .085,.08,m['metal'],[32,20,12][lod],direction)
                socket(f'Thruster_RCS_{side}_{bay}_{axis}',(x,y,z),direction)
