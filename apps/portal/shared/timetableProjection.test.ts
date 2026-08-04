import { describe, expect, it } from 'vitest'
import {
  previewTimetableProjection,
  type DisplayTimetableReplacement,
  type TimetableProjection,
  type TimetableReferenceCatalog,
  type TimetableReplacement,
} from './timetableProjection'

const emptyCatalog: TimetableReferenceCatalog = {
  periodReferences: [],
  floatingLessonReferences: [],
}

describe('Timetable Projection preview', () => {
  it('keeps active and desired Timetable Layer states distinct', () => {
    const activeProjection: TimetableProjection = {
      ...emptyProjection(),
      layers: [
        activeLayer('grade', { type: 'lesson_name', lessonName: '体育' }),
        unchangedLayer('class'),
        activeLayer('track', { type: 'lesson_name', lessonName: '物理' }),
        unchangedLayer('student'),
      ],
      finalDailyLesson: {
        lessonName: '物理',
        timetableChangeState: 'resolved',
      },
    }

    const result = previewTimetableProjection({
      activeProjection,
      desiredLayers: [
        {
          targetScopeType: 'class',
          change: 'replace',
          replacement: {
            type: 'period_reference',
            weekday: 1,
            periodNumber: 2,
          },
        },
        { targetScopeType: 'track', change: 'remove' },
      ],
      referenceCatalog: {
        periodReferences: [
          { weekday: 1, periodNumber: 2, lessonName: '化学' },
        ],
        floatingLessonReferences: [],
      },
    })

    expect(result.layers[1]).toEqual({
      targetScopeType: 'class',
      active: null,
      desired: {
        targetScopeType: 'class',
        change: 'replace',
        replacement: {
          type: 'period_reference',
          weekday: 1,
          periodNumber: 2,
        },
      },
      projected: {
        state: 'active',
        replacement: {
          type: 'period_reference',
          weekday: 1,
          periodNumber: 2,
        },
      },
    })
    expect(result.layers[2]).toEqual({
      ...activeProjection.layers[2],
      desired: { targetScopeType: 'track', change: 'remove' },
      projected: { state: 'unchanged' },
    })
    expect(result.finalDailyLesson).toEqual({
      lessonName: '化学',
      lessonReference: {
        type: 'period_reference',
        weekday: 1,
        periodNumber: 2,
      },
      timetableChangeState: 'resolved',
    })
  })

  it.each<{
    label: string
    replacement: TimetableReplacement
    referenceCatalog: TimetableReferenceCatalog
    expected: TimetableProjection['finalDailyLesson']
  }>([
    {
      label: 'direct Lesson Name',
      replacement: { type: 'lesson_name', lessonName: '学年行事' },
      referenceCatalog: emptyCatalog,
      expected: { lessonName: '学年行事', timetableChangeState: 'resolved' },
    },
    {
      label: 'cancelled lesson',
      replacement: { type: 'cancelled' },
      referenceCatalog: emptyCatalog,
      expected: { lessonName: '', timetableChangeState: 'cancelled' },
    },
    {
      label: 'resolved Period Reference',
      replacement: { type: 'period_reference', weekday: 1, periodNumber: 2 },
      referenceCatalog: {
        periodReferences: [
          { weekday: 1, periodNumber: 2, lessonName: '古典' },
        ],
        floatingLessonReferences: [],
      },
      expected: {
        lessonName: '古典',
        lessonReference: {
          type: 'period_reference',
          weekday: 1,
          periodNumber: 2,
        },
        timetableChangeState: 'resolved',
      },
    },
    {
      label: 'empty Period Reference',
      replacement: { type: 'period_reference', weekday: 6, periodNumber: 7 },
      referenceCatalog: emptyCatalog,
      expected: {
        lessonName: '',
        lessonReference: {
          type: 'period_reference',
          weekday: 6,
          periodNumber: 7,
        },
        timetableChangeState: 'cancelled',
      },
    },
    {
      label: 'resolved Floating Lesson Reference',
      replacement: {
        type: 'floating_lesson_reference',
        floatingLessonReferenceLabelId: 'star',
      },
      referenceCatalog: {
        periodReferences: [],
        floatingLessonReferences: [{
          floatingLessonReferenceLabelId: 'star',
          referenceLabel: '★',
          lessonName: '自走',
        }],
      },
      expected: {
        lessonName: '自走',
        lessonReference: {
          type: 'floating_lesson_reference',
          floatingLessonReferenceLabelId: 'star',
          referenceLabel: '★',
        },
        timetableChangeState: 'resolved',
      },
    },
    {
      label: 'unresolved Floating Lesson Reference',
      replacement: {
        type: 'floating_lesson_reference',
        floatingLessonReferenceLabelId: 'unknown',
        referenceLabel: '☆',
      },
      referenceCatalog: emptyCatalog,
      expected: {
        lessonName: 'エラー',
        lessonReference: {
          type: 'floating_lesson_reference',
          floatingLessonReferenceLabelId: 'unknown',
          referenceLabel: '☆',
        },
        timetableChangeState: 'unresolved-reference',
      },
    },
  ])('projects a desired $label', ({
    replacement,
    referenceCatalog,
    expected,
  }) => {
    expect(previewTimetableProjection({
      activeProjection: emptyProjection(),
      desiredLayers: [{
        targetScopeType: 'grade',
        change: 'replace',
        replacement,
      }],
      referenceCatalog,
    }).finalDailyLesson).toEqual(expected)
  })

  it('rejects duplicate desired Timetable Layers', () => {
    expect(() => previewTimetableProjection({
      activeProjection: emptyProjection(),
      desiredLayers: [
        {
          targetScopeType: 'class',
          change: 'replace',
          replacement: { type: 'lesson_name', lessonName: '化学' },
        },
        { targetScopeType: 'class', change: 'remove' },
      ],
      referenceCatalog: emptyCatalog,
    })).toThrow('duplicate desired layers')
  })

  it('rejects an invalid desired Period Reference', () => {
    expect(() => previewTimetableProjection({
      activeProjection: emptyProjection(),
      desiredLayers: [{
        targetScopeType: 'class',
        change: 'replace',
        replacement: {
          type: 'period_reference',
          weekday: 1,
          periodNumber: 8,
        },
      }],
      referenceCatalog: emptyCatalog,
    })).toThrow('invalid Period Reference')
  })
})

function emptyProjection(): TimetableProjection {
  return {
    schoolDate: '2026-07-06',
    periodNumber: 1,
    standardTimetable: {
      lessonName: '英語',
      periodReference: { weekday: 1, periodNumber: 1 },
    },
    layers: [
      unchangedLayer('grade'),
      unchangedLayer('class'),
      unchangedLayer('track'),
      unchangedLayer('student'),
    ],
    finalDailyLesson: {
      lessonName: '英語',
      lessonReference: {
        type: 'period_reference',
        weekday: 1,
        periodNumber: 1,
      },
      timetableChangeState: 'unchanged',
    },
  }
}

function activeLayer(
  targetScopeType: 'grade' | 'class' | 'track' | 'student',
  replacement: DisplayTimetableReplacement,
): TimetableProjection['layers'][number] {
  return {
    targetScopeType,
    active: {
      targetScopeType,
      sharedInformationItemId: `${targetScopeType}-item`,
      latestChangeId: `${targetScopeType}-change`,
      replacement,
      changedAt: 1,
    },
    desired: null,
    projected: { state: 'active', replacement },
  }
}

function unchangedLayer(
  targetScopeType: 'grade' | 'class' | 'track' | 'student',
): TimetableProjection['layers'][number] {
  return {
    targetScopeType,
    active: null,
    desired: null,
    projected: { state: 'unchanged' },
  }
}
