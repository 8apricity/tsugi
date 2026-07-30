import {
  useCallback,
  useEffect,
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

const SCREEN_EDGE_EXCLUSION_PX = 24
const SETTLE_FALLBACK_MS = 320

type Direction = -1 | 1

type ActivePointer = {
  pointerId: number
  intent: ReturnType<typeof createTouchGestureIntent>
  latest: TouchGestureSnapshot
}

type MotionState = {
  kind: 'idle' | 'dragging' | 'settling'
  offset: number
  navigation: Direction | null
}

const idleMotion: MotionState = {
  kind: 'idle',
  offset: 0,
  navigation: null,
}

export function DailyPlanSwipeFrame({
  previous,
  next,
  canGoPrevious,
  canGoNext,
  disabled,
  onNavigate,
  children,
}: {
  previous: ReactNode
  next: ReactNode
  canGoPrevious: boolean
  canGoNext: boolean
  disabled: boolean
  onNavigate(direction: Direction): void
  children: ReactNode
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const pointerRef = useRef<ActivePointer | null>(null)
  const suppressClickRef = useRef(false)
  const motionRef = useRef<MotionState>(idleMotion)
  const [motion, setMotionState] = useState<MotionState>(idleMotion)

  function setMotion(nextMotion: MotionState) {
    motionRef.current = nextMotion
    setMotionState(nextMotion)
  }

  function frameWidth() {
    return frameRef.current?.getBoundingClientRect().width ??
      globalThis.innerWidth
  }

  function directionIsAvailable(direction: Direction) {
    return direction === -1 ? canGoPrevious : canGoNext
  }

  const completeSettling = useCallback(() => {
    const current = motionRef.current
    if (current.kind !== 'settling') return
    const navigation = current.navigation
    motionRef.current = idleMotion
    setMotionState(idleMotion)
    if (navigation !== null) onNavigate(navigation)
  }, [onNavigate])

  function settleTo(direction: Direction | null) {
    const reduceMotion = globalThis.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    ).matches
    if (reduceMotion) {
      setMotion(idleMotion)
      if (direction !== null) onNavigate(direction)
      return
    }
    setMotion({
      kind: 'settling',
      offset: direction === null ? 0 : -direction * frameWidth(),
      navigation: direction,
    })
  }

  function releasePointer(event: ReactPointerEvent<HTMLDivElement>) {
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // Synthetic browser-test pointers are not registered with pointer capture.
    }
  }

  useEffect(() => {
    if (motion.kind !== 'settling') return
    const timeoutId = globalThis.setTimeout(
      completeSettling,
      SETTLE_FALLBACK_MS,
    )
    return () => globalThis.clearTimeout(timeoutId)
  }, [completeSettling, motion.kind, motion.navigation])

  useEffect(() => {
    if (!disabled) return
    pointerRef.current?.intent.cancel()
    pointerRef.current = null
  }, [disabled])

  const style = {
    '--daily-plan-swipe-offset': `${motion.offset}px`,
  } as CSSProperties

  return (
    <div
      ref={frameRef}
      className="daily-plan-swipe-frame"
      data-motion={motion.kind}
      style={style}
      onPointerDown={(event) => {
        if (
          disabled ||
          motionRef.current.kind !== 'idle' ||
          event.pointerType !== 'touch' ||
          !event.isPrimary ||
          !globalThis.matchMedia?.(
            '(hover: none) and (pointer: coarse)',
          ).matches ||
          event.clientX <= SCREEN_EDGE_EXCLUSION_PX ||
          event.clientX >= globalThis.innerWidth - SCREEN_EDGE_EXCLUSION_PX
        ) {
          return
        }
        const intent = createTouchGestureIntent()
        intent.start({
          x: event.clientX,
          y: event.clientY,
          time: event.timeStamp,
        })
        pointerRef.current = {
          pointerId: event.pointerId,
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
        const active = pointerRef.current
        if (!active || active.pointerId !== event.pointerId) return
        const coalescedEvents = event.nativeEvent.getCoalescedEvents?.() ?? []
        const points = coalescedEvents.length > 0
          ? coalescedEvents
          : [event.nativeEvent]
        for (const point of points) {
          active.latest = active.intent.move({
            x: point.clientX,
            y: point.clientY,
            time: point.timeStamp,
          })
        }
        if (active.latest.intent !== 'horizontal') return

        event.preventDefault()
        try {
          event.currentTarget.setPointerCapture(event.pointerId)
        } catch {
          // Synthetic browser-test pointers are not registered with pointer capture.
        }
        const direction: Direction = active.latest.deltaX < 0 ? 1 : -1
        const offset = directionIsAvailable(direction)
          ? active.latest.deltaX
          : active.latest.deltaX * 0.18
        const width = frameWidth()
        setMotion({
          kind: 'dragging',
          offset: Math.max(-width, Math.min(width, offset)),
          navigation: null,
        })
      }}
      onPointerUp={(event) => {
        const active = pointerRef.current
        if (!active || active.pointerId !== event.pointerId) return
        const result = active.intent.finish({
          x: event.clientX,
          y: event.clientY,
          time: event.timeStamp,
        })
        pointerRef.current = null
        releasePointer(event)
        if (result.intent !== 'horizontal') {
          setMotion(idleMotion)
          return
        }

        suppressClickRef.current = true
        globalThis.setTimeout(() => {
          suppressClickRef.current = false
        }, 0)
        const direction: Direction = result.deltaX < 0 ? 1 : -1
        const commit =
          directionIsAvailable(direction) &&
          shouldCommitHorizontalSwipe({
            deltaX: result.deltaX,
            velocityX: result.velocityX,
            viewportWidth: frameWidth(),
          })
        settleTo(commit ? direction : null)
      }}
      onPointerCancel={(event) => {
        const active = pointerRef.current
        if (!active || active.pointerId !== event.pointerId) return
        active.intent.cancel()
        pointerRef.current = null
        releasePointer(event)
        if (motionRef.current.kind === 'dragging') settleTo(null)
      }}
      onClickCapture={(event) => {
        if (!suppressClickRef.current) return
        event.preventDefault()
        event.stopPropagation()
        suppressClickRef.current = false
      }}
    >
      <div className="daily-plan-swipe-viewport">
        <div
          className="daily-plan-swipe-track"
          onTransitionEnd={(event) => {
            if (
              event.target === event.currentTarget &&
              event.propertyName === 'transform'
            ) {
              completeSettling()
            }
          }}
        >
          <div className="daily-plan-swipe-preview" aria-hidden="true" inert>
            {motion.kind === 'idle' ? null : previous}
          </div>
          <div className="daily-plan-swipe-current">{children}</div>
          <div className="daily-plan-swipe-preview" aria-hidden="true" inert>
            {motion.kind === 'idle' ? null : next}
          </div>
        </div>
      </div>

      {!disabled && canGoPrevious ? (
        <button
          className="daily-plan-day-button daily-plan-day-button-previous"
          type="button"
          aria-label="前の日"
          onClick={() => settleTo(-1)}
        >
          <span aria-hidden="true">&lt;</span>
        </button>
      ) : null}
      {!disabled && canGoNext ? (
        <button
          className="daily-plan-day-button daily-plan-day-button-next"
          type="button"
          aria-label="次の日"
          onClick={() => settleTo(1)}
        >
          <span aria-hidden="true">&gt;</span>
        </button>
      ) : null}
    </div>
  )
}
