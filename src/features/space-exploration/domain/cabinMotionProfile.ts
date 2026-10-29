export const CABIN_ANIMATION=Object.freeze({seat:1.4,bed:2.6,wave:2.05,press:2.05,turnRate:4.8})
/** Zero velocity and acceleration at clip boundaries. */
export const motionEase=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*t*(10+t*(-15+6*t))}
export const motionStage=(value:number,start:number,end:number)=>motionEase((value-start)/(end-start))
export function cabinGait(phase:number,side:'L'|'R'){
 const cycle=((phase/(2*Math.PI)+(side==='L'?0:.5))%1+1)%1,stance=cycle<.62
 const t=stance?cycle/.62:(cycle-.62)/.38
 return {cycle,stance,hip:stance?.25-.49*motionEase(t):-.24+.49*motionEase(t),
  knee:stance?-.025-.04*motionStage(t,.7,1):-.04-.54*Math.sin(Math.PI*t),lift:stance?0:Math.sin(Math.PI*t)}
}
export const cabinRestStages=(progress:number)=>({sit:motionStage(progress,0,.27),recline:motionStage(progress,.35,.96),tilt:motionStage(progress,.3,.95)})
export const cabinPressAmount=(seconds:number)=>motionStage(seconds,0,.55)*(1-motionStage(seconds,1.35,2.0))
