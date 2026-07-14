import { describe, expect, it } from 'vitest'
import {
  projectTimetableSlot,
  type TimetableReplacement,
} from './timetableProjection'

describe('Timetable Projection', () => {
  it('selects the track Standard Timetable value and applies narrower active layers', () => {
    expect(projectTimetableSlot({
      standardTimetable: {
        type: 'candidates',
        selectedTrackId: 'science',
        candidates: [
          { trackId: null, lessonName: '英語' },
          { trackId: 'science', lessonName: '物理' },
          { trackId: 'humanities', lessonName: '古典' },
        ],
      },
      activeLayers: [
        {
          targetScopeType: 'track',
          replacement: { type: 'lesson_name', lessonName: '化学' },
        },
        {
          targetScopeType: 'grade',
          replacement: { type: 'lesson_name', lessonName: '体育' },
        },
      ],
      resolveReference: () => null,
    })).toEqual({
      standardTimetable: { lessonName: '物理' },
      layers: [
        {
          targetScopeType: 'grade',
          state: 'active',
          origin: 'active',
          replacement: { type: 'lesson_name', lessonName: '体育' },
        },
        { targetScopeType: 'class', state: 'unchanged' },
        {
          targetScopeType: 'track',
          state: 'active',
          origin: 'active',
          replacement: { type: 'lesson_name', lessonName: '化学' },
        },
        { targetScopeType: 'student', state: 'unchanged' },
      ],
      finalDailyLesson: {
        lessonName: '化学',
        timetableChangeState: 'resolved',
      },
    })
  })

  it.each([
    {
      candidates: [
        { trackId: null, lessonName: '英語' },
        { trackId: 'humanities', lessonName: '古典' },
      ],
      expected: { lessonName: '英語' },
    },
    {
      candidates: [{ trackId: 'humanities', lessonName: '古典' }],
      expected: null,
    },
    {
      candidates: [
        { trackId: null, lessonName: '英語' },
        { trackId: 'science', lessonName: '' },
      ],
      expected: { lessonName: '英語' },
    },
    {
      candidates: [{ trackId: null, lessonName: '' }],
      expected: null,
    },
  ])('falls back from the selected track to the class-common value or no lesson', ({
    candidates,
    expected,
  }) => {
    const projection = projectTimetableSlot({
      standardTimetable: {
        type: 'candidates',
        selectedTrackId: 'science',
        candidates,
      },
      activeLayers: [],
      resolveReference: () => null,
    })

    expect(projection.standardTimetable).toEqual(expected)
    expect(projection.finalDailyLesson).toEqual({
      lessonName: expected?.lessonName ?? '',
      timetableChangeState: 'unchanged',
    })
  })

  it('overlays desired replacements and removals while preserving their origin', () => {
    const result = projectTimetableSlot({
      standardTimetable: { type: 'selected', lessonName: '英語' },
      activeLayers: [
        {
          targetScopeType: 'grade',
          replacement: { type: 'lesson_name', lessonName: '体育' },
        },
        {
          targetScopeType: 'track',
          replacement: { type: 'lesson_name', lessonName: '物理' },
        },
      ],
      desiredLayers: [
        {
          targetScopeType: 'class',
          change: 'replace',
          replacement: { type: 'lesson_name', lessonName: '化学' },
        },
        { targetScopeType: 'track', change: 'remove' },
      ],
      resolveReference: () => null,
    })

    expect(result.layers).toEqual([
      {
        targetScopeType: 'grade',
        state: 'active',
        origin: 'active',
        replacement: { type: 'lesson_name', lessonName: '体育' },
      },
      {
        targetScopeType: 'class',
        state: 'active',
        origin: 'desired',
        replacement: { type: 'lesson_name', lessonName: '化学' },
      },
      {
        targetScopeType: 'track',
        state: 'unchanged',
        origin: 'desired',
        desiredChange: 'remove',
      },
      { targetScopeType: 'student', state: 'unchanged' },
    ])
    expect(result.finalDailyLesson).toEqual({
      lessonName: '化学',
      timetableChangeState: 'resolved',
    })
  })

  it.each<{
    replacement: TimetableReplacement
    resolvedReference: string | null
    expected: { lessonName: string; timetableChangeState: string }
  }>([
    {
      replacement: { type: 'lesson_name', lessonName: '学年行事' },
      resolvedReference: null,
      expected: { lessonName: '学年行事', timetableChangeState: 'resolved' },
    },
    {
      replacement: { type: 'cancelled' },
      resolvedReference: null,
      expected: { lessonName: '', timetableChangeState: 'cancelled' },
    },
    {
      replacement: { type: 'period_reference', weekday: 1, periodNumber: 2 },
      resolvedReference: '古典',
      expected: { lessonName: '古典', timetableChangeState: 'resolved' },
    },
    {
      replacement: {
        type: 'floating_lesson_reference',
        floatingLessonReferenceLabelId: 'star',
      },
      resolvedReference: '自走',
      expected: { lessonName: '自走', timetableChangeState: 'resolved' },
    },
    {
      replacement: { type: 'period_reference', weekday: 7, periodNumber: 7 },
      resolvedReference: null,
      expected: { lessonName: '', timetableChangeState: 'cancelled' },
    },
    {
      replacement: {
        type: 'floating_lesson_reference',
        floatingLessonReferenceLabelId: 'unknown',
      },
      resolvedReference: null,
      expected: { lessonName: 'エラー', timetableChangeState: 'unresolved-reference' },
    },
  ])('resolves $replacement.type into the final Daily Lesson', ({
    replacement,
    resolvedReference,
    expected,
  }) => {
    const result = projectTimetableSlot({
      standardTimetable: null,
      activeLayers: [{ targetScopeType: 'grade', replacement }],
      resolveReference: () => resolvedReference,
    })

    expect(result.finalDailyLesson).toEqual(expected)
  })
})
