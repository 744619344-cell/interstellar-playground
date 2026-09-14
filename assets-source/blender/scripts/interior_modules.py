"""Static single-deck interior modules, metre units in exterior coordinates."""
import math
import bpy
from ship_geometry import box, cylinder, mesh, tube, socket


def panel(name, p, size, mat, lod, bevel=.035):
    return box(name,p,size,mat,bevel,[6,4][lod])


def room_shell(m,lod):
    panel('CabinFloor',(0,-.975,-1.29),(3.2,7.45,.06),m['dark'],lod,.02)
    panel('AirlockFloor',(0,-5.97,-1.29),(1.85,2.55,.06),m['dark'],lod,.02)
    vertices=[(x,y,z) for z in (-1.32,-1.26) for y,w in ((2.75,1.6),(5.15,.8)) for x in (-w,w)]
    mesh('CockpitFloor',vertices,[(0,2,3,1),(4,5,7,6),(0,1,5,4),
                                (2,6,7,3),(0,4,6,2),(1,3,7,5)],m['dark'])
    for y in [-6.9+i*.6 for i in range(16)]:
        width=1.85 if y < -4.65 else 3.05
        panel('FloorTile',(0,y,-1.246),(width,.56,.025),m['floor'],lod,.015)
        for side in (-1,1):
            panel('AisleLight',(side*.58,y,-1.228),(.026,.36,.015),m['cyan'],lod,.005)
    for y in (-3.8,-2.1,-.4,1.3):
        for side in (-1,1):
            panel('WallPanel',(side*1.68,y,-.1),(.1,1.63,2.25),m['white'],lod)
            panel('WallRail',(side*1.63,y,.78),(.045,1.35,.06),m['metal'],lod,.02)
        panel('CeilingPanel',(0,y,1.18),(3.3,1.63,.09),m['white'],lod)
        for x in (-.8,.8):
            panel('CeilingLight',(x,y,1.118),(.09,1.25,.025),m['light'],lod,.01)
    for y in (-6.6,-5.4):
        for side in (-1,1):
            panel('AirlockWall',(side*1.1,y,-.1),(.1,1.13,2.25),m['white'],lod)
        panel('AirlockCeiling',(0,y,1.03),(2.12,1.13,.08),m['white'],lod)
        panel('AirlockLight',(0,y,.975),(.12,.75,.025),m['light'],lod,.01)


def seat(m,lod,name,position):
    x,y,z=position
    cylinder(name+'_Pedestal',(x,y,-1.02),.2,.45,m['metal'],[48,24][lod],(0,0,1))
    panel(name+'_Pan',(x,y,z-.12),(.64,.72,.16),m['dark'],lod,.07)
    panel(name+'_Cushion',(x,y,z),(.57,.64,.16),m['fabric'],lod,.07)
    panel(name+'_Back',(x,y-.31,z+.4),(.65,.19,1.05),m['dark'],lod,.08)
    for i in range(5):
        panel(name+'_BackPad',(x,y-.2,z+.04+i*.15),(.51,.13,.13),m['fabric'],lod,.04)
    panel(name+'_Headrest',(x,y-.27,z+1),(.42,.2,.26),m['fabric'],lod,.075)
    for side in (-1,1):
        panel(name+'_Armrest',(x+side*.31,y,z+.23),(.08,.6,.09),m['dark'],lod)
        tube(name+'_Harness',[(x+side*.18,y-.09,z+.8),(x+side*.13,y+.05,z+.4),
                              (x+side*.07,y+.15,z+.1)],.025,m['amber'],[12,8][lod])
    panel(name+'_Buckle',(x,y+.16,z+.12),(.13,.09,.065),m['metal'],lod,.015)


def cockpit(m,lod,anchors):
    for name in ('Seat_Pilot','Seat_Copilot'):
        seat(m,lod,name,anchors[name])
    for side in (-1,1):
        x=anchors['Seat_Pilot' if side==-1 else 'Seat_Copilot'][0]
        panel('ConsolePedestal',(x,4.9,-1.035),(.35,.3,.43),m['metal'],lod,.035)
        panel('ConsoleBody',(x,5.05,-.43),(.94,.58,.84),m['dark'],lod,.08)
        panel('ConsoleScreen',(x,4.747,.03),(.71,.035,.27),m['screen'],lod,.025)
        for i in range(4):
            panel('DisplayLine',(x-.22+i*.14,4.724,.04),(.055,.012,.09+.025*i),m['cyan'],lod,.006)
        for j in range(7):
            cylinder('ConsoleKey',(x-.3+j*.1,4.744,-.25),.025,.035,
                     m['amber'] if j==6 else m['metal'],[16,8][lod],(0,-1,0))
        cylinder('StickBase',(x+side*.34,4.17,-.54),.07,.12,m['metal'],[24,12][lod],(0,0,1))
        panel('FlightStick',(x+side*.34,4.17,-.37),(.07,.09,.25),m['dark'],lod)
    panel('CenterConsole',(0,4.2,-.69),(.35,1.02,.61),m['dark'],lod,.06)
    panel('CenterConsoleBase',(0,4.2,-1.13),(.28,.65,.27),m['metal'],lod,.025)
    socket('Anchor_StandUp',(0,2.6,-1.22))
    socket('Anchor_Console',(0,4.2,-.1))


def equipment(m,lod):
    for side in (-1,1):
        for y in (-3.6,-2.8,.4,1.35):
            panel('CabinetBody',(side*1.28,y,-.17),(.65,.8,1.92),m['dark'],lod)
            for z in (-.74,-.15,.44):
                panel('CabinetDoor',(side*.92,y,z),(.065,.7,.52),m['white'],lod)
                panel('CabinetLatch',(side*.875,y+.2,z),(.035,.1,.2),m['amber'],lod,.015)
                if lod==0:
                    for dy in (-.26,.26):
                        cylinder('CabinetFastener',(side*.872,y+dy,z+.18),.025,.02,
                                 m['metal'],12,(side,0,0))
        # Folded bunks stay outside the 1 m corridor; no unfolding animation yet.
        panel('FoldedBunk',(side*1.42,-1.2,-.2),(.19,1.85,1.18),m['fabric'],lod,.08)
        panel('BunkFrame',(side*1.56,-1.2,-.2),(.12,2.02,1.34),m['metal'],lod)
        tube('BunkRestraint',[(side*1.29,-1.94,-.62),(side*1.29,-1.2,.33),
                              (side*1.29,-.46,-.62)],.035,m['amber'],[12,8][lod])
        for z in (-.7,.2):
            panel('EquipmentCase',(side*1.23,-4.2,z),(.61,.48,.65),m['white'],lod,.065)
            panel('EquipmentGrip',(side*.89,-4.2,z),(.06,.23,.09),m['dark'],lod)
    socket('Anchor_Living',(0,-.8,-1.22))
    socket('Anchor_Equipment',(0,-3.9,-1.22))


def airlock(m,lod):
    panel('Door_Outer_Liner',(0,-7.25,-.15),(1.14,.035,2.1),m['white'],lod,.035)
    panel('Door_Outer_LinerSeam',(0,-7.224,-.15),(.015,.012,1.75),m['dark'],lod,.004)
    for side in (-1,1):
        panel('AirlockPartition',(side*1.1,-4.68,-.15),(1.04,.1,2.2),m['white'],lod)
    panel('AirlockPartitionHeader',(0,-4.68,1.065),(3.24,.1,.23),m['white'],lod)
    for side in (-1,1):
        panel('DoorJamb',(side*.68,-4.65,-.13),(.2,.2,2.26),m['metal'],lod)
    panel('DoorLintel',(0,-4.65,1.03),(1.56,.2,.16),m['metal'],lod)
    # One independent closed inner door; viewer can hide it for inspection only.
    panel('Door_Inner',(0,-4.66,-.15),(1.15,.12,2.12),m['white'],lod,.075)
    for side in (-1,1):
        tube('AirlockHandrail',[(side*.97,-6.9,-.65),(side*.91,-6.9,.6),
                                (side*.91,-5.2,.6),(side*.97,-5.2,-.65)],.035,m['amber'],[16,10][lod])
    panel('PressurePanel',(.99,-5.5,.1),(.1,.61,.8),m['dark'],lod)
    panel('PressureDisplay',(.928,-5.5,.24),(.018,.43,.27),m['screen'],lod,.02)
    for y in (-5.65,-5.5,-5.35):
        cylinder('PressureSwitch',(.91,y,-.05),.04,.04,m['cyan'],[20,12][lod],(-1,0,0))
    socket('Anchor_Airlock',(0,-5.7,-1.22))
    socket('Anchor_DoorInner',(0,-4.45,0))
