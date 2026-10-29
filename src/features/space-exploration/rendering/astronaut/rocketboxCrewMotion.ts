import { Bone, Group, Quaternion, SkinnedMesh, Vector3 } from 'three'

type Side = 'L' | 'R'
type Finger = { bone: Bone; rest: Quaternion; axis: Vector3; angle: number; side: Side }
const aliases: Record<string, string> = { Bip01: 'root', Bip01_Pelvis: 'pelvis', Bip01_Spine: 'spine',
  Bip01_Spine1: 'spine_01', Bip01_Spine2: 'chest', Bip01_Neck: 'neck', Bip01_Head: 'head' }
for (const side of ['L', 'R']) {
  for (const [source, target] of Object.entries({ Clavicle: 'collar', UpperArm: 'upper_arm', Forearm: 'forearm',
    Hand: 'hand', Thigh: 'thigh', Calf: 'shin', Foot: 'foot', Toe0: 'toe' })) aliases[`Bip01_${side}_${source}`] = `${target}_${side}`
}

/** Drives only the imported joints and original facial morphs. Never changes source geometry/weights. */
export class RocketboxCrewMotion {
  private digits: Finger[] = []
  private faces: SkinnedMesh[] = []
  private initialMorphs = new Map<SkinnedMesh, number[]>()

  static from(actor: Group) {
    let found = false
    actor.traverse(o => { if (o.userData.crewSource === 'microsoft-rocketbox-medical-female-03') found = true })
    return found ? new RocketboxCrewMotion(actor) : undefined
  }

  private constructor(actor: Group) {
    const bones = new Map<string, Bone>()
    actor.updateWorldMatrix(true, true)
    actor.traverse(o => {
      if (o instanceof Bone) {
        const source = String(o.userData.sourceBone ?? o.name); bones.set(source, o)
        o.userData.sourceBone = source; o.name = aliases[source] ?? source
      }
      if (o instanceof SkinnedMesh && o.morphTargetDictionary && o.morphTargetInfluences) {
        this.faces.push(o); this.initialMorphs.set(o, [...o.morphTargetInfluences])
      }
    })
    for (const side of ['L', 'R'] as const) this.captureHand(bones, side, actor)
  }

  private captureHand(bones: Map<string, Bone>, side: Side, actor: Group) {
    const point = (name: string) => bones.get(`Bip01_${side}_${name}`)!.getWorldPosition(new Vector3())
    const wrist = point('Hand'), across = point('Finger4').sub(point('Finger1'))
    const along = point('Finger2').sub(wrist).normalize(), normal = along.clone().cross(across).normalize()
    if (normal.dot(new Vector3(0, 0, 1).applyQuaternion(actor.getWorldQuaternion(new Quaternion()))) < 0) normal.negate()
    for (let digit = 0; digit < 5; digit++) for (let segment = 0; segment < 3; segment++) {
      const bone = bones.get(`Bip01_${side}_Finger${digit}${segment || ''}`)!
      if (!bone) throw Error(`Missing Rocketbox finger ${side}/${digit}/${segment}`)
      const child = bone.children.find(o => o instanceof Bone)
      const direction = child ? child.getWorldPosition(new Vector3()).sub(bone.getWorldPosition(new Vector3())).normalize() : along
      const axis = direction.clone().cross(normal).normalize().applyQuaternion(bone.getWorldQuaternion(new Quaternion()).invert())
      this.digits.push({ bone, axis, side, rest: bone.quaternion.clone(), angle: digit === 0 ? [.42, .6, .45][segment] : [.9, 1.2, .8][segment] })
    }
  }

  private fingerPose(curl: number, side?: Side, blend = 1) {
    for (const digit of this.digits) {
      if (side && digit.side !== side) continue
      const target = digit.rest.clone().multiply(new Quaternion().setFromAxisAngle(digit.axis, digit.angle * curl))
      digit.bone.quaternion.slerp(target, blend)
    }
  }

  pose(time: number, curl: number, rest = 0) {
    this.fingerPose(.08 + curl * .72)
    // Deterministic gentle eye motion and a brief blink; no simultaneous duplicate FACS/viseme channels.
    const settled = Math.max(0, Math.min(1, rest)), phase = time % 4.7, blink = phase < .26 ? Math.sin(phase / .26 * Math.PI) ** 2 : 0
    const lids = settled + (1 - settled) * blink, gaze = Math.sin(time * .31) * .1 * (1 - settled), up = Math.sin(time * .23) * .045 * (1 - settled)
    for (const mesh of this.faces) {
      const set = (name: string, value: number) => { const i = mesh.morphTargetDictionary![name]; if (i !== undefined) mesh.morphTargetInfluences![i] = value }
      set('EyeBlinkLeft', lids); set('EyeBlinkRight', lids)
      set('EyeLookOutLeft', Math.max(0, gaze)); set('EyeLookInRight', Math.max(0, gaze))
      set('EyeLookInLeft', Math.max(0, -gaze)); set('EyeLookOutRight', Math.max(0, -gaze))
      for (const side of ['Left', 'Right']) { set(`EyeLookUp${side}`, Math.max(0, up)); set(`EyeLookDown${side}`, Math.max(0, -up)) }
    }
  }

  grasp(side: Side) { this.fingerPose(.65, side, .2) }
  support(name: string) {
    if (/Bip01_[LR]_Finger/.test(name)) return name.includes('_L_') ? 'hand_L' : 'hand_R'
    if (/^Bip01_[LRM]/.test(name) && !name.includes('_L_') && !name.includes('_R_')) return 'head'
    return name
  }
  dispose() { for (const [mesh, values] of this.initialMorphs) mesh.morphTargetInfluences = [...values]; this.initialMorphs.clear(); this.faces = []; this.digits = [] }
}
