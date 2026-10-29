import { Box3, Matrix4, Mesh, Object3D, Ray, Vector3, type Group } from 'three'
import { CABIN_CREW } from '../../domain/cabinCrewMotion'
import { crewIntersectsBox } from './currentAftDoor'
import type { Vec3 } from '../../domain/vec3'

type FloorTriangle = { x:number;z:number;y:number;ux:number;uz:number;uy:number;vx:number;vz:number;vy:number;det:number }
const key=(x:number,z:number)=>`${Math.floor(x/.5)},${Math.floor(z/.5)}`
const skins=new Set(['exterior-hull','exterior-glass','interior-thickness'])
function tag(o:Object3D,name:string):unknown { for(let p:Object3D|null=o;p;p=p.parent)if(p.userData[name]!==undefined)return p.userData[name] }
function under(o:Object3D,name:string){for(let p:Object3D|null=o;p;p=p.parent)if(p.name===name)return true;return false}

/** Read-only local-space support triangles and conservative source-surface bounds; no GPU fixtures. */
export class CabinWalkSurface {
  private floor=new Map<string,FloorTriangle[]>()
  private walls=new Map<string,Box3[]>()
  private furniture:Box3[]=[]
  private furnitureOwners=new Map<Box3,string>()
  private floorBounds=new Box3()
  private inverse:Matrix4
  constructor(model:Group,private doorBox:()=>Box3,
    private doorBlocks?:(feet:Vec3,radius:number,height:number)=>boolean,private doorRay?:(ray:Ray)=>number|undefined) {
    model.updateMatrixWorld(true);this.inverse=new Matrix4().copy(model.matrixWorld).invert()
    const owners=new Map<Object3D,Box3>()
    model.traverse(o=>{
      if(!(o instanceof Mesh)||under(o,'AftDoorLeaf')||under(o,'ExistingAstronautInPilotSeat')||tag(o,'currentShipPart')==='crew')return
      const type=tag(o,'partType'),module=tag(o,'module')
      if(type==='floor'||module==='floor')this.addMesh(o,true)
      else if(type==='furniture'){
        let owner:Object3D=o;while(owner.parent&&owner.userData.partType!=='furniture')owner=owner.parent
        o.geometry.computeBoundingBox();const b=o.geometry.boundingBox!.clone().applyMatrix4(this.inverse.clone().multiply(o.matrixWorld))
        if(!owners.has(owner))owners.set(owner,new Box3());owners.get(owner)!.union(b)
      }else if(type==='wall'||module==='aft-bulkhead'||skins.has(String(module)))this.addMesh(o,false)
    })
    this.furniture=[...owners.values()]
    owners.forEach((box,owner)=>this.furnitureOwners.set(box,owner.name))
    if(!this.floor.size)throw new Error('Missing actual cabin floor support')
  }
  private addMesh(mesh:Mesh,isFloor:boolean) {
    const p=mesh.geometry.getAttribute('position'),indices=mesh.geometry.index,matrix=this.inverse.clone().multiply(mesh.matrixWorld)
    const count=indices?.count??p.count,a=new Vector3(),b=new Vector3(),c=new Vector3()
    for(let i=0;i<count;i+=3){
      a.fromBufferAttribute(p,indices?indices.getX(i):i).applyMatrix4(matrix)
      b.fromBufferAttribute(p,indices?indices.getX(i+1):i+1).applyMatrix4(matrix)
      c.fromBufferAttribute(p,indices?indices.getX(i+2):i+2).applyMatrix4(matrix)
      const bounds=new Box3().setFromPoints([a,b,c])
      if(isFloor){
        const ux=b.x-a.x,uz=b.z-a.z,vx=c.x-a.x,vz=c.z-a.z,det=ux*vz-uz*vx
        if(Math.abs(det)<1e-10)continue
        this.floorBounds.union(bounds)
        this.insert(this.floor,bounds,{x:a.x,y:a.y,z:a.z,ux,uz,uy:b.y-a.y,vx,vz,vy:c.y-a.y,det})
      }else this.insert(this.walls,bounds,bounds)
    }
  }
  private insert<T>(map:Map<string,T[]>,bounds:Box3,value:T) {
    for(let x=Math.floor(bounds.min.x/.5);x<=Math.floor(bounds.max.x/.5);x++)for(let z=Math.floor(bounds.min.z/.5);z<=Math.floor(bounds.max.z/.5);z++){
      const id=`${x},${z}`;if(!map.has(id))map.set(id,[]);map.get(id)!.push(value)
    }
  }
  private directHeight(x:number,z:number) {
    let result=-Infinity
    for(const t of this.floor.get(key(x,z))??[]){
      const dx=x-t.x,dz=z-t.z,u=(dx*t.vz-dz*t.vx)/t.det,v=(t.ux*dz-t.uz*dx)/t.det
      if(u>=-1e-7&&v>=-1e-7&&u+v<=1+1e-7)result=Math.max(result,t.y+u*t.uy+v*t.vy)
    }
    return Number.isFinite(result)?result:undefined
  }
  floorAt(x:number,z:number) {
    if(x<this.floorBounds.min.x||x>this.floorBounds.max.x||z<this.floorBounds.min.z||z>this.floorBounds.max.z)return undefined
    const exact=this.directHeight(x,z);if(exact!==undefined)return exact
    for(const [dx,dz]of [[.006,0],[-.006,0],[0,.006],[0,-.006]]){const y=this.directHeight(x+dx,z+dz);if(y!==undefined)return y}
    return undefined
  }
  private nearby(x:number,z:number,radius:number) {
    const values=new Set<Box3>()
    for(let xx=Math.floor((x-radius)/.5);xx<=Math.floor((x+radius)/.5);xx++)for(let zz=Math.floor((z-radius)/.5);zz<=Math.floor((z+radius)/.5);zz++)
      for(const b of this.walls.get(`${xx},${zz}`)??[])values.add(b)
    return values
  }
  support(x:number,z:number,radius:number=CABIN_CREW.radius) {
    const y=this.floorAt(x,z);if(y===undefined)return undefined
    for(let i=0;i<8;i++){const angle=i*Math.PI/4;if(this.floorAt(x+Math.cos(angle)*radius,z+Math.sin(angle)*radius)===undefined)return undefined}
    const feet={x,y:y+.015,z}
    for(const b of [...this.furniture,...this.nearby(x,z,radius)])if(crewIntersectsBox(b,feet,radius,CABIN_CREW.height-.015))return undefined
    if(this.doorBlocks?this.doorBlocks(feet,radius,CABIN_CREW.height-.015):crewIntersectsBox(this.doorBox(),feet,radius,CABIN_CREW.height-.015))return undefined
    return y
  }
  lineClear(from:Vector3,to:Vector3) {
    const delta=to.clone().sub(from),length=delta.length(),ray=new Ray(from,delta.normalize()),hit=new Vector3()
    const boxes=new Set([...this.furniture,...this.nearby((from.x+to.x)/2,(from.z+to.z)/2,length/2+.1)])
    for(const b of boxes)if(ray.intersectBox(b,hit)&&hit.distanceTo(from)<length-.025)return false
    return true
  }
  cameraEye(target:Vector3,wanted:Vector3,ignoreOwner?:string) {
    const direction=wanted.clone().sub(target),distance=direction.length(),ray=new Ray(target,direction.normalize()),hit=new Vector3()
    let available=distance
    const boxes=new Set([...this.furniture.filter(b=>!ignoreOwner||this.furnitureOwners.get(b)!==ignoreOwner),...this.nearby((target.x+wanted.x)/2,(target.z+wanted.z)/2,distance/2+.15),...(this.doorRay?[]:[this.doorBox()])])
    for(const box of boxes)if(ray.intersectBox(box.clone().expandByScalar(.06),hit))available=Math.min(available,Math.max(.16,hit.distanceTo(target)-.06))
    const door=this.doorRay?.(ray);if(door!==undefined)available=Math.min(available,Math.max(.16,door-.08))
    return target.clone().addScaledVector(direction,available)
  }
  dispose(){this.floor.clear();this.walls.clear();this.furniture=[];this.furnitureOwners.clear()}
}
