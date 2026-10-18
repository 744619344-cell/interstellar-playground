"""Compose existing source instances with rigid transforms and uniform scales only."""
import hashlib
import json
from pathlib import Path
import numpy as np
from assembly_geometry import ROOT,read_world,place,first,yaw

BASE=Path(__file__).resolve().parent
DESIGN=ROOT/'output/hunyuan-adaptation/hunyuan-design-20261009'
RAW='混元原始模型.glb'
CABIN=DESIGN/'整舱重设计-20261016/全空间重设计-v7-20261017/主结构-v7'
EQUIPMENT=DESIGN/'内舱装配-20261013'
GLASS=ROOT/'output/hunyuan-adaptation/windshield-glass-20261018/前挡玻璃-r2交点顺光-r10.glb'


def description(name,path,v,scale=1,rotation=0,center=None,modules=None):
    source_center=(v.min(0)+v.max(0))/2
    center=source_center if center is None else np.array(center)
    w=place(v,scale,rotation,center)
    return {'id':name,'source':str(path.relative_to(ROOT)),
        'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'modules':modules,'sourceCenter':source_center.tolist(),'uniformScale':float(scale),
        'rotationYDegrees':rotation,'placementCenter':center.tolist(),
        'displayBounds':[w.min(0).tolist(),w.max(0).tolist()]}


def floor_samples(v,f,x,z,hx,hz):
    samples=[]
    for dx,dz in [(0,0),(-hx,-hz),(-hx,hz),(hx,-hz),(hx,hz)]:
        t=first(v,f,[x+dx,0,z+dz],[0,-1,0])
        assert t is not None,f'Missing floor below source at {x+dx},{z+dz}'
        samples.append({'x':x+dx,'z':z+dz,'y':-t})
    return samples


def furniture(name,path,scale,rotation,x,z,cabin_v,cabin_f):
    v,_=read_world(path)
    dims=np.ptp((v-(v.min(0)+v.max(0))/2)@yaw(rotation).T*scale,axis=0)
    samples=floor_samples(cabin_v,cabin_f,x,z,dims[0]*.35,dims[2]*.35)
    bottom=max(row['y'] for row in samples)+.003
    row=description(name,path,v,scale,rotation,[x,bottom+dims[1]/2,z])
    row['floorSamples']=samples
    return row


def main():
    history=json.loads((CABIN/'真实船壳试装检查-20261017.json').read_text())['cabinPose']
    original,faces=read_world(CABIN/RAW)
    cabin=description('cabin',CABIN/RAW,original,history['uniformScale'],180,history['placementCenter'])
    v=place(original,cabin['uniformScale'],180,cabin['placementCenter'])
    shell,_=read_world(GLASS,['exterior-hull','exterior-glass'])
    sources=[description('exterior',GLASS,shell,modules=['exterior-hull','exterior-glass']),cabin]
    seats,_=read_world(GLASS,['seat'])
    seat_floor=floor_samples(v,faces,0,-4.05,.65,.25)
    delta=max(s['y'] for s in seat_floor)+.003-seats[:,1].min()
    seat=description('seats',GLASS,seats,center=(seats.min(0)+seats.max(0))/2+[0,delta,0],modules=['seat'])
    seat['floorSamples']=seat_floor;sources.append(seat)
    pose=json.loads((EQUIPMENT/'主仪表台-v2/刚性试装参数.json').read_text())
    sources.append(furniture('console',EQUIPMENT/'主仪表台-v2'/RAW,pose['uniformScale'],0,0,-4.97,v,faces))
    bed_scale=1.6989706167001117
    bedv,_=read_world(EQUIPMENT/'折叠床-v1'/RAW)
    bed_half=np.ptp(bedv,axis=0)[2]*bed_scale/2
    bed_walls=[]
    for z in [.3,2.5]:
        bed_walls.extend(first(v,faces,[0,y,zz],[-1,0,0]) for y in [-1.3,-1.1,-.95] for zz in [z-.8,z,z+.8])
    assert all(t is not None for t in bed_walls)
    bed_x=-min(bed_walls)+bed_half+.12
    beds=[furniture(name,EQUIPMENT/'折叠床-v1'/RAW,bed_scale,90,bed_x,z,v,faces)
          for name,z in [('bed-front',.3),('bed-rear',2.5)]]
    shared_y=max(row['placementCenter'][1] for row in beds)
    for row in beds:
        delta_y=shared_y-row['placementCenter'][1]
        row['placementCenter'][1]=shared_y
        for bound in row['displayBounds']:bound[1]+=delta_y
        row['finiteSideBoundarySamples']=bed_walls
        sources.append(row)
    desk_pose=json.loads((EQUIPMENT/'工作台-v1/实装姿态.json').read_text())
    deskv,_=read_world(EQUIPMENT/'工作台-v1'/RAW)
    desk_half=np.ptp(deskv,axis=0)[2]*desk_pose['uniformScale']/2
    walls=[first(v,faces,[0,y,z],[1,0,0]) for y in [-1.3,-1.1,-.8] for z in [.8,1.3,1.8]]
    assert all(t is not None for t in walls)
    sources.append(furniture('workbench',EQUIPMENT/'工作台-v1'/RAW,desk_pose['uniformScale'],-90,min(walls)-desk_half-.12,1.3,v,faces))
    sources[-1]['finiteSideBoundarySamples']=walls
    lights=[{'position':[0,1.3,z],'watts':power,'radius':.6,'color':[1,.94,.86]} for z,power in [(-4,100),(-1,100),(1.4,100),(3.8,80)]]
    data={'revision':'v2','status':'assembly-candidate-not-accepted','geometryModified':False,
        'glassLocalUserAccepted':True,'wholeCabinAccepted':False,'sources':sources,'reviewLights':lights,
        'limits':['v7 proportion and roof/hull gap remain to be reviewed','Finite rays are not continuous collision or human clearance acceptance',
                  'No old box enclosure, duplicate bulkhead, external joystick stands or old glass restored'],
        'productReplaced':False}
    target=BASE/'assembly-v2.json';assert not target.exists();target.write_text(json.dumps(data,ensure_ascii=False,indent=2))
    print(json.dumps([{k:r[k] for k in ['id','uniformScale','placementCenter','displayBounds']} for r in sources],ensure_ascii=False,indent=2))


if __name__=='__main__':main()
