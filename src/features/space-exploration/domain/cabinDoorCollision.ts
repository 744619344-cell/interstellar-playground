export interface CabinPoint {x:number;z:number}
const cross=(o:CabinPoint,a:CabinPoint,b:CabinPoint)=>(a.x-o.x)*(b.z-o.z)-(a.z-o.z)*(b.x-o.x)

/** CPU footprint of the transformed source bounds, never a renderable collider. */
export function cabinConvexHull(points:readonly CabinPoint[]):CabinPoint[]{
 const sorted=[...points].sort((a,b)=>a.x-b.x||a.z-b.z)
 const unique=sorted.filter((p,i)=>!i||p.x!==sorted[i-1].x||p.z!==sorted[i-1].z)
 if(unique.length<3)return unique
 const half=(values:CabinPoint[])=>{const row:CabinPoint[]=[];for(const p of values){while(row.length>1&&cross(row[row.length-2],row[row.length-1],p)<=1e-12)row.pop();row.push(p)}return row}
 return [...half(unique).slice(0,-1),...half([...unique].reverse()).slice(0,-1)]
}

export function cabinCircleHitsPolygon(point:CabinPoint,radius:number,polygon:readonly CabinPoint[]){
 if(polygon.length<3)return false
 let inside=true
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length]
  if(cross(a,b,point)<0)inside=false
  const dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz
  const t=length?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/length)):0
  if((point.x-a.x-t*dx)**2+(point.z-a.z-t*dz)**2<(radius+.006)**2)return true
 }
 return inside
}
