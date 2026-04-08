import { useEffect, useRef } from 'react'

interface EdgeSwipeOptions {
  /** When false, no listeners are attached. */
  enabled: boolean
  /** Called once per detected swipe from the left edge. */
  onSwipe: () => void
  /** Start zone in px measured from the left viewport edge. Default 20. */
  edgeSize?: number
  /** Minimum horizontal travel in px to count as a swipe. Default 40. */
  minDistance?: number
  /** Abort if |deltaY| exceeds this before the swipe completes. Default 30. */
  maxOffAxis?: number
}

interface SwipeStart {
  pointerId: number
  x: number
  y: number
}

/**
 * Detect a horizontal swipe that starts within `edgeSize` pixels of the left
 * viewport edge. Fires `onSwipe` on pointerup if the gesture cleared the
 * distance threshold without drifting too far vertically.
 *
 * Uses pointer events with a touch/pen filter so stray mouse clicks near the
 * left edge don't trigger the drawer. Listeners are attached to `window` and
 * are passive — this hook never calls `preventDefault`.
 */
export function useEdgeSwipe({
  enabled,
  onSwipe,
  edgeSize = 20,
  minDistance = 40,
  maxOffAxis = 30,
}: EdgeSwipeOptions): void {
  const onSwipeRef = useRef(onSwipe)
  useEffect(() => {
    onSwipeRef.current = onSwipe
  })

  useEffect(() => {
    if (!enabled) return

    let start: SwipeStart | null = null

    function handlePointerDown(e: PointerEvent) {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return
      if (!e.isPrimary) return
      if (e.clientX > edgeSize) return
      start = { pointerId: e.pointerId, x: e.clientX, y: e.clientY }
    }

    function handlePointerMove(e: PointerEvent) {
      if (!start || e.pointerId !== start.pointerId) return
      const deltaY = Math.abs(e.clientY - start.y)
      const deltaX = e.clientX - start.x
      // Cancel if the gesture turns vertical or reverses leftward.
      if (deltaY > maxOffAxis || deltaX < 0) {
        start = null
      }
    }

    function handlePointerEnd(e: PointerEvent) {
      if (!start || e.pointerId !== start.pointerId) return
      const deltaX = e.clientX - start.x
      start = null
      if (deltaX >= minDistance) {
        onSwipeRef.current()
      }
    }

    function handlePointerCancel(e: PointerEvent) {
      if (start && e.pointerId === start.pointerId) {
        start = null
      }
    }

    window.addEventListener('pointerdown', handlePointerDown, { passive: true })
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerup', handlePointerEnd, { passive: true })
    window.addEventListener('pointercancel', handlePointerCancel, {
      passive: true,
    })

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerEnd)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }
  }, [enabled, edgeSize, minDistance, maxOffAxis])
}
