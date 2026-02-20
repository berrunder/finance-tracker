import { useEffect, useRef } from 'react'

function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}

/**
 * Register a global keyboard shortcut.
 *
 * Key format: "mod+n" (mod = Ctrl on Windows/Linux, Cmd on Mac), "escape", etc.
 * By default, shortcuts are disabled when an input element is focused.
 */
export function useHotkey(
  key: string,
  callback: () => void,
  options: { enableOnInputs?: boolean } = {},
) {
  const callbackRef = useRef(callback)
  useEffect(() => {
    callbackRef.current = callback
  })

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      if (!options.enableOnInputs && isInputElement(e.target)) return

      const parts = key.toLowerCase().split('+')
      const mainKey = parts[parts.length - 1]
      const needsMod = parts.includes('mod')

      if (needsMod && !(e.ctrlKey || e.metaKey)) return
      if (e.key.toLowerCase() !== mainKey) return

      e.preventDefault()
      callbackRef.current()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [key, options.enableOnInputs])
}
