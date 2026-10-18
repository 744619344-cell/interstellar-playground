"""Independent source hashes, rigid placements and finite clearance probes; no mesh writes."""
import hashlib
import itertools
import json
from pathlib import Path
import numpy as np
from assembly_geometry import ROOT,read_world,place,first

BASE=Path(__file__).resolve().parent


def main():
    manifest=json.loads((BASE/'assembly-v2.json').read_text())
    geometries={};checks=[]
    for item in manifest['sources']:
        path=ROOT/item['source'];assert hashlib.sha256(path.read_bytes()).hexdigest()==item['sha256']
        assert item['uniformScale']>0 and 'nonuniformScale' not in item
        v,f=read_world(path,item['modules']);w=place(v,item['uniformScale'],item['rotationYDegrees'],item['placementCenter'])
        bounds=np.array([w.min(0),w.max(0)]);assert np.allclose(bounds,item['displayBounds'],atol=1e-8)
        geometries[item['id']]=(w,f);checks.append({'id':item['id'],'sourceHashMatches':True,'boundsRecomputed':bounds.tolist()})
    items={x['id']:x for x in manifest['sources']}
    assert items['bed-front']['source']==items['bed-rear']['source']
    assert items['bed-front']['uniformScale']==items['bed-rear']['uniformScale']
    assert items['bed-front']['placementCenter'][1]==items['bed-rear']['placementCenter'][1]
    furniture=['seats','console','bed-front','bed-rear','workbench']
    pairs=[]
    for a,b in itertools.combinations(furniture,2):
        ba=np.array(items[a]['displayBounds']);bb=np.array(items[b]['displayBounds'])
        overlap=np.minimum(ba[1],bb[1])-np.maximum(ba[0],bb[0])
        pairs.append({'a':a,'b':b,'aabbOverlaps':bool(np.all(overlap>0)),'axisOverlap':overlap.tolist()})
    assert not any(p['aabbOverlaps'] for p in pairs),'Furniture bounding boxes must not overlap'
    cabin,cf=geometries['cabin'];hull,hf=read_world(ROOT/items['exterior']['source'],['exterior-hull'])
    roof=[];sides=[]
    for z in [-2,0,2,4]:
        ca=first(cabin,cf,[0,0,z],[0,1,0]);ha=first(hull,hf,[0,0,z],[0,1,0])
        roof.append({'z':z,'cabinRoofY':ca,'hullY':ha,'gap':None if ca is None or ha is None else ha-ca})
        for y in [-1,.0,1]:
            for sign in [-1,1]:
                a=first(cabin,cf,[0,y,z],[sign,0,0]);b=first(hull,hf,[0,y,z],[sign,0,0])
                sides.append({'z':z,'y':y,'side':sign,'cabin':a,'hull':b,'gap':None if a is None or b is None else b-a})
    floor=[]
    for name in furniture:
        row=items[name];bb=np.array(row['displayBounds']);center=bb.mean(0)
        for x,z in [(center[0],center[2]),(bb[0,0],bb[0,2]),(bb[0,0],bb[1,2]),(bb[1,0],bb[0,2]),(bb[1,0],bb[1,2])]:
            distance=first(cabin,cf,[x,0,z],[0,-1,0])
            floor.append({'component':name,'x':float(x),'z':float(z),'floorY':None if distance is None else -distance,
                          'bottomVsFloor':None if distance is None else float(bb[0,1]+distance)})
    report={'sourceChecks':checks,'furnitureAABBPairs':pairs,'roofSamples':roof,'sideSamples':sides,'floorSamples':floor,
        'bedsSameHeight':True,'bedsSameSide':True,'sourceGeometryModified':False,'visualAccepted':False,
        'fullCollisionAccepted':False,'humanClearanceAccepted':False,
        'limits':'Finite first surfaces/AABBs do not prove wall thickness, no interpenetration, knee clearance or continuous contact.'}
    (BASE/'装配-v2-有限检查.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({'sourceHashChecks':len(checks),'nonOverlappingFurniturePairs':len(pairs),'roofSamples':roof,
                      'lowestFloorGap':min(x['bottomVsFloor'] for x in floor if x['bottomVsFloor'] is not None)},ensure_ascii=False,indent=2))


if __name__=='__main__':main()
