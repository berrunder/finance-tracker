import { renderHook } from '@testing-library/react'
import { useEdgeSwipe } from '../use-edge-swipe'

interface PointerInit {
  pointerId?: number
  pointerType?: string
  isPrimary?: boolean
  clientX: number
  clientY: number
}

function firePointer(type: string, init: PointerInit) {
  // jsdom lacks a full PointerEvent constructor, so synthesize one with the
  // properties our hook reads. Dispatching on `window` matches where the hook
  // listens.
  const event = new Event(type, { bubbles: true }) as Event & {
    pointerId: number
    pointerType: string
    isPrimary: boolean
    clientX: number
    clientY: number
  }
  Object.assign(event, {
    pointerId: init.pointerId ?? 1,
    pointerType: init.pointerType ?? 'touch',
    isPrimary: init.isPrimary ?? true,
    clientX: init.clientX,
    clientY: init.clientY,
  })
  window.dispatchEvent(event)
}

describe('useEdgeSwipe', () => {
  it('fires onSwipe for a touch swipe that starts within the edge zone', () => {
    const onSwipe = vi.fn()
    renderHook(() => useEdgeSwipe({ enabled: true, onSwipe }))

    firePointer('pointerdown', { clientX: 5, clientY: 100 })
    firePointer('pointermove', { clientX: 40, clientY: 105 })
    firePointer('pointerup', { clientX: 60, clientY: 108 })

    expect(onSwipe).toHaveBeenCalledTimes(1)
  })

  it('ignores swipes that start outside the edge zone', () => {
    const onSwipe = vi.fn()
    renderHook(() => useEdgeSwipe({ enabled: true, onSwipe }))

    firePointer('pointerdown', { clientX: 50, clientY: 100 })
    firePointer('pointerup', { clientX: 200, clientY: 100 })

    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('ignores swipes that do not travel far enough horizontally', () => {
    const onSwipe = vi.fn()
    renderHook(() => useEdgeSwipe({ enabled: true, onSwipe }))

    firePointer('pointerdown', { clientX: 5, clientY: 100 })
    firePointer('pointerup', { clientX: 30, clientY: 100 })

    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('cancels when the gesture drifts too far vertically', () => {
    const onSwipe = vi.fn()
    renderHook(() => useEdgeSwipe({ enabled: true, onSwipe }))

    firePointer('pointerdown', { clientX: 5, clientY: 100 })
    firePointer('pointermove', { clientX: 20, clientY: 200 })
    firePointer('pointerup', { clientX: 60, clientY: 210 })

    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('cancels if the finger reverses leftward before release', () => {
    const onSwipe = vi.fn()
    renderHook(() => useEdgeSwipe({ enabled: true, onSwipe }))

    firePointer('pointerdown', { clientX: 5, clientY: 100 })
    firePointer('pointermove', { clientX: -5, clientY: 100 })
    firePointer('pointerup', { clientX: 60, clientY: 100 })

    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('ignores mouse pointers', () => {
    const onSwipe = vi.fn()
    renderHook(() => useEdgeSwipe({ enabled: true, onSwipe }))

    firePointer('pointerdown', {
      clientX: 5,
      clientY: 100,
      pointerType: 'mouse',
    })
    firePointer('pointerup', {
      clientX: 80,
      clientY: 100,
      pointerType: 'mouse',
    })

    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('does not attach listeners when disabled', () => {
    const onSwipe = vi.fn()
    renderHook(() => useEdgeSwipe({ enabled: false, onSwipe }))

    firePointer('pointerdown', { clientX: 5, clientY: 100 })
    firePointer('pointerup', { clientX: 80, clientY: 100 })

    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('cancels tracking on pointercancel', () => {
    const onSwipe = vi.fn()
    renderHook(() => useEdgeSwipe({ enabled: true, onSwipe }))

    firePointer('pointerdown', { clientX: 5, clientY: 100 })
    firePointer('pointercancel', { clientX: 40, clientY: 100 })
    firePointer('pointerup', { clientX: 80, clientY: 100 })

    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('detaches listeners when transitioning from enabled to disabled', () => {
    const onSwipe = vi.fn()
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useEdgeSwipe({ enabled, onSwipe }),
      { initialProps: { enabled: true } },
    )

    rerender({ enabled: false })

    firePointer('pointerdown', { clientX: 5, clientY: 100 })
    firePointer('pointerup', { clientX: 80, clientY: 100 })

    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('re-attaches listeners when transitioning from disabled to enabled', () => {
    const onSwipe = vi.fn()
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useEdgeSwipe({ enabled, onSwipe }),
      { initialProps: { enabled: false } },
    )

    // While disabled — should be ignored.
    firePointer('pointerdown', { clientX: 5, clientY: 100 })
    firePointer('pointerup', { clientX: 80, clientY: 100 })
    expect(onSwipe).not.toHaveBeenCalled()

    rerender({ enabled: true })

    firePointer('pointerdown', { clientX: 5, clientY: 100 })
    firePointer('pointerup', { clientX: 80, clientY: 100 })
    expect(onSwipe).toHaveBeenCalledTimes(1)
  })

  it('uses the latest onSwipe callback without re-attaching listeners', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(
      ({ cb }: { cb: () => void }) =>
        useEdgeSwipe({ enabled: true, onSwipe: cb }),
      { initialProps: { cb: first } },
    )

    rerender({ cb: second })

    firePointer('pointerdown', { clientX: 5, clientY: 100 })
    firePointer('pointerup', { clientX: 80, clientY: 100 })

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
