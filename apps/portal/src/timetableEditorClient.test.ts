import { describe, expect, it } from 'vitest'
import {
  createTimetableEditorClient,
  normalizeDirectLessonReplacement,
} from './timetableEditorClient'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
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

  it('keeps per-scope drafts across dates and restores them in the same session', () => {
    const storage = memoryStorage()
    let nextId = 0
    const createClient = () =>
      createTimetableEditorClient({
        storage,
        createId: () => `00000000-0000-4000-8000-${String(++nextId).padStart(12, '0')}`,
      })
    const editor = createClient()

    editor.enterEditing()
    editor.saveDraft({
      targetScopeType: 'class',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'lesson_name', lessonName: '特別授業' },
    })
    editor.saveDraft({
      targetScopeType: 'student',
      changeDate: '2026-07-11',
      periodNumber: 2,
      replacement: { type: 'cancelled' },
    })

    expect(editor.getSnapshot()).toMatchObject({
      editing: true,
      lastTargetScopeType: 'student',
      draftDates: ['2026-07-10', '2026-07-11'],
    })
    expect(editor.isLessonEdited('2026-07-10', 2)).toBe(true)
    expect(editor.toCommitPayload().changes).toHaveLength(2)

    const restored = createClient()
    expect(restored.getSnapshot()).toMatchObject({
      editing: true,
      lastTargetScopeType: 'student',
      draftDates: ['2026-07-10', '2026-07-11'],
    })
  })

  it('replaces the same draft key, preserves its id, and clears storage after success', () => {
    const storage = memoryStorage()
    const editor = createTimetableEditorClient({
      storage,
      createId: () => 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    })
    editor.enterEditing()
    const sourceId = editor.saveDraft({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 1,
      replacement: { type: 'lesson_name', lessonName: '最初' },
    })
    const replacedId = editor.saveDraft({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 1,
      replacement: { type: 'cancelled' },
    })
    expect(replacedId).toBe(sourceId)
    expect(editor.getSnapshot().drafts).toHaveLength(1)
    expect(editor.shouldConfirmExit()).toBe(true)

    editor.commitSucceeded()
    expect(editor.getSnapshot()).toMatchObject({ editing: false, drafts: [] })
    expect(createTimetableEditorClient({ storage }).getSnapshot().drafts).toEqual([])
  })

  it('keeps failed payloads, supports per-scope same-slot drafts, moves markers, and discards cleanly', () => {
    const storage = memoryStorage()
    let id = 0
    const editor = createTimetableEditorClient({
      storage,
      createId: () => `f1111111-1111-4111-8111-${String(++id).padStart(12, '0')}`,
    })
    editor.enterEditing()
    expect(editor.shouldConfirmExit()).toBe(false)
    const trackId = editor.saveDraft({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 1,
      replacement: { type: 'lesson_name', lessonName: 'Track' },
    })
    editor.saveDraft({
      targetScopeType: 'student',
      changeDate: '2026-07-10',
      periodNumber: 1,
      replacement: { type: 'cancelled' },
    })
    expect(editor.toCommitPayload().changes).toHaveLength(2)

    editor.saveDraft(
      {
        targetScopeType: 'track',
        changeDate: '2026-07-11',
        periodNumber: 3,
        replacement: { type: 'lesson_name', lessonName: 'Moved' },
      },
      trackId,
    )
    expect(editor.isLessonEdited('2026-07-10', 1)).toBe(true)
    expect(editor.isLessonEdited('2026-07-11', 3)).toBe(true)
    expect(editor.getSnapshot().draftDates).toEqual(['2026-07-10', '2026-07-11'])

    editor.discard()
    expect(editor.getSnapshot()).toMatchObject({ editing: false, drafts: [] })
    expect(createTimetableEditorClient({ storage }).getSnapshot().drafts).toEqual([])
  })
})
