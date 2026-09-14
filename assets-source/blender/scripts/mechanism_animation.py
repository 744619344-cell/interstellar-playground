"""Named NLA clips, keyed on independent mechanisms only."""
import math
import bpy


def clip(obj,name,channels):
    rest={path:tuple(getattr(obj,path)) for path in channels}
    for path,keys in channels.items():
        for frame,value in keys:
            setattr(obj,path,value)
            obj.keyframe_insert(data_path=path,frame=frame,group=name)
    action=obj.animation_data.action
    action.name=f'{name}_{obj.name}'
    slot=obj.animation_data.action_slot
    for layer in action.layers:
        for strip in layer.strips:
            bag=strip.channelbag(slot)
            if bag:
                for curve in bag.fcurves:
                    for key in curve.keyframe_points:
                        key.interpolation='LINEAR'
    track=obj.animation_data.nla_tracks.new()
    track.name=name
    strip=track.strips.new(name,int(action.frame_range[0]),action)
    strip.action_slot=slot
    strip.extrapolation='NOTHING'
    obj.animation_data.action=None
    for path,value in rest.items():
        setattr(obj,path,value)


def animate(outer,inner,bars,plumes):
    clip(outer,'OuterDoorOpen',{'location':[(1,(0,0,0)),(15,(0,-.72,0)),(40,(1.75,-.72,0))]})
    clip(outer,'OuterDoorClose',{'location':[(1,(1.75,-.72,0)),(26,(0,-.72,0)),(40,(0,0,0))]})
    p=tuple(inner.location)
    pulled=(p[0],p[1]-.18,p[2])
    clip(inner,'InnerDoorOpen',{'location':[(1,p),(9,pulled),(40,pulled)],
        'rotation_euler':[(1,(0,0,0)),(9,(0,0,0)),(40,(0,0,math.pi/2))]})
    clip(inner,'InnerDoorClose',{'location':[(1,pulled),(32,pulled),(40,p)],
        'rotation_euler':[(1,(0,0,math.pi/2)),(32,(0,0,0)),(40,(0,0,0))]})
    for index,bar in enumerate(bars):
        keys=[(1,(1,1,.6)),(16,(1,1,.3+.1*(index%5))),
              (31,(1,1,1)),(46,(1,1,.4+.08*(index%4))),(61,(1,1,.6))]
        clip(bar,'ConsoleActive',{'scale':keys})
    for plume in plumes:
        clip(plume,'ThrusterBurn',{'scale':[(1,(.75,.8,.75)),(9,(.88,1,.88)),
             (17,(.8,.86,.8)),(24,(.91,1.04,.91)),(31,(.75,.8,.75))]})
    bpy.context.scene.frame_set(0)
