import { describe, expect, it } from 'vitest'
import {
  createTimetableEditorClient,
  normalizeDirectLessonReplacement,
  type TimetableLayerState,
} from './timetableEditorClient'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    values,
  }
}

function layerState(
  layers: TimetableLayerState['layers'] = [
    { targetScopeType: 'grade', state: 'unchanged' },
    { targetScopeType: 'class', state: 'unchanged' },
    { targetScopeType: 'track', state: 'unchanged' },
    { targetScopeType: 'student', state: 'unchanged' },
  ],
): TimetableLayerState {
  return {
    status: 'ready',
    schoolDate: '2026-07-10',
    periodNumber: 2,
    standardTimetable: {
      periodReference: { weekday: 5, periodNumber: 2 },
      lessonName: '数学',
    },
    layers,
    finalDailyLesson: {
      lessonName: '数学',
      timetableChangeState: 'unchanged',
    },
  }
}

describe('Timetable editor client', () => {
  it('converts only an exact Japanese Period Reference entered as a Lesson Name', () => {
    expect(normalizeDirectLessonReplacement(' 月 1 ')).toEqual({
      type: 'period_reference',
      weekday: 1,
      periodNumber: 1,
    })
    expect(normalizeDirectLessonReplacement('月1補講')).toEqual({
      type: 'lesson_name',
      lessonName: '月1補講',
    })
  })

  it('stores one desired state per Target Scope, Change Date, and period', () => {
    let id = 0
    const editor = createTimetableEditorClient({
      storage: memoryStorage(),
      createId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`,
    })
    editor.reconcileLayerState(layerState())

    const first = editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'lesson_name', lessonName: '英語' },
    })
    const replaced = editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'cancelled' },
    })

    expect(first).toMatchObject({ status: 'saved' })
    expect(replaced).toEqual(first)
    expect(editor.getSnapshot()).toMatchObject({
      draftCount: 1,
      draftDates: ['2026-07-10'],
    })
    expect(editor.findDraft('track', '2026-07-10', 2)?.replacement).toEqual({
      type: 'cancelled',
    })
  })

  it('removes a no-op desired state when an empty layer returns to server state', () => {
    const editor = createTimetableEditorClient({ storage: memoryStorage() })
    editor.reconcileLayerState(layerState())
    editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'cancelled' },
    })

    expect(
      editor.restoreServerState('track', '2026-07-10', 2),
    ).toEqual({ status: 'removed-noop' })
    expect(editor.getSnapshot().drafts).toEqual([])
  })

  it('rejects desired additions for an occupied server layer', () => {
    const editor = createTimetableEditorClient({ storage: memoryStorage() })
    editor.reconcileLayerState(
      layerState([
        { targetScopeType: 'grade', state: 'unchanged' },
        { targetScopeType: 'class', state: 'unchanged' },
        {
          targetScopeType: 'track',
          state: 'active',
          sharedInformationItemId: 'item-1',
          latestChangeId: 'change-1',
          replacement: { type: 'lesson_name', lessonName: '物理' },
          changedAt: 1,
        },
        { targetScopeType: 'student', state: 'unchanged' },
      ]),
    )

    expect(
      editor.setDesiredState({
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 2,
        replacement: { type: 'cancelled' },
      }),
    ).toEqual({ status: 'active-layer' })
    expect(editor.getSnapshot().drafts).toEqual([])
  })

  it('previews desired layers and final Daily Lesson from server layers plus drafts', () => {
    const editor = createTimetableEditorClient({ storage: memoryStorage() })
    const server = layerState([
      {
        targetScopeType: 'grade',
        state: 'active',
        sharedInformationItemId: 'grade-item',
        latestChangeId: 'grade-change',
        replacement: { type: 'lesson_name', lessonName: '体育' },
        changedAt: 1,
      },
      { targetScopeType: 'class', state: 'unchanged' },
      { targetScopeType: 'track', state: 'unchanged' },
      { targetScopeType: 'student', state: 'unchanged' },
    ])
    editor.reconcileLayerState(server)
    editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'period_reference', weekday: 1, periodNumber: 3 },
    })

    expect(
      editor.previewLayerState(server, (replacement) =>
        replacement.type === 'period_reference' ? '化学' : null,
      ),
    ).toMatchObject({
      layers: [
        { targetScopeType: 'grade', desired: false, replacement: { lessonName: '体育' } },
        { targetScopeType: 'class', desired: false },
        { targetScopeType: 'track', desired: true, replacement: { weekday: 1 } },
        { targetScopeType: 'student', desired: false },
      ],
      finalDailyLesson: { lessonName: '化学', timetableChangeState: 'resolved' },
    })
  })

  it('persists only safe draft data, restores it, cancels one draft, and retains drafts after failure', () => {
    const storage = memoryStorage()
    const editor = createTimetableEditorClient({ storage })
    editor.reconcileLayerState(layerState())
    editor.setDesiredState({
      targetScopeType: 'student',
      changeDate: '2026-07-11',
      periodNumber: 4,
      replacement: { type: 'lesson_name', lessonName: '面談' },
    })
    editor.commitFailed()
    expect(editor.getSnapshot()).toMatchObject({
      draftCount: 1,
      lastCommitFailed: true,
    })

    const persisted = [...storage.values.values()].join('')
    expect(persisted).not.toContain('displayName')
    expect(persisted).not.toContain('history')
    const restored = createTimetableEditorClient({ storage })
    expect(restored.getSnapshot()).toMatchObject({
      draftCount: 1,
      draftDates: ['2026-07-11'],
    })

    restored.restoreServerState('student', '2026-07-11', 4)
    expect(restored.getSnapshot()).toMatchObject({ draftCount: 0, draftDates: [] })
  })

  it('limits new draft keys to 50 while allowing replacement and cancellation', () => {
    const editor = createTimetableEditorClient({ storage: memoryStorage() })
    for (let index = 0; index < 50; index += 1) {
      expect(
        editor.setDesiredState({
          targetScopeType: 'track',
          changeDate: `2026-08-${String(index + 1).padStart(2, '0')}`,
          periodNumber: 1,
          replacement: { type: 'lesson_name', lessonName: `授業${index + 1}` },
        }).status,
      ).toBe('saved')
    }
    expect(editor.getSnapshot()).toMatchObject({ draftCount: 50, atLimit: true })
    expect(
      editor.setDesiredState({
        targetScopeType: 'student',
        changeDate: '2026-10-01',
        periodNumber: 1,
        replacement: { type: 'cancelled' },
      }),
    ).toEqual({ status: 'limit-reached' })
    expect(
      editor.setDesiredState({
        targetScopeType: 'track',
        changeDate: '2026-08-01',
        periodNumber: 1,
        replacement: { type: 'cancelled' },
      }).status,
    ).toBe('saved')
    editor.restoreServerState('track', '2026-08-02', 1)
    expect(editor.getSnapshot()).toMatchObject({ draftCount: 49, atLimit: false })
  })
})
