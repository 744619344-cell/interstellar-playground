import { useEffect, useRef, useState } from 'react'
import { cabinMenuKey, cabinNoticeVisible, cabinNoticePersistent } from './cabinHudInput'

export function useCabinMenu(clearInput: () => void, focusGame: () => void) {
  const [open, setOpen] = useState(false), latest = useRef({ open, clearInput, focusGame })
  latest.current = { open, clearInput, focusGame }
  const change = (value: boolean) => {
    latest.current.open = value; setOpen(value)
    latest.current.clearInput(); latest.current.focusGame()
  }
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const editing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      const command = cabinMenuKey(event.code, latest.current.open, editing, event.ctrlKey || event.altKey || event.metaKey)
      if (!command) return
      if (!event.repeat) change(command.open)
      if (command.consume) { event.preventDefault(); event.stopImmediatePropagation() }
    }
    window.addEventListener('keydown', handle, true)
    return () => window.removeEventListener('keydown', handle, true)
  }, [])
  return { open, change }
}
export function useCabinNotice(notice: string) {
  const [shown, setShown] = useState('')
  useEffect(() => {
    setShown(cabinNoticeVisible(notice) ? notice : '')
    if (cabinNoticePersistent(notice)) return
    const timer = window.setTimeout(() => setShown(''), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])
  return shown
}
