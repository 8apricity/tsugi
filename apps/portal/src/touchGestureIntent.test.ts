import { describe, expect, it } from 'vitest'
import {
  createTouchGestureIntent,
  shouldCommitHorizontalSwipe,
} from './touchGestureIntent'

describe('touch gesture intent', () => {
  it('keeps small finger movement pending', () => {
    const gesture = createTouchGestureIntent()

    gesture.start({ x: 100, y: 200, time: 0 })

    expect(gesture.move({ x: 106, y: 204, time: 16 }).intent).toBe('pending')
    expect(gesture.move({ x: 103, y: 207, time: 32 }).intent).toBe('pending')
  })

  it('locks a clearly vertical movement as scrolling after touch slop', () => {
    const gesture = createTouchGestureIntent()

    gesture.start({ x: 100, y: 100, time: 0 })

    expect(gesture.move({ x: 103, y: 108, time: 12 }).intent).toBe('pending')
    expect(gesture.move({ x: 104, y: 114, time: 24 }).intent).toBe('vertical')
  })

  it('locks horizontal movement immediately after touch slop', () => {
    const gesture = createTouchGestureIntent()

    gesture.start({ x: 100, y: 100, time: 0 })

    expect(gesture.move({ x: 108, y: 102, time: 16 }).intent).toBe('pending')
    expect(gesture.move({ x: 114, y: 103, time: 32 }).intent).toBe('horizontal')
  })

  it('treats a steep diagonal movement as a horizontal swipe', () => {
    const gesture = createTouchGestureIntent()

    gesture.start({ x: 100, y: 100, time: 0 })

    expect(gesture.move({ x: 118, y: 126, time: 16 }).intent).toBe('horizontal')
  })

  it('does not reverse an established direction lock', () => {
    const gesture = createTouchGestureIntent()

    gesture.start({ x: 100, y: 100, time: 0 })
    gesture.move({ x: 114, y: 103, time: 16 })

    expect(gesture.move({ x: 116, y: 180, time: 32 }).intent).toBe('horizontal')
  })
})

describe('horizontal swipe completion', () => {
  it('commits after travelling one quarter of the viewport', () => {
    expect(shouldCommitHorizontalSwipe({
      deltaX: -91,
      velocityX: -0.2,
      viewportWidth: 360,
    })).toBe(true)
  })

  it('commits a short deliberate fling', () => {
    expect(shouldCommitHorizontalSwipe({
      deltaX: -42,
      velocityX: -0.7,
      viewportWidth: 360,
    })).toBe(true)
  })

  it('rejects a short slow drag', () => {
    expect(shouldCommitHorizontalSwipe({
      deltaX: -42,
      velocityX: -0.2,
      viewportWidth: 360,
    })).toBe(false)
  })
})
