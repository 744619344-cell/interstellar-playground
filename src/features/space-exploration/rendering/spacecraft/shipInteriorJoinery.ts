import { Box3, Color, DoubleSide, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Quaternion, Shape, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { addShipInteriorTransitions } from './shipInteriorTransitions'
import { addShipWindowReveal } from './shipWindowReveal'

type Point = [number, number, number]
const up = new Vector3(0, 0, 1)

/** Small chamfered mechanical sections, leaving the original generated panels and their details exposed. */
function section(width: number, height: number, depth: number) {
  const w = width / 2, h = height / 2, r = Math.min(.014, width * .15, height * .15)
  const shape = new Shape()
  const points = [[-w+r,-h],[w-r,-h],[w,-h+r],[w,h-r],[w-r,h],[-w+r,h],[-w,h-r],[-w,-h+r]]
  shape.moveTo(...points[0] as [number,number]); points.slice(1).forEach(p => shape.lineTo(p[0],p[1])); shape.closePath()
  const bevel = Math.min(.004, width*.08, height*.08, depth*.2)
  const geometry = new ExtrudeGeometry(shape,{ depth, steps:1, curveSegments:1,
    bevelEnabled:true, bevelSegments:1, bevelSize:bevel, bevelThickness:bevel })
  geometry.translate(0,0,-depth/2)
  return geometry
}

/** The model remains the sole resource owner, including all joinery materials and geometry. */
export function addShipInteriorJoinery(model: Group) {
  if (!model.getObjectByName('Ship_Adapted') || model.getObjectByName('Interior_Joinery')) return
  const root = new Group(); root.name = 'Interior_Joinery'; model.add(root)
  const coat = new MeshStandardMaterial({ color: new Color(.68,.655,.59),metalness:.08,roughness:.72,side:DoubleSide })
  const alloy = new MeshStandardMaterial({ color: new Color(.085,.095,.10),metalness:.25,roughness:.68 })
  const panel = (name:string, zone:string, size:Point, at:Point, material=alloy, rotation?:Quaternion) => {
    const mesh = new Mesh(section(...size),material); mesh.name=name; mesh.position.fromArray(at)
    if (rotation) mesh.quaternion.copy(rotation)
    mesh.userData={ module:'interior-joinery',label:name,zone,enclosure:true,cutaway:true }
    mesh.userData.connects = name.includes('踏板') ? ['pedals','cockpit-floor']
      : name.includes('操控杆') ? ['joystick','mounting-fixture','cockpit-floor']
      : name.includes('床') ? ['folding-berth','rear-cabin-wall']
      : name.includes('隔舱') ? ['airlock-door-frame','pressure-bulkhead','airlock-wall']
      : ['front-window-frame','window-liner']
    root.add(mesh); return mesh
  }
  const rail = (name:string,zone:string,a:Point,b:Point,width=.055,height=.065,material=alloy) => {
    const start=new Vector3(...a),end=new Vector3(...b),axis=end.clone().sub(start)
    return panel(name,zone,[width,height,axis.length()],start.add(end).multiplyScalar(.5).toArray() as Point,
      material,new Quaternion().setFromUnitVectors(up,axis.normalize()))
  }
  addShipInteriorTransitions(model,root,coat)
  bulkheadCassettes(model,panel,coat)
  installationFeet(model,panel)
  windowSeals(model,rail)
  addShipWindowReveal(model,root,coat,alloy)
  batchJoinery(root)
}

/** Batch static sections per zone/coating so natural edges do not add a draw call per tiny segment. */
function batchJoinery(root:Group) {
  const batches = new Map<string,Mesh[]>()
  for(const child of [...root.children]) if(child instanceof Mesh) {
    const key=`${child.userData.zone}/${child.material.id}`
    const batch=batches.get(key) ?? []; batch.push(child); batches.set(key,batch)
  }
  for(const [key,parts] of batches) {
    const geometry=mergeGeometries(parts.map(part=>{part.updateMatrix();return part.geometry.applyMatrix4(part.matrix)}))!
    const mesh=new Mesh(geometry,parts[0].material); mesh.name=`Joinery_${key}`
    mesh.userData={...parts[0].userData,label:`${parts[0].userData.zone}装配收口`,sections:parts.map(p=>p.name),
      connects:[...new Set(parts.flatMap(p=>p.userData.connects ?? []))]}
    parts.forEach(part=>{part.geometry.dispose();part.removeFromParent()});root.add(mesh)
  }
}

type Panel = (name:string,zone:string,size:Point,at:Point,material?:MeshStandardMaterial,rotation?:Quaternion) => Mesh
type Rail = (name:string,zone:string,a:Point,b:Point,width?:number,height?:number,material?:MeshStandardMaterial) => Mesh

function bulkheadCassettes(model:Group,panel:Panel,coat:MeshStandardMaterial) {
  model.traverse(o => {
    if (o instanceof Mesh && o.userData.label==='气闸门框侧接板') {
      o.userData.supersededByJoinery=true; o.visible=false
    }
    if(o instanceof Mesh && o.userData.module==='pressure-bulkhead') {
      const m=o.material as MeshStandardMaterial
      m.color.copy(coat.color);m.metalness=coat.metalness;m.roughness=coat.roughness
    }
  })
  for (const z of [4.92,7.20]) for (const s of [-1,1]) for (let i=0;i<3;i++)
    panel(`隔舱侧检修嵌板${z}/${s}/${i}`,'气闸',[.66,.862,.024],[s*1.44,-1.13+i*.867,z],coat)
}

function installationFeet(model:Group,panel:Panel) {
  const boxes = new Map<string,Box3>()
  model.updateMatrixWorld(true)
  model.traverse(o => {
    if (!(o instanceof Mesh) || !['pedals','folding-berth'].includes(o.userData.module)) return
    const box=boxes.get(o.userData.label) ?? new Box3(); box.union(new Box3().setFromObject(o)); boxes.set(o.userData.label,box)
  })
  const flat = new Quaternion().setFromAxisAngle(new Vector3(1,0,0),Math.PI/2)
  for (const [label,box] of boxes) {
    const c=box.getCenter(new Vector3())
    if (label.includes('踏板')) for (const s of [-1,1])
      panel(`${label}地板支承${s}`,'驾驶区',[.065,.36,.095],[c.x+s*.175,-1.549,c.z],undefined,flat)
    else for (const z of [box.min.z+.22,box.max.z-.22])
      panel(`${label}墙面安装座${z}`,'后舱',[.055,.15,.18],[-1.768,-1.12,z])
  }
  for (const s of [-1,1]) panel(`操控杆底部法兰${s}`,'驾驶区',[.21,.18,.04],
    [s*1.27,-1.581,-4.55],undefined,flat)
}

function windowSeals(model:Group,rail:Rail) {
  const sources:Mesh[]=[]
  model.traverse(o => {if(o instanceof Mesh && o.userData.module==='window-liner') sources.push(o)})
  for (const mesh of sources) {
    const position=mesh.geometry.getAttribute('position'), points=new Map<string,Vector3>(),rear=new Map<string,Vector3>()
    for (let i=0;i<position.count;i++) {
      const p=new Vector3().fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld)
      const key=p.toArray().map(v=>v.toFixed(5)).join(',')
      if(p.z< -5.92) points.set(key,p);else rear.set(key,p)
    }
    const vertical=mesh.name.includes('衬板2')||mesh.name.includes('衬板3')
    const sort=(a:Vector3,b:Vector3)=>vertical?a.y-b.y:a.x-b.x
    const edge=[...points.values()].sort(sort),back=[...rear.values()].sort(sort)
    for(let i=0;i<edge.length-1;i++) rail(`舷窗密封收口${mesh.name}/${i}`,'驾驶区',
      edge[i].toArray() as Point,edge[i+1].toArray() as Point,.012,.016)
    if(back.length!==edge.length) continue
    // The rear rim is already fitted to the slabs; follow its actual contour with a fine gasket.
    // A generic portal here protruded into the view and cut across the sloping window reveal.
    for(let i=0;i<back.length-1;i++) rail(`窗台后缘贴合密封${mesh.name}/${i}`,'驾驶区',
      back[i].toArray() as Point,back[i+1].toArray() as Point,.008,.008)
  }
}
