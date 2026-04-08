import { act, renderHook } from '@testing-library/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEdgeSwipe } from '../use-edge-swipe'

interface PointerInit {
  pointerId?: number
  pointerType?: string
  isPrimary?: boolean
  clientX: number
  clientY: number
}

type PointerCaptureTarget = Pick<
  HTMLElement,
  'setPointerCapture' | 'hasPointerCapture' | 'releasePointerCapture'
>

function createPointerTarget(): PointerCaptureTarget {
  const capturedPointers = new Set<number>()

  return {
    setPointerCapture: vi.fn((pointerId: number) => {
      capturedPointers.add(pointerId)
    }),
    hasPointerCapture: vi.fn((pointerId: number) =>
      capturedPointers.has(pointerId),
    ),
    releasePointerCapture: vi.fn((pointerId: number) => {
      capturedPointers.delete(pointerId)
    }),
  }
}

function createPointerEvent(
  currentTarget: PointerCaptureTarget,
  init: PointerInit,
): ReactPointerEvent<HTMLElement> {
  return {
    currentTarget,
    pointerId: init.pointerId ?? 1,
    pointerType: init.pointerType ?? 'touch',
    isPrimary: init.isPrimary ?? true,
    clientX: init.clientX,
    clientY: init.clientY,
  } as ReactPointerEvent<HTMLElement>
}

describe('useEdgeSwipe', () => {
  it('fires onSwipe once the swipe clears the distance threshold during move', () => {
    const onSwipe = vi.fn()
    const target = createPointerTarget()
    const { result } = renderHook(() =>
      useEdgeSwipe({ enabled: true, onSwipe }),
    )

    act(() => {
      result.current?.onPointerDown(
        createPointerEvent(target, { clientX: 5, clientY: 100 }),
      )
      result.current?.onPointerMove(
        createPointerEvent(target, { clientX: 45, clientY: 105 }),
      )
    })

    expect(onSwipe).toHaveBeenCalledTimes(1)
    expect(target.setPointerCapture).toHaveBeenCalledWith(1)
    expect(target.releasePointerCapture).toHaveBeenCalledWith(1)
  })

  it('does not fire twice when pointerup follows a successful move-triggered swipe', () => {
    const onSwipe = vi.fn()
    const target = createPointerTarget()
    const { result } = renderHook(() =>
      useEdgeSwipe({ enabled: true, onSwipe }),
    )

    act(() => {
      result.current?.onPointerDown(
        createPointerEvent(target, { clientX: 5, clientY: 100 }),
      )
      result.current?.onPointerMove(
        createPointerEvent(target, { clientX: 50, clientY: 100 }),
      )
      result.current?.onPointerUp(
        createPointerEvent(target, { clientX: 80, clientY: 100 }),
      )
    })

    expect(onSwipe).toHaveBeenCalledTimes(1)
  })

  it('falls back to pointerup when the swipe reaches the threshold on release', () => {
    const onSwipe = vi.fn()
    const target = createPointerTarget()
    const { result } = renderHook(() =>
      useEdgeSwipe({ enabled: true, onSwipe }),
    )

    act(() => {
      result.current?.onPointerDown(
        createPointerEvent(target, { clientX: 5, clientY: 100 }),
      )
      result.current?.onPointerUp(
        createPointerEvent(target, { clientX: 50, clientY: 100 }),
      )
    })

    expect(onSwipe).toHaveBeenCalledTimes(1)
  })

  it('ignores swipes that do not travel far enough horizontally', () => {
    const onSwipe = vi.fn()
    const target = createPointerTarget()
    const { result } = renderHook(() =>
      useEdgeSwipe({ enabled: true, onSwipe }),
    )

    act(() => {
      result.current?.onPointerDown(
        createPointerEvent(target, { clientX: 5, clientY: 100 }),
      )
      result.current?.onPointerUp(
        createPointerEvent(target, { clientX: 30, clientY: 100 }),
      )
    })

    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('cancels when the gesture drifts too far vertically', () => {
    const onSwipe = vi.fn()
    const target = createPointerTarget()
    const { result } = renderHook(() =>
      useEdgeSwipe({ enabled: true, onSwipe }),
    )

    act(() => {
      result.current?.onPointerDown(
        createPointerEvent(target, { clientX: 5, clientY: 100 }),
      )
      result.current?.onPointerMove(
        createPointerEvent(target, { clientX: 20, clientY: 200 }),
      )
      result.current?.onPointerUp(
        createPointerEvent(target, { clientX: 60, clientY: 210 }),
      )
    })

    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('cancels if the finger reverses leftward before release', () => {
    const onSwipe = vi.fn()
    const target = createPointerTarget()
    const { result } = renderHook(() =>
      useEdgeSwipe({ enabled: true, onSwipe }),
    )

    act(() => {
      result.current?.onPointerDown(
        createPointerEvent(target, { clientX: 5, clientY: 100 }),
      )
      result.current?.onPointerMove(
        createPointerEvent(target, { clientX: -5, clientY: 100 }),
      )
      result.current?.onPointerUp(
        createPointerEvent(target, { clientX: 60, clientY: 100 }),
      )
    })

    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('ignores mouse pointers', () => {
    const onSwipe = vi.fn()
    const target = createPointerTarget()
    const { result } = renderHook(() =>
      useEdgeSwipe({ enabled: true, onSwipe }),
    )

    act(() => {
      result.current?.onPointerDown(
        createPointerEvent(target, {
          clientX: 5,
          clientY: 100,
          pointerType: 'mouse',
        }),
      )
      result.current?.onPointerUp(
        createPointerEvent(target, {
          clientX: 80,
          clientY: 100,
          pointerType: 'mouse',
        }),
      )
    })

    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('returns no swipe zone props when disabled', () => {
    const onSwipe = vi.fn()
    const { result } = renderHook(() =>
      useEdgeSwipe({ enabled: false, onSwipe }),
    )

    expect(result.current).toBeNull()
  })

  it('cancels tracking on pointercancel', () => {
    const onSwipe = vi.fn()
    const target = createPointerTarget()
    const { result } = renderHook(() =>
      useEdgeSwipe({ enabled: true, onSwipe }),
    )

    act(() => {
      result.current?.onPointerDown(
        createPointerEvent(target, { clientX: 5, clientY: 100 }),
      )
      result.current?.onPointerCancel(
        createPointerEvent(target, { clientX: 40, clientY: 100 }),
      )
      result.current?.onPointerUp(
        createPointerEvent(target, { clientX: 80, clientY: 100 }),
      )
    })

    expect(onSwipe).not.toHaveBeenCalled()
    expect(target.releasePointerCapture).toHaveBeenCalledWith(1)
  })

  it('returns swipe zone props when transitioning from disabled to enabled', () => {
    const onSwipe = vi.fn()
    const target = createPointerTarget()
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useEdgeSwipe({ enabled, onSwipe }),
      { initialProps: { enabled: false } },
    )

    expect(result.current).toBeNull()

    rerender({ enabled: true })

    act(() => {
      result.current?.onPointerDown(
        createPointerEvent(target, { clientX: 5, clientY: 100 }),
      )
      result.current?.onPointerUp(
        createPointerEvent(target, { clientX: 80, clientY: 100 }),
      )
    })

    expect(onSwipe).toHaveBeenCalledTimes(1)
  })

  it('uses the latest onSwipe callback without losing the swipe zone', () => {
    const first = vi.fn()
    const second = vi.fn()
    const target = createPointerTarget()
    const { result, rerender } = renderHook(
      ({ cb }: { cb: () => void }) =>
        useEdgeSwipe({ enabled: true, onSwipe: cb }),
      { initialProps: { cb: first } },
    )

    rerender({ cb: second })

    act(() => {
      result.current?.onPointerDown(
        createPointerEvent(target, { clientX: 5, clientY: 100 }),
      )
      result.current?.onPointerUp(
        createPointerEvent(target, { clientX: 80, clientY: 100 }),
      )
    })

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
