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
          effectiveLessonName: '体育',
          effectiveLessonSource: null,
        },
        {
          targetScopeType: 'class',
          state: 'unchanged',
          effectiveLessonName: '体育',
          effectiveLessonSource: null,
        },
        {
          targetScopeType: 'track',
          state: 'active',
          origin: 'active',
          replacement: { type: 'lesson_name', lessonName: '化学' },
          effectiveLessonName: '化学',
          effectiveLessonSource: null,
        },
        {
          targetScopeType: 'student',
          state: 'unchanged',
          effectiveLessonName: '化学',
          effectiveLessonSource: null,
        },
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
        effectiveLessonName: '体育',
        effectiveLessonSource: null,
      },
      {
        targetScopeType: 'class',
        state: 'active',
        origin: 'desired',
        replacement: { type: 'lesson_name', lessonName: '化学' },
        effectiveLessonName: '化学',
        effectiveLessonSource: null,
      },
      {
        targetScopeType: 'track',
        state: 'unchanged',
        origin: 'desired',
        desiredChange: 'remove',
        effectiveLessonName: '化学',
        effectiveLessonSource: null,
      },
      {
        targetScopeType: 'student',
        state: 'unchanged',
        effectiveLessonName: '化学',
        effectiveLessonSource: null,
      },
    ])
    expect(result.finalDailyLesson).toEqual({
      lessonName: '化学',
      timetableChangeState: 'resolved',
    })
  })

  it('keeps each layer effective lesson and its non-custom source in broad-to-narrow order', () => {
    const result = projectTimetableSlot({
      standardTimetable: {
        type: 'selected',
        lessonName: '数学',
        source: { type: 'period_reference', weekday: 1, periodNumber: 1 },
      },
      activeLayers: [
        {
          targetScopeType: 'grade',
          replacement: { type: 'period_reference', weekday: 1, periodNumber: 2 },
        },
        {
          targetScopeType: 'class',
          replacement: {
            type: 'floating_lesson_reference',
            floatingLessonReferenceLabelId: 'star',
            referenceLabel: '★',
          },
        },
        {
          targetScopeType: 'track',
          replacement: { type: 'lesson_name', lessonName: '英語' },
        },
      ],
      desiredLayers: [{ targetScopeType: 'student', change: 'remove' }],
      resolveReference: (reference) =>
        reference.type === 'period_reference' ? '英語' : '英語',
    })

    expect(result.standardTimetable).toEqual({
      lessonName: '数学',
      source: { type: 'period_reference', weekday: 1, periodNumber: 1 },
    })
    expect(result.layers).toEqual([
      {
        targetScopeType: 'grade',
        state: 'active',
        origin: 'active',
        replacement: { type: 'period_reference', weekday: 1, periodNumber: 2 },
        effectiveLessonName: '英語',
        effectiveLessonSource: {
          type: 'period_reference',
          weekday: 1,
          periodNumber: 2,
        },
      },
      {
        targetScopeType: 'class',
        state: 'active',
        origin: 'active',
        replacement: {
          type: 'floating_lesson_reference',
          floatingLessonReferenceLabelId: 'star',
          referenceLabel: '★',
        },
        effectiveLessonName: '英語',
        effectiveLessonSource: {
          type: 'floating_lesson_reference',
          referenceLabel: '★',
        },
      },
      {
        targetScopeType: 'track',
        state: 'active',
        origin: 'active',
        replacement: { type: 'lesson_name', lessonName: '英語' },
        effectiveLessonName: '英語',
        effectiveLessonSource: null,
      },
      {
        targetScopeType: 'student',
        state: 'unchanged',
        origin: 'desired',
        desiredChange: 'remove',
        effectiveLessonName: '英語',
        effectiveLessonSource: null,
      },
    ])
    expect(result.finalDailyLesson).toEqual({
      lessonName: '英語',
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
