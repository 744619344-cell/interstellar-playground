import { BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three'

interface Reveal { source: Mesh; front: Vector3[]; back: Vector3[]; normal: Vector3 }
const roofSlope = .85 / 3.3

function revealEdges(model: Group, mesh: Mesh): Reveal | undefined {
  const transform = new Matrix4().copy(model.matrixWorld).invert().multiply(mesh.matrixWorld)
  const positions = mesh.geometry.getAttribute('position'), unique = new Map<string, Vector3>()
  for (let i = 0; i < positions.count; i++) {
    const p = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(transform)
    if (!p.toArray().every(Number.isFinite)) return
    unique.set(p.toArray().map(n => n.toFixed(5)).join(','), p)
  }
  const all = [...unique.values()], rearZ = Math.max(...all.map(p => p.z))
  const back = all.filter(p => Math.abs(p.z - rearZ) < .001), front = all.filter(p => p.z < rearZ - .001)
  if (back.length !== 17 || front.length !== 17) return
  const vertical = Math.abs(back[0].x - back[1].x) < .001
  const sort = (a: Vector3, b: Vector3) => vertical ? a.y - b.y : a.x - b.x
  front.sort(sort); back.sort(sort)
  const normal = vertical ? new Vector3(-Math.sign(back[0].x), 0, 0)
    : back[0].y < -1 ? new Vector3(0, 1, 0) : new Vector3(0, -1, roofSlope).normalize()
  return { source: mesh, front, back, normal }
}

/** An 80mm tangent bend returns to the original ruled surface before reaching the real window frame. */
export function shipWindowRevealPoint(back: Vector3, front: Vector3, station: number) {
  const delta = front.clone().sub(back), bend = Math.min(.3, .08 / Math.abs(delta.z))
  if (station > 8) return back.clone().addScaledVector(delta, bend + (station - 8) / 10 * (1 - bend))
  const t = station / 8, end = back.clone().addScaledVector(delta, bend)
  // Shared corner derivatives keep adjacent reveals joined; rear side tangents stay in the wall plane.
  const slope = roofSlope * Math.max(0, Math.min(1, (back.y + 1.6) / 1.87))
  const incoming = new Vector3(0, delta.z * slope, delta.z).multiplyScalar(bend)
  const outgoing = delta.clone().multiplyScalar(bend)
  return back.clone().multiplyScalar(2*t**3 - 3*t*t + 1)
    .addScaledVector(incoming, t**3 - 2*t*t + t)
    .addScaledVector(end, -2*t**3 + 3*t*t).addScaledVector(outgoing, t**3 - t*t)
}

function revealGeometry({ front, back, normal }: Reveal) {
  const positions: number[] = [], indices: number[] = [], uv: number[] = []
  const columns=front.length
  for (let i = 0; i <= 18; i++) for (let j = 0; j < columns; j++) {
    positions.push(...shipWindowRevealPoint(back[j], front[j], i).toArray()); uv.push(i/18, j/(columns-1))
  }
  for (let i = 0; i < 18; i++) for (let j = 0; j < columns-1; j++) {
    const a = i*columns+j, b = a+columns; indices.push(a,b,a+1,a+1,b,b+1)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions,3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uv,2)); geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const n = geometry.getAttribute('normal')
  if (new Vector3().fromBufferAttribute(n,0).dot(normal) < 0) {
    for (let i=0;i<indices.length;i+=3) [indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]]
    geometry.setIndex(indices); geometry.computeVertexNormals()
  }
  const normals = geometry.getAttribute('normal')
  for(let j=0;j<columns;j++) normals.setXYZ(j,normal.x,normal.y,normal.z)
  const expanded = geometry.toNonIndexed(); geometry.dispose(); return expanded
}

function revealSeam(reveal: Reveal, index: number) {
  const edge=(points:Vector3[])=>{
    const tangent=points[index+1].clone().sub(points[index-1]).normalize().multiplyScalar(.0015)
    return [points[index].clone().sub(tangent),points[index].clone().add(tangent)]
  }
  const geometry=revealGeometry({...reveal,front:edge(reveal.front),back:edge(reveal.back)})
  const positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal')
  for(let i=0;i<positions.count;i++) {
    const p=new Vector3().fromBufferAttribute(positions,i).addScaledVector(new Vector3().fromBufferAttribute(normals,i),.0008)
    positions.setXYZ(i,p.x,p.y,p.z)
  }
  return geometry
}

/** Derived covers preserve the source owner and every frame/room edge, including adjoining corners. */
export function addShipWindowReveal(model: Group, root: Group, coat: MeshStandardMaterial, alloy: MeshStandardMaterial) {
  model.updateMatrixWorld(true)
  const meshes: Mesh[] = []; model.traverse(o => { if(o instanceof Mesh && o.userData.module==='window-liner') meshes.push(o) })
  const reveals=meshes.map(mesh=>revealEdges(model,mesh))
  if(reveals.length!==4 || reveals.some(r=>!r)) return
  for(const reveal of reveals as Reveal[]) {
    const mesh=new Mesh(revealGeometry(reveal),coat);mesh.name=`窗台连续转向${reveal.source.name}`
    mesh.userData={module:'interior-joinery',label:mesh.name,zone:'驾驶区',enclosure:true,cutaway:true,
      connects:['window-liner','front-window-frame','cockpit-sidewall','cockpit-floor','cockpit-ceiling']}
    root.add(mesh);reveal.source.userData.supersededByJoinery=true;reveal.source.visible=false
    for(const i of [5,11]) {
      const seam=new Mesh(revealSeam(reveal,i),alloy);seam.name=`窗台分段接缝${reveal.source.name}/${i}`
      seam.userData={...mesh.userData,label:seam.name};root.add(seam)
    }
  }
}
