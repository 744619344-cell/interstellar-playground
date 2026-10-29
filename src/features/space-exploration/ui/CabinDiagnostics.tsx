import type { SystemMapSnapshot } from '../rendering/solar-system/systemMapEngine'
import { isMicrogravityCabin } from '../rendering/spacecraft/microgravityCabinRuntime'

export default function CabinDiagnostics({ state }: { state: NonNullable<SystemMapSnapshot['shipFlight']> }) {
  const crew = state.model.cabin
  return <section className='cabin-diagnostics' aria-label='运行诊断'>
    {crew && <><output aria-label='宇航员位置'>位置 {Object.values(crew.position).map(n => n.toFixed(3)).join(' / ')}</output>
      {isMicrogravityCabin(crew) && <pre aria-label='舱内运动诊断'>{JSON.stringify({ controlMode: crew.controlMode, float: crew.float, blocked: crew.blocked, posture: crew.posture, collisionProbe: crew.collisionProbe, view: { yaw: state.yaw, pitch: state.pitch, position: state.position, target: state.target } }, null, 2)}</pre>}
      <output aria-label='舱门动作'>门行程 {crew.door.progress.toFixed(3)} · 目标 {crew.door.target} · {crew.door.blocked ? '避让中' : '无阻挡'}</output></>}
    <output aria-label='渲染资源'>纹理 {state.resources.textures} · 几何 {state.resources.geometries} · 程序 {state.resources.programs}</output>
    {state.model.surface && <pre aria-label='表面材质诊断'>{JSON.stringify(state.model.surface, null, 2)}</pre>}
    <output aria-label='渲染帧率'>最近 {state.frames.samples} 帧 · 平均 {state.frames.fps.toFixed(1)} FPS · 1% low {state.frames.lowFps.toFixed(1)} FPS</output>
    {state.graphicsBackend && <output aria-label='图形后端'>{state.graphicsBackend}</output>}
  </section>
}
