export type TouchGestureIntent = 'pending' | 'horizontal' | 'vertical'

export type TouchGesturePoint = {
  x: number
  y: number
  time: number
}

export type TouchGestureSnapshot = {
  intent: TouchGestureIntent
  deltaX: number
  deltaY: number
  velocityX: number
}

type ActiveGesture = {
  start: TouchGesturePoint
  points: TouchGesturePoint[]
  intent: TouchGestureIntent
}

const TOUCH_SLOP_PX = 10
const VERTICAL_LOCK_RATIO = 1.5
const VELOCITY_WINDOW_MS = 80
const FLING_MIN_DISTANCE_PX = 32
const FLING_MIN_VELOCITY_PX_PER_MS = 0.55
const DISTANCE_COMMIT_VIEWPORT_RATIO = 0.25

export function createTouchGestureIntent() {
  let active: ActiveGesture | null = null

  function start(point: TouchGesturePoint) {
    active = {
      start: point,
      points: [point],
      intent: 'pending',
    }
  }

  function snapshot(): TouchGestureSnapshot {
    if (!active) {
      return { intent: 'pending', deltaX: 0, deltaY: 0, velocityX: 0 }
    }
    const latest = active.points.at(-1) ?? active.start
    const velocityStart = [...active.points].reverse().find(
      (point) => latest.time - point.time >= VELOCITY_WINDOW_MS,
    ) ?? active.points[0]
    const velocityDuration = latest.time - velocityStart.time

    return {
      intent: active.intent,
      deltaX: latest.x - active.start.x,
      deltaY: latest.y - active.start.y,
      velocityX: velocityDuration > 0
        ? (latest.x - velocityStart.x) / velocityDuration
        : 0,
    }
  }

  function move(point: TouchGesturePoint) {
    if (!active) return snapshot()
    const previous = active.points.at(-1)
    if (
      !previous ||
      previous.x !== point.x ||
      previous.y !== point.y ||
      previous.time !== point.time
    ) {
      active.points.push(point)
    }

    if (active.intent !== 'pending') return snapshot()

    const deltaX = point.x - active.start.x
    const deltaY = point.y - active.start.y
    const horizontalDistance = Math.abs(deltaX)
    const verticalDistance = Math.abs(deltaY)
    if (
      Math.max(horizontalDistance, verticalDistance) < TOUCH_SLOP_PX
    ) {
      return snapshot()
    }

    if (
      verticalDistance > horizontalDistance * VERTICAL_LOCK_RATIO
    ) {
      active.intent = 'vertical'
    } else {
      active.intent = 'horizontal'
    }

    return snapshot()
  }

  function finish(point: TouchGesturePoint) {
    const result = move(point)
    active = null
    return result
  }

  function cancel() {
    active = null
  }

  return { start, move, finish, cancel }
}

export function moveTouchGestureFromPointerEvent(
  gesture: ReturnType<typeof createTouchGestureIntent>,
  event: PointerEvent,
) {
  const coalescedEvents = event.getCoalescedEvents?.() ?? []
  const points = coalescedEvents.length > 0
    ? [...coalescedEvents, event]
    : [event]
  let latest: TouchGestureSnapshot | null = null
  for (const point of points) {
    latest = gesture.move({
      x: point.clientX,
      y: point.clientY,
      time: point.timeStamp,
    })
  }
  return latest!
}

export function installHorizontalTouchScrollLock(
  target: HTMLElement,
  canStart: (event: TouchEvent) => boolean,
) {
  // PointerEvent cancellation cannot stop pan-y arbitration. Claim the first
  // horizontal touchmove before the browser suppresses the pointer stream.
  let gesture: ReturnType<typeof createTouchGestureIntent> | null = null

  function pointFrom(event: TouchEvent) {
    if (event.touches.length !== 1) return null
    const touch = event.touches[0]
    return {
      x: touch.clientX,
      y: touch.clientY,
      time: event.timeStamp,
    }
  }

  function start(event: TouchEvent) {
    const point = pointFrom(event)
    if (!point || !canStart(event)) {
      finish()
      return
    }
    gesture = createTouchGestureIntent()
    gesture.start(point)
    target.addEventListener('touchmove', move, { passive: false })
  }

  function move(event: TouchEvent) {
    const point = pointFrom(event)
    if (!gesture || !point) {
      gesture?.cancel()
      gesture = null
      return
    }
    const intent = gesture.move(point).intent
    if (intent === 'horizontal' && event.cancelable) {
      event.preventDefault()
    } else if (intent === 'vertical') {
      finish()
    }
  }

  function finish() {
    gesture?.cancel()
    gesture = null
    target.removeEventListener('touchmove', move)
  }

  target.addEventListener('touchstart', start, { passive: true })
  target.addEventListener('touchend', finish, { passive: true })
  target.addEventListener('touchcancel', finish, { passive: true })

  return () => {
    target.removeEventListener('touchstart', start)
    finish()
    target.removeEventListener('touchend', finish)
    target.removeEventListener('touchcancel', finish)
  }
}

export function releasePointerCapture(
  target: Element,
  pointerId: number,
) {
  try {
    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId)
    }
  } catch {
    // Synthetic browser-test pointers are not registered with pointer capture.
  }
}

export function shouldCommitHorizontalSwipe({
  deltaX,
  velocityX,
  viewportWidth,
}: {
  deltaX: number
  velocityX: number
  viewportWidth: number
}) {
  const distanceCommit =
    Math.abs(deltaX) >= viewportWidth * DISTANCE_COMMIT_VIEWPORT_RATIO
  const flingCommit =
    Math.abs(deltaX) >= FLING_MIN_DISTANCE_PX &&
    Math.abs(velocityX) >= FLING_MIN_VELOCITY_PX_PER_MS &&
    Math.sign(deltaX) === Math.sign(velocityX)

  return distanceCommit || flingCommit
}
