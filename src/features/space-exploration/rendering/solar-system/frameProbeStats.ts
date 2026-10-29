/** Frame delivery statistics; CPU submission time is never presented as GPU duration. */
export function frameProbeStats(times: readonly number[]) {
  const finite = times.filter(value => Number.isFinite(value) && value > 0)
  if (!finite.length) return { frames: 0, activeSeconds: 0, averageFps: 0, onePercentLowFps: 0, longestFrameMs: 0 }
  const sorted = [...finite].sort((a, b) => b - a), total = finite.reduce((sum, value) => sum + value, 0)
  const tail = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * .01)))
  return { frames: finite.length, activeSeconds: total / 1000, averageFps: finite.length * 1000 / total,
    onePercentLowFps: tail.length * 1000 / tail.reduce((sum, value) => sum + value, 0), longestFrameMs: sorted[0] }
}
