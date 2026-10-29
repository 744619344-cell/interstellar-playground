import { Bone, Box3, Group, Matrix4, Quaternion, SkinnedMesh, Vector3 } from 'three'
import { VolumePreservingSkin } from './volumePreservingSkin'
import { RocketboxCrewMotion } from './rocketboxCrewMotion'
import { CrewFloatResponse } from './crewFloatResponse'
import { SeatClearancePose } from './seatClearancePose'

type Side = 'L' | 'R'
type Sample = { mesh: SkinnedMesh; index: number }
const axis = (a: { getX(i: number): number; getY(i: number): number; getZ(i: number): number; getW(i: number): number }, i: number, k: number) =>
  k === 0 ? a.getX(i) : k === 1 ? a.getY(i) : k === 2 ? a.getZ(i) : a.getW(i)
const ease = (v: number) => { const t = Math.max(0, Math.min(1, v)); return t * t * t * (10 + t * (-15 + 6 * t)) }
function thinAxis(points: Vector3[], longest = false) {
  const center = points.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(points.length), a = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
  for (const point of points) { const d = point.clone().sub(center).toArray(); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) a[i][j] += d[i] * d[j] }
  for (let n = 0; n < 18; n++) {
    let p = 0, q = 1; for (const [i, j] of [[0, 2], [1, 2]]) if (Math.abs(a[i][j]) > Math.abs(a[p][q])) { p = i; q = j }
    if (Math.abs(a[p][q]) < 1e-12) break
    const angle = Math.atan2(2 * a[p][q], a[q][q] - a[p][p]) / 2, c = Math.cos(angle), s = Math.sin(angle), pp = a[p][p], qq = a[q][q], pq = a[p][q]
    for (let k = 0; k < 3; k++) if (k !== p && k !== q) { const kp = a[k][p], kq = a[k][q]; a[k][p] = a[p][k] = c * kp - s * kq; a[k][q] = a[q][k] = s * kp + c * kq }
    a[p][p] = c * c * pp - 2 * s * c * pq + s * s * qq; a[q][q] = s * s * pp + 2 * s * c * pq + c * c * qq; a[p][q] = a[q][p] = 0
    for (let k = 0; k < 3; k++) { const kp = v[k][p], kq = v[k][q]; v[k][p] = c * kp - s * kq; v[k][q] = s * kp + c * kq }
  }
  const index = [0, 1, 2].sort((i, j) => a[i][i] - a[j][j])[longest ? 2 : 0]
  return new Vector3(v[0][index], v[1][index], v[2][index]).normalize()
}

/** Axis-independent pose/IK adapter over the actual authorized skins. No proxy body geometry. */
export class MicrogravityCrewRig {
  private bones = new Map<string, Bone>()
  private rest: { bone: Bone; position: Vector3; rotation: Quaternion }[] = []
  private before = new Map<Bone, Quaternion>()
  private samples: Sample[] = []
  private palms = new Map<Side, Sample>()
  private handSamples = new Map<Side, Sample[]>()
  private palmAxes = new Map<Side, Vector3>()
  private fingerAxes = new Map<Side, Vector3>()
  private contactSamples = new Map<Side, Sample[]>()
  private handRadii = new Map<Side, number>()
  private harnessSamples = new Map<Side, Sample>()
  private sign = new Map<Side, number>()
  private meshes: SkinnedMesh[] = []
  private time = 0
  private waveTime?: number
  private curl = 0
  private volume?: VolumePreservingSkin
  private sourceMotion?: RocketboxCrewMotion
  private travel = new CrewFloatResponse()
  private seatClearance = new SeatClearancePose()

  constructor(readonly actor: Group, private host: Group, preserveVolume = false,
    private alignedSleep = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('sleepPose') === 'v2') {
    this.sourceMotion = RocketboxCrewMotion.from(actor)
    actor.traverse(o => {
      if (o instanceof Bone) { this.bones.set(o.name, o); this.rest.push({ bone: o, position: o.position.clone(), rotation: o.quaternion.clone() }) }
      if (o instanceof SkinnedMesh) this.meshes.push(o)
    })
    if (this.sourceMotion) this.meshes = this.meshes.filter((mesh, i, all) => !all.slice(0, i).some(previous =>
      previous.geometry.getAttribute('position') === mesh.geometry.getAttribute('position') &&
      previous.skeleton.bones[0] === mesh.skeleton.bones[0] && previous.bindMatrix.equals(mesh.bindMatrix)))
    this.update()
    if (preserveVolume && !this.sourceMotion) this.volume = new VolumePreservingSkin(this.meshes, .8)
    for (const side of ['L', 'R'] as const) this.sign.set(side, Math.sign(actor.worldToLocal(this.bone(`upper_arm_${side}`).getWorldPosition(new Vector3())).x) || 1)
    this.selectSamples()
  }

  private bone(name: string) { const b = this.bones.get(name); if (!b) throw Error(`Missing crew bone ${name}`); return b }
  update() { this.actor.updateWorldMatrix(true, true); this.actor.updateMatrixWorld(true); this.meshes.forEach(m => m.skeleton.update()); this.volume?.update() }
  private point(s: Sample) { return this.host.worldToLocal(s.mesh.getVertexPosition(s.index, new Vector3()).applyMatrix4(s.mesh.matrixWorld)) }
  private selectSamples() {
    const directions = [new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)]
    const harnessScores = { L: Infinity, R: Infinity }
    const harnessGoals = { L: this.actor.localToWorld(new Vector3(-.21, -.12, 0)), R: this.actor.localToWorld(new Vector3(.21, -.12, 0)) }
    for (const mesh of this.meshes) {
      const p = mesh.geometry.getAttribute('position'), joints = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight')
      const best = new Map<number | string, { score: number; sample: Sample }[]>(), hands: Record<Side, Sample[]> = { L: [], R: [] }
      for (let i = 0; i < p.count; i++) {
        let winner = 0; for (let k = 1; k < 4; k++) if (axis(weights, i, k) > axis(weights, i, winner)) winner = k
        const joint = axis(joints, i, winner), name = mesh.skeleton.bones[joint]?.name, point = mesh.getVertexPosition(i, new Vector3()).applyMatrix4(mesh.matrixWorld)
        if (name && /pelvis|spine|chest/i.test(name)) for (const side of ['L', 'R'] as const) {
          const score = point.distanceToSquared(harnessGoals[side]); if (score < harnessScores[side]) { harnessScores[side] = score; this.harnessSamples.set(side, { mesh, index: i }) }
        }
        const support = this.sourceMotion?.support(name ?? '') ?? joint
        let row = best.get(support); if (!row) { row = directions.map(() => ({ score: -Infinity, sample: { mesh, index: i } })); best.set(support, row) }
        directions.forEach((d, k) => { const score = point.dot(d); if (score > row![k].score) row![k] = { score, sample: { mesh, index: i } } })
        for (const side of ['L', 'R'] as const) if (name === `hand_${side}`) hands[side].push({ mesh, index: i })
      }
      for (const row of best.values()) for (const item of row) if (!this.samples.some(s => s.mesh === item.sample.mesh && s.index === item.sample.index)) this.samples.push(item.sample)
      for (const side of ['L', 'R'] as const) if (hands[side].length) {
        this.handSamples.set(side, hands[side])
        const hand = this.bone(`hand_${side}`)
        const local = hands[side].map(s => hand.worldToLocal(this.host.localToWorld(this.point(s)))), long = thinAxis(local, true), middle = local.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(local.length)
        if (long.dot(middle) < 0) long.negate()
        this.palmAxes.set(side, thinAxis(local)); this.fingerAxes.set(side, long)
        const extent = local.map(p => p.dot(long)), low = Math.min(...extent), high = Math.max(...extent)
        this.contactSamples.set(side, hands[side].filter((_, i) => extent[i] >= low + (high - low) * .5))
        const wrist = this.host.worldToLocal(hand.getWorldPosition(new Vector3()))
        this.handRadii.set(side, Math.max(...hands[side].map(s => this.point(s).distanceTo(wrist))))
        const center = hands[side].reduce((sum, s) => sum.add(this.point(s)), new Vector3()).divideScalar(hands[side].length)
        hands[side].sort((a, b) => this.point(a).distanceToSquared(center) - this.point(b).distanceToSquared(center))
        this.palms.set(side, hands[side][0])
      }
    }
    if (this.samples.length < 40 || this.palms.size !== 2) throw Error('Missing actual crew support samples')
  }

  private rotate(bone: Bone, child: Bone, target: Vector3) {
    this.rotatePoint(bone, child.getWorldPosition(new Vector3()), target)
  }
  private rotatePoint(bone: Bone, endpoint: Vector3, target: Vector3) {
    this.update()
    const start = bone.getWorldPosition(new Vector3()), from = endpoint.clone().sub(start).normalize(), to = target.clone().sub(start).normalize()
    const delta = new Quaternion().setFromUnitVectors(from, to), world = bone.getWorldQuaternion(new Quaternion()), parent = bone.parent!.getWorldQuaternion(new Quaternion())
    bone.quaternion.copy(parent.invert().multiply(delta).multiply(world)); this.update()
  }
  private direct(name: string, child: string, direction: number[]) {
    const bone = this.bone(name), aim = new Vector3(...direction).applyQuaternion(this.actor.getWorldQuaternion(new Quaternion()))
    this.rotate(bone, this.bone(child), bone.getWorldPosition(new Vector3()).add(aim))
  }

  wave() { this.waveTime = 0 }
  fingers(curl: boolean) { this.curl = Number(curl) }
  cancel() { this.waveTime = undefined }
  locomotion(velocity: Vector3, spin: number, enabled: boolean) {
    this.travel.set(velocity.clone().applyQuaternion(this.actor.quaternion.clone().invert()), spin, enabled)
  }
  beginSeatClearance() { this.seatClearance.begin() }
  endSeatClearance() { this.seatClearance.cancel() }
  get seatClearanceReady() { return this.seatClearance.ready }
  pose(seconds: number, mode: 'float' | 'seat' | 'sleep' = 'float', amount = 1) {
    if (this.seatClearance.active && mode === 'float') {
      this.before.clear(); this.rest.forEach(s => this.before.set(s.bone, s.bone.quaternion.clone()))
      this.seatClearance.step(seconds, this.bones); this.update(); return
    }
    this.travel.step(seconds)
    this.time += seconds; this.before.clear(); this.rest.forEach(s => { this.before.set(s.bone, s.bone.quaternion.clone()); s.bone.position.copy(s.position); s.bone.quaternion.copy(s.rotation) })
    if (this.sourceMotion && this.alignedSleep && mode === 'sleep' && amount > 0) {
      const spine = this.bone('spine_01'), original = spine.quaternion.clone()
      // Align above the native leg branch, then solve relaxed arms in the unchanged cabin axes.
      this.direct('spine_01', 'chest', [0, 1, .35])
      const aligned = spine.quaternion.clone()
      spine.quaternion.copy(original).slerp(aligned, ease(amount)); this.update()
    }
    for (const side of ['L', 'R'] as const) {
      const sign = this.sign.get(side)!, seated = mode === 'seat' ? amount : 0, sleep = mode === 'sleep' ? amount : 0, drift = Math.sin(this.time * .6) * .006
      const free = 1 - Math.max(seated, sleep)
      const forward = this.travel.forward * free, lateral = (this.travel.side + this.travel.turn * .4) * free
      this.direct(`upper_arm_${side}`, `forearm_${side}`, [sign * (.055 - .035 * sleep) + lateral * .012, -.17 - .03 * sleep, .055 * (1 - sleep) - forward * .018])
      this.direct(`forearm_${side}`, `hand_${side}`, [sign * (.01 - .07 * sleep) - lateral * .008, -.11 - .08 * sleep, (.13 + drift) * (1 - sleep) - .025 * sleep - forward * .018])
      this.direct(`thigh_${side}`, `shin_${side}`, [sign * .012 - lateral * .008, -.20 + .185 * seated + .03 * free, .045 + .195 * seated + .085 * free + forward * .018])
      this.direct(`shin_${side}`, `foot_${side}`, [0, -.18 + .05 * free, -.07 + .055 * seated - .10 * free])
      this.direct(`foot_${side}`, `toe_${side}`, [0, -.02 - .025 * sleep, .10 - .01 * sleep])
      if (!this.sourceMotion) for (const name of ['index', 'middle', 'ring', 'pinky']) { const digit = this.bones.get(`${name}_${side}`); if (digit) digit.rotation.x += sign * this.curl * .22 }
    }
    if (this.waveTime !== undefined) {
      this.waveTime += seconds; const t = this.waveTime, a = ease(t / 1.4) * (1 - ease((t - 2.2) / 1.5)), sign = this.sign.get('R')!
      this.direct('upper_arm_R', 'forearm_R', new Vector3(sign * .055, -.17, .055).lerp(new Vector3(sign * .17, .03, .055), a).toArray())
      this.direct('forearm_R', 'hand_R', new Vector3(sign * .01, -.11, .13).lerp(new Vector3(sign * .025, .17, .045), a).toArray())
      this.bone('hand_R').rotation.y += Math.sin(t * 6) * .12 * a; if (t >= 3.7) this.waveTime = undefined
    }
    this.sourceMotion?.pose(this.time, this.curl, this.alignedSleep && mode === 'sleep' ? ease((amount - .8) / .2) : 0)
    const blend = seconds ? 1 - Math.exp(-seconds * 12) : 1
    for (const s of this.rest) { const target = s.bone.quaternion.clone(); s.bone.quaternion.copy(this.before.get(s.bone)!).slerp(target, blend) }
    this.update()
  }

  private solve(target: Vector3, side: Side) {
    const upper = this.bone(`upper_arm_${side}`), fore = this.bone(`forearm_${side}`), hand = this.bone(`hand_${side}`)
    this.update(); const a = upper.getWorldPosition(new Vector3()), b = fore.getWorldPosition(new Vector3()), c = this.volume ? this.host.localToWorld(this.palm(side)) : hand.getWorldPosition(new Vector3())
    const l1 = a.distanceTo(b), l2 = b.distanceTo(c), direction = target.clone().sub(a), d = direction.length()
    const minimum = this.volume ? Math.sqrt(l1 * l1 + l2 * l2 + 2 * l1 * l2 * Math.cos(150 * Math.PI / 180)) : Math.abs(l1 - l2)
    if (d > l1 + l2 - .002 || d < minimum + .002) return false
    direction.divideScalar(d); const pole = (this.volume ? new Vector3(this.sign.get(side)! * .45, -.65, .75) : new Vector3(0, -1, -.15)).applyQuaternion(this.actor.getWorldQuaternion(new Quaternion()))
    pole.addScaledVector(direction, -pole.dot(direction)).normalize()
    const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d), height = Math.sqrt(Math.max(0, l1 * l1 - along * along))
    this.rotate(upper, fore, a.clone().addScaledVector(direction, along).addScaledVector(pole, height))
    if (this.volume) this.rotatePoint(fore, this.host.localToWorld(this.palm(side)), target); else this.rotate(fore, hand, target)
    return true
  }
  private orientPalm(side: Side, target: Vector3, normal: Vector3, extended = false) {
    const wrist = this.bone(`hand_${side}`), current = this.palmAxes.get(side)!.clone().applyQuaternion(wrist.getWorldQuaternion(new Quaternion())), aim = normal.clone().transformDirection(this.host.matrixWorld)
    if (current.dot(aim) < 0) aim.negate()
    const along = target.clone().sub(this.bone(`upper_arm_${side}`).getWorldPosition(new Vector3()))
    if (extended) { along.normalize(); aim.addScaledVector(along, -aim.dot(along)).normalize() }
    else along.addScaledVector(aim, -along.dot(aim))
    if (along.lengthSq() < .0001) { along.copy(this.fingerAxes.get(side)!).applyQuaternion(wrist.getWorldQuaternion(new Quaternion())); along.addScaledVector(aim, -along.dot(aim)) }
    along.normalize()
    const localZ = this.palmAxes.get(side)!, localX = this.fingerAxes.get(side)!, localY = localZ.clone().cross(localX).normalize(), worldY = aim.clone().cross(along).normalize()
    const local = new Matrix4().makeBasis(localX, localY, localZ), world = new Matrix4().makeBasis(along, worldY, aim)
    const orientation = new Quaternion().setFromRotationMatrix(world.multiply(local.invert()))
    wrist.quaternion.copy(wrist.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(orientation)); this.update()
    return orientation
  }
  reach(target: Vector3, side?: Side, normal?: Vector3, amount = 1) {
    const world = this.host.localToWorld(target.clone()), selected = side ?? (this.bone('upper_arm_L').getWorldPosition(new Vector3()).distanceTo(world) < this.bone('upper_arm_R').getWorldPosition(new Vector3()).distanceTo(world) ? 'L' : 'R')
    const saved = this.rest.map(s => s.bone.quaternion.clone())
    let result = this.reachPose(target, world, selected, normal)
    if (normal && (!result.reachable || result.error > .012)) {
      this.rest.forEach((s, i) => s.bone.quaternion.copy(saved[i])); this.update()
      result = this.reachPose(target, world, selected, normal, true)
    }
    if (this.volume && normal && (!result.reachable || result.error > .012)) {
      this.rest.forEach((s, i) => s.bone.quaternion.copy(saved[i])); this.bone(`hand_${selected}`).quaternion.copy(this.rest.find(s => s.bone === this.bone(`hand_${selected}`))!.rotation); this.update()
      result = this.reachPose(target, world, selected)
    }
    if (!result.reachable || result.error > .012) { this.rest.forEach((s, i) => s.bone.quaternion.copy(saved[i])); this.update(); result = { ...result, reachable: false } }
    else if (amount < 1) {
      this.rest.forEach((s, i) => s.bone.quaternion.copy(saved[i].clone().slerp(s.bone.quaternion, Math.max(0, amount)))); this.update()
      result = { ...result, point: this.palm(selected), error: this.palm(selected).distanceTo(target) }
    }
    return result
  }
  private reachPose(target: Vector3, world: Vector3, selected: Side, normal?: Vector3, extended = false) {
    const wrist = this.bone(`hand_${selected}`)
    const wristRest = this.rest.find(s => s.bone === wrist)!.rotation
    let wristOrientation: Quaternion | undefined
    if (normal) {
      wristOrientation = this.orientPalm(selected, world, normal, extended)
      let score = Infinity, chosen = this.palms.get(selected)!
      const direction = extended ? target.clone().sub(this.host.worldToLocal(this.bone(`upper_arm_${selected}`).getWorldPosition(new Vector3()))).normalize().negate() : normal
      for (const sample of this.contactSamples.get(selected) ?? []) { const distance = this.point(sample).dot(direction); if (distance < score) { score = distance; chosen = sample } }
      this.palms.set(selected, chosen)
    }
    let reachable = false
    for (let i = 0; i < 16; i++) {
      const palm = this.host.localToWorld(this.palm(selected)), hand = this.bone(`hand_${selected}`).getWorldPosition(new Vector3())
      reachable = this.solve(this.volume ? world : world.clone().sub(palm.sub(hand)), selected); if (!reachable) break
      if (wristOrientation) {
        const wanted = wrist.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(wristOrientation), angle = wristRest.angleTo(wanted)
        wrist.quaternion.copy(wristRest).slerp(wanted, this.volume ? Math.min(1, .72 / Math.max(angle, 1e-8)) : 1); this.update()
      }
      if (this.palm(selected).distanceTo(target) < .003) break
    }
    return { side: selected, reachable, point: this.palm(selected), error: this.palm(selected).distanceTo(target) }
  }
  palm(side: Side) { this.update(); return this.point(this.palms.get(side)!) }
  grasp(side: Side) { this.sourceMotion?.grasp(side); this.update() }
  handFor(target: Vector3): Side { const world = this.host.localToWorld(target.clone()); return this.bone('upper_arm_L').getWorldPosition(new Vector3()).distanceTo(world) < this.bone('upper_arm_R').getWorldPosition(new Vector3()).distanceTo(world) ? 'L' : 'R' }
  restoreArm(side: Side) { for (const name of [`upper_arm_${side}`, `forearm_${side}`, `hand_${side}`]) { const bone = this.bone(name), q = this.before.get(bone); if (q) bone.quaternion.copy(q) } this.update() }
  canReach(target: Vector3, normal: Vector3, side?: Side) {
    const rotations = this.rest.map(s => s.bone.quaternion.clone()), palms = new Map(this.palms)
    const result = this.reach(target, side, normal)
    this.rest.forEach((s, i) => s.bone.quaternion.copy(rotations[i])); this.palms = palms; this.update()
    return result.reachable && result.error <= .012
  }
  reachVolumes() {
    this.update()
    return (['L', 'R'] as const).map(side => {
      const shoulder = this.bone(`upper_arm_${side}`).getWorldPosition(new Vector3()), elbow = this.bone(`forearm_${side}`).getWorldPosition(new Vector3()), wrist = this.bone(`hand_${side}`).getWorldPosition(new Vector3())
      const upper = shoulder.distanceTo(elbow), lower = elbow.distanceTo(wrist), palm = this.handRadii.get(side)!
      return { side, shoulder: this.host.worldToLocal(shoulder), minimum: Math.max(0, Math.abs(upper - lower) - palm), maximum: upper + lower + palm }
    })
  }
  dressing(progress: number, support?: Vector3) {
    const amount = ease(progress / .3) * (1 - ease((progress - .7) / .3))
    const world = support && this.host.localToWorld(support.clone()), held = world ? this.bone('upper_arm_L').getWorldPosition(new Vector3()).distanceTo(world) < this.bone('upper_arm_R').getWorldPosition(new Vector3()).distanceTo(world) ? 'L' : 'R' : undefined
    for (const side of ['L', 'R'] as const) {
      if (side === held) continue
      const sign = this.sign.get(side)!
      this.direct(`upper_arm_${side}`, `forearm_${side}`, new Vector3(sign * .1, -.15, .035).lerp(new Vector3(sign * .11, .06, .12), amount).toArray())
      this.direct(`forearm_${side}`, `hand_${side}`, new Vector3(sign * .02, -.09, .15).lerp(new Vector3(-sign * .03, .17, .015), amount).toArray())
    }
  }
  bodyPoints() { this.update(); return this.samples.map(s => this.point(s)) }
  sampleIdentity(index: number) {
    const sample = this.samples[index]; if (!sample) return undefined
    const joints = sample.mesh.geometry.getAttribute('skinIndex'), weights = sample.mesh.geometry.getAttribute('skinWeight')
    let winner = 0; for (let k = 1; k < 4; k++) if (axis(weights, sample.index, k) > axis(weights, sample.index, winner)) winner = k
    return { mesh: sample.mesh.name, vertex: sample.index, bone: sample.mesh.skeleton.bones[axis(joints, sample.index, winner)]?.name }
  }
  poseRotations() { return this.rest.map(({ bone }) => ({ name: bone.name, rotation: bone.quaternion.toArray() })) }
  head() { this.update(); return this.host.worldToLocal(this.bone('head').getWorldPosition(new Vector3())) }
  harness(side: Side) { this.update(); const sample = this.harnessSamples.get(side); if (!sample) throw Error('Missing actual harness surface'); return this.point(sample) }
  rollbackPose() { if (this.seatClearance.active) this.seatClearance.rollback(); for (const [bone, rotation] of this.before) bone.quaternion.copy(rotation); this.update() }
  bounds() { const box = new Box3(); this.update(); for (const mesh of this.meshes) { const p = mesh.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) box.expandByPoint(this.point({ mesh, index: i })) } return box }
  dispose() { this.rest.forEach(s => { s.bone.position.copy(s.position); s.bone.quaternion.copy(s.rotation) }); this.sourceMotion?.dispose(); this.update(); this.volume?.dispose(); this.volume = undefined; this.samples = []; this.palms.clear(); this.handSamples.clear(); this.harnessSamples.clear(); this.palmAxes.clear(); this.fingerAxes.clear(); this.contactSamples.clear(); this.handRadii.clear(); this.bones.clear(); this.before.clear(); this.meshes = [] }
}
