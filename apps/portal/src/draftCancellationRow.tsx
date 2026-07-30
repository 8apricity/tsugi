import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import {
  createTouchGestureIntent,
  shouldCommitHorizontalSwipe,
  type TouchGestureSnapshot,
} from './touchGestureIntent'

const ACTION_WIDTH_PX = 72

type Gesture = {
  pointerId: number
  startOffset: number
  intent: ReturnType<typeof createTouchGestureIntent>
  latest: TouchGestureSnapshot
}

function comesFromNestedCancellationRow(
  target: EventTarget,
  currentTarget: HTMLDivElement,
) {
  return target instanceof Element &&
    target.closest('.draft-cancellation-row') !== currentTarget
}

export type DraftCancellationRowHandle = {
  focusEditControl: () => void
  getElement: () => HTMLDivElement | null
}

type DraftCancellationRowProps = {
  draftId: string
  open: boolean
  anotherRowOpen: boolean
  accessibleLabel?: string
  disabled?: boolean
  showMenuButton?: boolean
  onInteractionStart: () => void
  onOpenChange: (open: boolean) => void
  onCancel: () => void
  children: ReactNode
}

export const DraftCancellationRow = forwardRef<
  DraftCancellationRowHandle,
  DraftCancellationRowProps
>(function DraftCancellationRow({
  draftId,
  open,
  anotherRowOpen,
  accessibleLabel = '下書きの操作',
  disabled = false,
  showMenuButton = false,
  onInteractionStart,
  onOpenChange,
  onCancel,
  children,
}, forwardedRef) {
  const contentRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const offsetRef = useRef(open ? -ACTION_WIDTH_PX : 0)
  const suppressActivationRef = useRef(false)
  const [dragOffset, setDragOffset] = useState<number | null>(null)

  useImperativeHandle(forwardedRef, () => ({
    focusEditControl() {
      contentRef.current?.querySelector<HTMLElement>(
        ':scope > button, [role="button"], button',
      )?.focus()
    },
    getElement() {
      return contentRef.current?.parentElement as HTMLDivElement | null
    },
  }), [])

  function releasePointer(event: ReactPointerEvent<HTMLDivElement>) {
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // Synthetic browser-test pointers are not registered with pointer capture.
    }
  }

  function finishGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const result = gesture.intent.finish({
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
    })
    gestureRef.current = null
    releasePointer(event)
    if (result.intent === 'horizontal') {
      suppressActivationRef.current = true
      globalThis.setTimeout(() => {
        suppressActivationRef.current = false
      }, 0)
      const committed = shouldCommitHorizontalSwipe({
        deltaX: result.deltaX,
        velocityX: result.velocityX,
        viewportWidth: ACTION_WIDTH_PX * 2,
      })
      onOpenChange(
        committed
          ? gesture.startOffset === 0
            ? result.deltaX < 0
            : !(result.deltaX > 0)
          : gesture.startOffset < 0,
      )
    }
    setDragOffset(null)
  }

  const offset = dragOffset ?? (open ? -ACTION_WIDTH_PX : 0)
  const style = {
    '--draft-cancellation-offset': `${offset}px`,
    '--draft-cancellation-action-width': `${Math.abs(offset)}px`,
    '--draft-cancellation-action-max-width': `${ACTION_WIDTH_PX}px`,
  } as CSSProperties

  return (
    <div
      className={`draft-cancellation-row${
        dragOffset !== null ? ' draft-cancellation-dragging' : ''
      }${open ? ' draft-cancellation-open' : ''}`}
      role="group"
      aria-label={accessibleLabel}
      data-draft-cancellation-id={draftId}
      data-cancellation-open={open ? 'true' : 'false'}
      style={style}
      onFocusCapture={(event) => {
        if (comesFromNestedCancellationRow(event.target, event.currentTarget)) return
        onInteractionStart()
      }}
      onPointerDownCapture={(event) => {
        if (disabled) return
        if (comesFromNestedCancellationRow(event.target, event.currentTarget)) return
        if (
          event.target instanceof Element &&
          event.target.closest('.draft-cancellation-action')
        ) {
          return
        }
        suppressActivationRef.current = anotherRowOpen
        onInteractionStart()
        if (event.pointerType !== 'touch') return
        const startOffset = open ? -ACTION_WIDTH_PX : 0
        const intent = createTouchGestureIntent()
        intent.start({
          x: event.clientX,
          y: event.clientY,
          time: event.timeStamp,
        })
        offsetRef.current = startOffset
        gestureRef.current = {
          pointerId: event.pointerId,
          startOffset,
          intent,
          latest: {
            intent: 'pending',
            deltaX: 0,
            deltaY: 0,
            velocityX: 0,
          },
        }
      }}
      onPointerMove={(event) => {
        const gesture = gestureRef.current
        if (!gesture || gesture.pointerId !== event.pointerId) return
        const coalescedEvents = event.nativeEvent.getCoalescedEvents?.() ?? []
        const points = coalescedEvents.length > 0
          ? coalescedEvents
          : [event.nativeEvent]
        for (const point of points) {
          gesture.latest = gesture.intent.move({
            x: point.clientX,
            y: point.clientY,
            time: point.timeStamp,
          })
        }
        if (gesture.latest.intent === 'vertical') {
          if (open) onOpenChange(false)
          setDragOffset(null)
          return
        }
        if (gesture.latest.intent !== 'horizontal') return

        event.preventDefault()
        const nextOffset = Math.max(
          -ACTION_WIDTH_PX,
          Math.min(0, gesture.startOffset + gesture.latest.deltaX),
        )
        offsetRef.current = nextOffset
        setDragOffset(nextOffset)
      }}
      onPointerUp={finishGesture}
      onPointerCancel={(event) => {
        const gesture = gestureRef.current
        if (!gesture || gesture.pointerId !== event.pointerId) return
        gestureRef.current = null
        gesture.intent.cancel()
        releasePointer(event)
        setDragOffset(null)
        if (gesture.latest.intent === 'vertical') onOpenChange(false)
      }}
      onClickCapture={(event) => {
        if (comesFromNestedCancellationRow(event.target, event.currentTarget)) return
        if (
          event.target instanceof Element &&
          event.target.closest('.draft-cancellation-action')
        ) {
          return
        }
        if (!open && !suppressActivationRef.current) return
        suppressActivationRef.current = false
        event.preventDefault()
        event.stopPropagation()
        onOpenChange(false)
      }}
    >
      <div ref={contentRef} className="draft-cancellation-content">
        {children}
      </div>
      {showMenuButton ? (
        <button
          className="draft-cancellation-menu-button"
          type="button"
          aria-label="下書きの操作メニュー"
          aria-expanded={open}
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation()
            onOpenChange(!open)
          }}
        >
          ⋮
        </button>
      ) : null}
      <button
        className="draft-cancellation-action"
        type="button"
        aria-label="下書きを取り消す"
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation()
          onCancel()
        }}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d="M5 7h14M9 7V4h6v3m2 0-1 13H8L7 7m4 4v5m2-5v5" />
        </svg>
      </button>
    </div>
  )
})
