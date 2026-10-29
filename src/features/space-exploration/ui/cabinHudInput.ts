export function cabinMenuKey(code: string, open: boolean, editing = false, modified = false) {
  if (editing || modified) return undefined
  if (code === 'Tab') return { open: !open, consume: true }
  if (!open) return undefined
  if (code === 'Escape') return { open: false, consume: true }
  if (/^(Key[WASDZCQEBXFRMVTPIKH]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right))$/.test(code)) return { open: false, consume: false }
  return undefined
}
export function cabinNoticeVisible(notice: string) {
  return !!notice && !/^(端游辅助|真实惯性|已松手|抓握中|正在查看|已结束查看|设备约束中)/.test(notice)
}
export function cabinNoticePersistent(notice: string) {
  return /被挡住|路径受阻|氧.*不足|电.*不足/.test(notice)
}
export function cabinMotionNotice(notice: string, faded: string, blocked: boolean) {
  const collision = /^(前方有结构|移动被实际结构挡住)/.test(notice)
  return collision ? (blocked ? notice : '') : faded
}
