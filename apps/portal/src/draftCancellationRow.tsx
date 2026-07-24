import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

const ACTION_WIDTH_PX = 72
const TAP_SLOP_PX = 8
const HORIZONTAL_INTENT_RATIO = 1.25
const REVEAL_THRESHOLD_PX = 36

type Gesture = {
  pointerId: number
  startX: number
  startY: number
  startOffset: number
  mode: 'pending' | 'horizontal' | 'vertical'
}

export type DraftCancellationRowHandle = {
  focusEditControl: () => void
}

type DraftCancellationRowProps = {
  draftId: string
  open: boolean
  anotherRowOpen: boolean
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
    gestureRef.current = null
    releasePointer(event)
    if (gesture.mode === 'horizontal') {
      suppressActivationRef.current = true
      globalThis.setTimeout(() => {
        suppressActivationRef.current = false
      }, 0)
      onOpenChange(offsetRef.current <= -REVEAL_THRESHOLD_PX)
    }
    setDragOffset(null)
  }

  const offset = dragOffset ?? (open ? -ACTION_WIDTH_PX : 0)
  const style = {
    '--draft-cancellation-offset': `${offset}px`,
  } as CSSProperties

  return (
    <div
      className={`draft-cancellation-row${
        dragOffset !== null ? ' draft-cancellation-dragging' : ''
      }${open ? ' draft-cancellation-open' : ''}`}
      data-draft-cancellation-id={draftId}
      data-cancellation-open={open ? 'true' : 'false'}
      style={style}
      onFocusCapture={onInteractionStart}
      onPointerDownCapture={(event) => {
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
        offsetRef.current = startOffset
        gestureRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          startOffset,
          mode: 'pending',
        }
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Synthetic browser-test pointers are not registered with pointer capture.
        }
      }}
      onPointerMove={(event) => {
        const gesture = gestureRef.current
        if (!gesture || gesture.pointerId !== event.pointerId) return
        const deltaX = event.clientX - gesture.startX
        const deltaY = event.clientY - gesture.startY
        const horizontalDistance = Math.abs(deltaX)
        const verticalDistance = Math.abs(deltaY)

        if (gesture.mode === 'pending') {
          if (
            horizontalDistance < TAP_SLOP_PX &&
            verticalDistance < TAP_SLOP_PX
          ) {
            return
          }
          if (
            horizontalDistance >
            verticalDistance * HORIZONTAL_INTENT_RATIO
          ) {
            gesture.mode = 'horizontal'
          } else if (verticalDistance > horizontalDistance) {
            gesture.mode = 'vertical'
            if (open) onOpenChange(false)
            setDragOffset(null)
            return
          } else {
            return
          }
        }
        if (gesture.mode !== 'horizontal') return

        event.preventDefault()
        const nextOffset = Math.max(
          -ACTION_WIDTH_PX,
          Math.min(0, gesture.startOffset + deltaX),
        )
        offsetRef.current = nextOffset
        setDragOffset(nextOffset)
      }}
      onPointerUp={finishGesture}
      onPointerCancel={(event) => {
        const gesture = gestureRef.current
        if (!gesture || gesture.pointerId !== event.pointerId) return
        gestureRef.current = null
        releasePointer(event)
        setDragOffset(null)
        if (gesture.mode === 'vertical') onOpenChange(false)
      }}
      onClickCapture={(event) => {
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
      <button
        className="draft-cancellation-action"
        type="button"
        aria-label="下書きを取り消す"
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
