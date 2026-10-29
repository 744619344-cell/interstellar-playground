import { Box3, Matrix4, SkinnedMesh, Vector3, type Group } from 'three'

type Sample={mesh:SkinnedMesh;index:number}
type Side='L'|'R'
const component=(attribute:SkinnedMesh['geometry']['attributes'][string],index:number,axis:number)=>
  axis===0?attribute.getX(index):axis===1?attribute.getY(index):axis===2?attribute.getZ(index):attribute.getW(index)

/** Caches real sole and glove vertices once; getVertexPosition already applies skinning. */
export class CabinRigSamples {
  readonly soles:Sample[]=[]
  private tips:Partial<Record<Side,Sample>>={}
  private scratch=new Vector3()
  constructor(private model:Group,private host:Group) {
    const directions=[new Vector3(0,-1,0)]
    for(let i=0;i<12;i++)for(const down of [.5,2])directions.push(new Vector3(Math.cos(i*Math.PI/6),-down,Math.sin(i*Math.PI/6)))
    const best={L:directions.map(()=>({score:-Infinity,sample:undefined as Sample|undefined})),R:directions.map(()=>({score:-Infinity,sample:undefined as Sample|undefined}))}
    const fingers={L:-Infinity,R:-Infinity},palms={L:-Infinity,R:-Infinity},fallback:Partial<Record<Side,Sample>>={}
    model.traverse(o=>{
      if(!(o instanceof SkinnedMesh))return
      const position=o.geometry.getAttribute('position'),joints=o.geometry.getAttribute('skinIndex'),weights=o.geometry.getAttribute('skinWeight')
      const digit={L:o.skeleton.bones.findIndex(b=>b.name==='index_L'),R:o.skeleton.bones.findIndex(b=>b.name==='index_R')}
      const hand={L:o.skeleton.bones.findIndex(b=>b.name==='hand_L'),R:o.skeleton.bones.findIndex(b=>b.name==='hand_R')}
      for(let index=0;index<position.count;index++){
        const x=position.getX(index),y=position.getY(index),z=position.getZ(index),side:Side=z>=0?'L':'R'
        if(y<.14)for(let i=0;i<directions.length;i++){
          const d=directions[i],score=x*d.x+y*d.y+z*d.z
          if(score>best[side][i].score)best[side][i]={score,sample:{mesh:o,index}}
        }
        if(y<.55||Math.abs(z)<.36)continue
        let fingerWeight=0,handWeight=0
        for(let j=0;j<4;j++){
          const bone=component(joints,index,j),weight=component(weights,index,j)
          if(bone===digit[side])fingerWeight+=weight
          if(bone===hand[side])handWeight+=weight
        }
        const extent=(side==='L'?1:-1)*z
        if(fingerWeight>.2&&extent>fingers[side]){fingers[side]=extent;this.tips[side]={mesh:o,index}}
        if(handWeight>.2&&extent>palms[side]){palms[side]=extent;fallback[side]={mesh:o,index}}
      }
    })
    const used=new Set<string>(),meshes=new Map<SkinnedMesh,number>()
    for(const row of [...best.L,...best.R])if(row.sample){
      if(!meshes.has(row.sample.mesh))meshes.set(row.sample.mesh,meshes.size)
      const id=`${meshes.get(row.sample.mesh)}:${row.sample.index}`
      if(!used.has(id)){used.add(id);this.soles.push(row.sample)}
    }
    this.tips.L??=fallback.L;this.tips.R??=fallback.R
    if(this.soles.length<12||!this.tips.L||!this.tips.R)throw new Error('Existing rig lacks real sole/hand support samples')
  }
  update() {
    // Parent placement must be current, then SkinnedMesh.updateMatrixWorld refreshes attached bind inverses.
    this.model.updateWorldMatrix(true,false);this.model.updateMatrixWorld(true)
    this.model.traverse(o=>{if(o instanceof SkinnedMesh)o.skeleton.update()})
  }
  tip(side:Side,target=new Vector3()) {
    const sample=this.tips[side]!
    sample.mesh.getVertexPosition(sample.index,target);return target.applyMatrix4(sample.mesh.matrixWorld)
  }
  ground(floor:number,actor:Group) {
    const min=this.minimumY()
    const correction=floor+.001-min
    if(!Number.isFinite(correction)||Math.abs(correction)>.18)throw new Error('Astronaut sole correction exceeds supported pose range')
    actor.position.y+=correction;this.update();return {correction,minimumSoleY:min+correction}
  }
  minimumY(side?:Side){
    this.update();const inverse=new Matrix4().copy(this.host.matrixWorld).invert();let min=Infinity
    for(const sample of this.soles){if(side&&(sample.mesh.geometry.getAttribute('position').getZ(sample.index)>=0)!==(side==='L'))continue;sample.mesh.getVertexPosition(sample.index,this.scratch);this.scratch.applyMatrix4(sample.mesh.matrixWorld).applyMatrix4(inverse);min=Math.min(min,this.scratch.y)}
    return min
  }
  /** Full posed envelope, used once when fitting a rest posture to an existing mattress. */
  bounds(){
    this.update();const bounds=new Box3(),inverse=new Matrix4().copy(this.host.matrixWorld).invert()
    this.model.traverse(o=>{if(o instanceof SkinnedMesh){
      const matrix=inverse.clone().multiply(o.matrixWorld),p=o.geometry.getAttribute('position')
      for(let i=0;i<p.count;i++){o.getVertexPosition(i,this.scratch);bounds.expandByPoint(this.scratch.applyMatrix4(matrix))}
    }})
    return bounds
  }
}
