import type { Vec3 } from '../../domain/vec3'
import { horizontalDistance } from '../../domain/cabinProximity'

type Support=(x:number,z:number)=>number|undefined

export function cabinSegmentClear(from:Vec3,to:Vec3,support:Support){
 const count=Math.max(1,Math.ceil(horizontalDistance(from,to)/.045));let previous=from.y
 for(let i=1;i<=count;i++){
  const t=i/count,y=support(from.x+(to.x-from.x)*t,from.z+(to.z-from.z)*t)
  if(y===undefined||Math.abs(y-previous)>.075)return false
  previous=y
 }
 return true
}

/** Bounded local A* aligns a nearby user with equipment while staying on the actual floor. */
export function cabinApproachPath(start:Vec3,goal:Vec3,support:Support):Vec3[]|undefined {
 const y=support(goal.x,goal.z)
 if(y===undefined||horizontalDistance(start,goal)>2.4)return undefined
 const end={...goal,y}
 if(cabinSegmentClear(start,end,support))return [end]
 // Align to exact aisle coordinates before grid search; a narrow aisle can fall between grid columns.
 for(const corner of [{x:end.x,z:start.z},{x:start.x,z:end.z}]){
  const floor=support(corner.x,corner.z);if(floor===undefined)continue
  const via={...corner,y:floor}
  if(cabinSegmentClear(start,via,support)&&cabinSegmentClear(via,end,support))return [via,end]
 }
 type Node={x:number;z:number;p:Vec3;g:number;f:number;parent?:Node}
 const first:Node={x:0,z:0,p:{...start},g:0,f:horizontalDistance(start,end)}
 const open=[first],best=new Map<string,number>([['0,0',0]])
 const directions=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]
 for(let visited=0;open.length&&visited<1600;visited++){
  open.sort((a,b)=>a.f-b.f);const node=open.shift()!
  if(horizontalDistance(node.p,end)<.16&&cabinSegmentClear(node.p,end,support)){
   const path=[end];for(let n:Node|undefined=node;n?.parent;n=n.parent)path.unshift(n.p)
   const short:Vec3[]=[];let anchor=start
   for(let i=0;i<path.length;){let j=path.length-1;while(j>i&&!cabinSegmentClear(anchor,path[j],support))j--;short.push(path[j]);anchor=path[j];i=j+1}
   return short
  }
  for(const [dx,dz]of directions){
   const x=node.x+dx,z=node.z+dz;if(Math.abs(x)>22||Math.abs(z)>22)continue
   const id=`${x},${z}`,g=node.g+Math.hypot(dx,dz)*.1;if((best.get(id)??Infinity)<=g)continue
   const px=start.x+x*.1,pz=start.z+z*.1,py=support(px,pz);if(py===undefined)continue
   const p={x:px,y:py,z:pz};if(!cabinSegmentClear(node.p,p,support))continue
   best.set(id,g);open.push({x,z,p,g,f:g+horizontalDistance(p,end),parent:node})
  }
 }
 return undefined
}
