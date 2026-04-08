import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEventHandler,
} from 'react'

interface EdgeSwipeOptions {
  /** When false, no listeners are attached. */
  enabled: boolean
  /** Called once per detected swipe from the left edge. */
  onSwipe: () => void
  /** Width of the swipe start zone in px. Default 20. */
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

interface EdgeSwipeZoneProps {
  onPointerDown: PointerEventHandler<HTMLElement>
  onPointerMove: PointerEventHandler<HTMLElement>
  onPointerUp: PointerEventHandler<HTMLElement>
  onPointerCancel: PointerEventHandler<HTMLElement>
  style: CSSProperties
}

/**
 * Returns pointer handlers for a narrow swipe-start surface near the left
 * viewport edge. Attach the returned props to a fixed element so the browser
 * can honor `touch-action: pan-y` there and continue sending the gesture to the
 * app instead of claiming it for native scrolling.
 *
 * Fires `onSwipe` as soon as the horizontal threshold is crossed. That avoids
 * waiting for a `pointerup` that some mobile browsers never deliver once they
 * start negotiating a native navigation or scroll gesture.
 */
export function useEdgeSwipe({
  enabled,
  onSwipe,
  edgeSize = 20,
  minDistance = 40,
  maxOffAxis = 30,
}: EdgeSwipeOptions): EdgeSwipeZoneProps | null {
  const onSwipeRef = useRef(onSwipe)
  const startRef = useRef<SwipeStart | null>(null)

  useEffect(() => {
    onSwipeRef.current = onSwipe
  }, [onSwipe])

  useEffect(() => {
    if (!enabled) {
      startRef.current = null
    }
  }, [enabled])

  if (!enabled) {
    return null
  }

  function clearSwipe(target: HTMLElement, pointerId: number) {
    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId)
    }
    startRef.current = null
  }

  const handlePointerDown: PointerEventHandler<HTMLElement> = (event) => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
    if (!event.isPrimary) return

    startRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove: PointerEventHandler<HTMLElement> = (event) => {
    const start = startRef.current
    if (!start || event.pointerId !== start.pointerId) return

    const deltaY = Math.abs(event.clientY - start.y)
    const deltaX = event.clientX - start.x
    if (deltaY > maxOffAxis || deltaX < 0) {
      clearSwipe(event.currentTarget, event.pointerId)
      return
    }

    if (deltaX >= minDistance) {
      clearSwipe(event.currentTarget, event.pointerId)
      onSwipeRef.current()
    }
  }

  const handlePointerUp: PointerEventHandler<HTMLElement> = (event) => {
    const start = startRef.current
    if (!start || event.pointerId !== start.pointerId) return

    const deltaX = event.clientX - start.x
    clearSwipe(event.currentTarget, event.pointerId)
    if (deltaX >= minDistance) {
      onSwipeRef.current()
    }
  }

  const handlePointerCancel: PointerEventHandler<HTMLElement> = (event) => {
    const start = startRef.current
    if (start && event.pointerId === start.pointerId) {
      clearSwipe(event.currentTarget, event.pointerId)
    }
  }

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
    style: {
      width: edgeSize,
      touchAction: 'pan-y',
    },
  }
}
