import { useSyncExternalStore } from 'react'

const MOBILE_BREAKPOINT = 768

const mediaQuery =
  typeof window !== 'undefined'
    ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    : null

function subscribe(callback: () => void): () => void {
  if (!mediaQuery) return () => {}
  mediaQuery.addEventListener('change', callback)
  return () => mediaQuery.removeEventListener('change', callback)
}

function getSnapshot(): boolean {
  return mediaQuery ? mediaQuery.matches : false
}

function getServerSnapshot(): boolean {
  return false
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
