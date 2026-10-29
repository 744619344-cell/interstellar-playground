import { Box3, Color, Matrix4, Mesh, MeshStandardMaterial, Object3D, Ray, Raycaster, Vector2, Vector3, type Camera, type Group } from 'three'
import { cabinDoorAngle, cabinDoorPull, type CabinDoorState } from '../../domain/cabinCrewMotion'
import type { Vec3 } from '../../domain/vec3'
import { cabinCircleHitsPolygon,cabinConvexHull } from '../../domain/cabinDoorCollision'

export function crewIntersectsBox(box: Box3, feet: Vec3, radius: number, height: number) {
  if (feet.y+height<=box.min.y || feet.y+.035>=box.max.y) return false
  const dx = Math.max(box.min.x-feet.x,0,feet.x-box.max.x), dz = Math.max(box.min.z-feet.z,0,feet.z-box.max.z)
  return dx*dx+dz*dz<(radius+.008)**2
}

/** Animates only the newly authorized existing door nodes; asset owner releases their resources. */
export class CurrentAftDoor {
  private hinge: Object3D
  private cap: Object3D
  private restPosition: Vector3
  private pull: number
  private restHinge: Matrix4
  private boxes: { box: Box3; matrix: Matrix4 }[] = []
  private point = new Vector3()
  private direction = new Vector3()
  private restCap: Vector3
  private pressTravel: number
  private indicator?: MeshStandardMaterial
  private originalLight?: { color: Color; emissive: Color }
  private raycaster = new Raycaster()
  private targets = new Set<Object3D>()

  constructor(private model: Group) {
    const root = model.getObjectByName('InteractiveAftBulkhead'), hinge = model.getObjectByName('AftDoorHinge')
    const leaf = model.getObjectByName('AftDoorLeaf'), cap = model.getObjectByName('AftDoorButtonCap'), anchor = model.getObjectByName('Anchor_DoorInner')
    if (!root || !hinge || !leaf || !cap || !anchor) throw new Error('Missing interactive aft door nodes')
    this.hinge=hinge;this.cap=cap;this.restCap=cap.position.clone();this.restPosition=hinge.position.clone()
    hinge.userData.microClosedPosition = this.restPosition.toArray(); hinge.userData.microClosedRotation = hinge.quaternion.toArray()
    this.pull=Number(root.userData.pullInSource)
    if (!(this.pull>0 && this.pull<.1)) throw new Error('Invalid door plug clearance')
    this.pressTravel=Number(root.userData.buttonPressTravelSource)
    if (!(this.pressTravel>0 && this.pressTravel<.01)) throw new Error('Invalid door button travel')
    model.updateMatrixWorld(true)
    const inverse = new Matrix4().copy(model.matrixWorld).invert(), hingeInverse = new Matrix4().copy(hinge.matrixWorld).invert()
    this.restHinge=inverse.clone().multiply(hinge.matrixWorld)
    leaf.traverse(object=>{
      if (!(object instanceof Mesh)) return
      object.geometry.computeBoundingBox()
      this.boxes.push({box:object.geometry.boundingBox!.clone(),matrix:hingeInverse.clone().multiply(object.matrixWorld)})
    })
    this.point.copy(anchor.getWorldPosition(new Vector3())).applyMatrix4(inverse)
    this.direction.set(0,0,1).transformDirection(inverse.clone().multiply(cap.parent!.matrixWorld))
    for (const name of ['AftDoorButtonBase','AftDoorButtonCap','AftDoorButtonIndicator']) model.getObjectByName(name)?.traverse(o=>this.targets.add(o))
    model.getObjectByName('AftDoorButtonIndicator')?.traverse(o=>{
      if (o instanceof Mesh && o.material instanceof MeshStandardMaterial) this.indicator=o.material
    })
    if (this.indicator) this.originalLight={color:this.indicator.color.clone(),emissive:this.indicator.emissive.clone()}
  }

  buttonPoint(pressed=0) { return this.point.clone().addScaledVector(this.direction,.003*pressed) }
  standPoint(){return this.point.clone().addScaledVector(this.direction,-.45).addScaledVector(new Vector3(this.direction.z,0,-this.direction.x),-.31)}
  facingAngle(){return Math.atan2(-this.direction.x,-this.direction.z)}
  private transform(progress:number){return this.restHinge.clone().multiply(new Matrix4().makeTranslation(0,0,-this.pull*cabinDoorPull(progress)))
    .multiply(new Matrix4().makeRotationY(cabinDoorAngle(progress)))}
  bounds(progress: number) {
    const box=new Box3(),rotation=new Matrix4().makeTranslation(0,0,-this.pull*cabinDoorPull(progress))
      .multiply(new Matrix4().makeRotationY(cabinDoorAngle(progress)))
    for (const part of this.boxes) box.union(part.box.clone().applyMatrix4(this.restHinge.clone().multiply(rotation).multiply(part.matrix)))
    return box
  }
  sweep(from: number,to: number) {
    const box=new Box3()
    for (let i=0;i<=4;i++) box.union(this.bounds(from+(to-from)*i/4))
    return box
  }
  intersects(progress:number,feet:Vec3,radius:number,height:number){
    const bounds=this.bounds(progress)
    if(feet.y+height<=bounds.min.y||feet.y+.035>=bounds.max.y)return false
    const points:Vector3[]=[]
    for(const part of this.boxes){
      const matrix=this.transform(progress).multiply(part.matrix)
      for(const x of [part.box.min.x,part.box.max.x])for(const y of [part.box.min.y,part.box.max.y])for(const z of [part.box.min.z,part.box.max.z])
        points.push(new Vector3(x,y,z).applyMatrix4(matrix))
    }
    return cabinCircleHitsPolygon(feet,radius,cabinConvexHull(points))
  }
  blocks(from:number,to:number,feet:Vec3,radius:number,height:number){
    for(let i=0;i<=6;i++)if(this.intersects(from+(to-from)*i/6,feet,radius,height))return true
    return false
  }
  rayDistance(progress:number,ray:Ray){
    let distance=Infinity
    for(const part of this.boxes){
      const matrix=this.transform(progress).multiply(part.matrix),local=ray.clone().applyMatrix4(matrix.clone().invert())
      const hit=local.intersectBox(part.box.clone().expandByScalar(.006),new Vector3())
      if(hit)distance=Math.min(distance,hit.applyMatrix4(matrix).distanceTo(ray.origin))
    }
    return Number.isFinite(distance)?distance:undefined
  }
  apply(state: CabinDoorState,pressed: number) {
    this.hinge.position.copy(this.restPosition);this.hinge.position.z-=this.pull*cabinDoorPull(state.progress)
    this.hinge.rotation.y=cabinDoorAngle(state.progress)
    this.cap.position.copy(this.restCap);this.cap.position.z+=this.pressTravel*pressed
    if (this.indicator) {
      const color=state.blocked?0xff9c36:state.target?0x76e7af:0x43cbe4
      this.indicator.color.setHex(color);this.indicator.emissive.setHex(color).multiplyScalar(.55)
    }
  }
  hit(camera: Camera,x: number,y: number,width: number,height: number) {
    if (!(width>0 && height>0)) return false
    this.model.updateMatrixWorld(true);this.raycaster.setFromCamera(new Vector2(x/width*2-1,1-y/height*2),camera)
    const candidates: Mesh[]=[]
    this.model.traverse(o=>{if(o instanceof Mesh && this.visible(o) && !this.isCrew(o))candidates.push(o)})
    const first=this.raycaster.intersectObjects(candidates,false)[0]
    return !!first && this.targets.has(first.object)
  }
  private visible(o: Object3D) { for(let p: Object3D|null=o;p;p=p.parent)if(!p.visible)return false;return true }
  private isCrew(o: Object3D) { for(let p: Object3D|null=o;p;p=p.parent)if(p.userData.currentShipPart==='crew'||p.name==='ExistingAstronautInPilotSeat')return true;return false }
  dispose() {
    this.hinge.rotation.y=0;this.hinge.position.copy(this.restPosition);this.cap.position.copy(this.restCap)
    if(this.indicator&&this.originalLight){this.indicator.color.copy(this.originalLight.color);this.indicator.emissive.copy(this.originalLight.emissive)}
    this.targets.clear();this.boxes=[]
  }
}
