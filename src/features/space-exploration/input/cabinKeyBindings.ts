interface Actions {
  grip(): void; mode(): void; eva(action: 'wear' | 'tether' | 'pressure'): void
  hand(action: 'wave' | 'inspect' | 'curl' | 'relax'): void
}
const movement = /^(Key[WSADZCQEB]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Key[MKL])$/
const commands: Record<string, (actions: Actions) => void> = {
  KeyX: a => a.grip(), KeyM: a => a.mode(), KeyR: a => a.eva('wear'),
  KeyT: a => a.eva('tether'), KeyP: a => a.eva('pressure'),
  KeyV: a => a.hand('wave'), KeyI: a => a.hand('inspect'), KeyG: a => a.hand('curl'), KeyH: a => a.hand('relax')
}
export function cabinKeyBinding(keys: Set<string>, code: string, down: boolean, running: boolean, actions: Actions) {
  if (!movement.test(code) && !commands[code]) return false
  if (down) keys.add(code); else keys.delete(code)
  if (down && running) commands[code]?.(actions)
  return true
}
