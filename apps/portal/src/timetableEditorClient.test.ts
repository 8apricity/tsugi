import { describe, expect, it } from 'vitest'
import {
  createNewNoteDraftForm,
  createNewTaskDraftForm,
  createSharedInformationEditorClient as createEditorClient,
  normalizeDirectLessonReplacement,
  type DirectTimetableSubmissionTransportResult,
  type TimetableLayerState,
} from './sharedInformationEditorClient'
import {
  createSharedInformationDirectChangeTransport,
} from './sharedInformationSubmissionTransport'

type EditorOptions = Omit<
  Parameters<typeof createEditorClient>[0],
  'submitDirectTimetableChanges'
> & {
  submitDirectTimetableChanges?: Parameters<
    typeof createEditorClient
  >[0]['submitDirectTimetableChanges']
}

function createTimetableEditorClient(options: EditorOptions) {
  return createEditorClient({
    submitDirectTimetableChanges: async () => ({ status: 'rejected' }),
    ...options,
  })
}

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

describe('Shared Information editor client', () => {
  it('pauses editing without deleting drafts and restores the paused state', () => {
    const storage = memoryStorage()
    const editor = createTimetableEditorClient({ storage })

    editor.saveTaskDraft({
      title: '持ち越す下書き',
      dueDate: '2026-07-10',
      relatedLessonName: null,
      targetScopeType: 'track',
    })
    expect(editor.getSnapshot()).toMatchObject({ editing: true, draftCount: 1 })
    expect(editor.exitEditing()).toEqual({ status: 'paused' })
    expect(editor.getSnapshot()).toMatchObject({ editing: false, draftCount: 1 })

    const restored = createTimetableEditorClient({ storage })
    expect(restored.getSnapshot()).toMatchObject({
      editing: false,
      draftCount: 1,
      taskDrafts: [{ title: '持ち越す下書き' }],
    })
    expect(restored.enterEditing()).toEqual({ status: 'editing' })
    expect(restored.getSnapshot().draftCount).toBe(1)
  })

  it('saves multiple Daily Lesson Notes without a Timetable Change and inherits the dialog context', () => {
    const ids = [
      '33000000-0000-4000-8000-000000000001',
      '33000000-0000-4000-8000-000000000002',
    ]
    const storage = memoryStorage()
    const editor = createTimetableEditorClient({
      storage,
      createId: () => ids.shift()!,
    })

    expect(editor.saveDailyLessonDialogDraft({
      targetScopeType: 'track',
      schoolDate: '2026-07-10',
      periodNumber: 2,
      replacement: null,
      noteBodies: ['   '],
    })).toEqual({ status: 'empty' })
    expect(editor.getSnapshot()).toMatchObject({ draftCount: 0 })

    expect(editor.saveDailyLessonDialogDraft({
      targetScopeType: 'track',
      schoolDate: '2026-07-10',
      periodNumber: 2,
      replacement: null,
      noteBodies: [
        '  1件目のノート  ',
        '   ',
        '2件目のノート',
      ],
    })).toMatchObject({
      status: 'saved',
      savedNotes: 2,
      savedTimetable: false,
      noteSourceIds: [
        '33000000-0000-4000-8000-000000000001',
        '33000000-0000-4000-8000-000000000002',
      ],
    })
    expect(editor.getSnapshot()).toMatchObject({
      draftCount: 2,
      drafts: [],
      noteDrafts: [
        {
          sourceId: '33000000-0000-4000-8000-000000000001',
          changeKind: 'add',
          body: '1件目のノート',
          schoolDate: '2026-07-10',
          periodNumber: 2,
          targetScopeType: 'track',
        },
        {
          sourceId: '33000000-0000-4000-8000-000000000002',
          changeKind: 'add',
          body: '2件目のノート',
          schoolDate: '2026-07-10',
          periodNumber: 2,
          targetScopeType: 'track',
        },
      ],
    })
  })

  it('saves Timetable Change removal and Daily Lesson Notes from the same dialog', () => {
    const ids = [
      '33000000-0000-4000-8000-000000000011',
      '33000000-0000-4000-8000-000000000012',
      '33000000-0000-4000-8000-000000000013',
    ]
    const editor = createTimetableEditorClient({
      storage: memoryStorage(),
      createId: () => ids.shift()!,
    })
    editor.reconcileLayerState(layerState([{
      targetScopeType: 'track',
      state: 'active',
      sharedInformationItemId: '33000000-0000-4000-8000-000000000010',
      latestChangeId: '33000000-0000-4000-8000-000000000010:change',
      replacement: { type: 'lesson_name', lessonName: '数学' },
      changedAt: 1,
    }]))

    expect(editor.saveDailyLessonDialogDraft({
      targetScopeType: 'track',
      schoolDate: '2026-07-10',
      periodNumber: 2,
      replacement: null,
      removeTimetableChange: true,
      noteBodies: ['削除後も残る1件目', ' ', '削除後も残る2件目'],
    })).toMatchObject({
      status: 'saved',
      savedTimetable: true,
      savedNotes: 2,
      timetableSourceId: '33000000-0000-4000-8000-000000000011',
      noteSourceIds: [
        '33000000-0000-4000-8000-000000000012',
        '33000000-0000-4000-8000-000000000013',
      ],
    })
    expect(editor.getSnapshot()).toMatchObject({
      draftCount: 3,
      drafts: [{
        sourceId: '33000000-0000-4000-8000-000000000011',
        changeKind: 'remove',
        sharedInformationItemId: '33000000-0000-4000-8000-000000000010',
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 2,
      }],
      noteDrafts: [
        expect.objectContaining({
          body: '削除後も残る1件目',
          schoolDate: '2026-07-10',
          periodNumber: 2,
          targetScopeType: 'track',
        }),
        expect.objectContaining({
          body: '削除後も残る2件目',
          schoolDate: '2026-07-10',
          periodNumber: 2,
          targetScopeType: 'track',
        }),
      ],
    })
  })

  it('saves Timetable Change removal without requiring a Daily Lesson Note', () => {
    const editor = createTimetableEditorClient({
      storage: memoryStorage(),
      createId: () => '33000000-0000-4000-8000-000000000021',
    })
    editor.reconcileLayerState(layerState([{
      targetScopeType: 'class',
      state: 'active',
      sharedInformationItemId: '33000000-0000-4000-8000-000000000020',
      latestChangeId: '33000000-0000-4000-8000-000000000020:change',
      replacement: { type: 'cancelled' },
      changedAt: 1,
    }]))

    expect(editor.saveDailyLessonDialogDraft({
      targetScopeType: 'class',
      schoolDate: '2026-07-10',
      periodNumber: 2,
      replacement: null,
      removeTimetableChange: true,
      noteBodies: [' '],
    })).toMatchObject({
      status: 'saved',
      savedTimetable: true,
      savedNotes: 0,
    })
  })

  it('keeps persisted drafts inside one Student Account workspace and clears that workspace on logout', () => {
    const storage = memoryStorage()
    const editor = createTimetableEditorClient({
      storage,
      draftStorageScope: null,
    })
    editor.setDraftStorageScope('student-a')
    editor.saveTaskDraft({
      title: '提出物',
      dueDate: '2026-07-10',
      relatedLessonName: null,
      targetScopeType: 'track',
    })

    editor.setDraftStorageScope('student-b')
    expect(editor.getSnapshot()).toMatchObject({ draftCount: 0 })

    editor.setDraftStorageScope('student-a')
    expect(editor.getSnapshot()).toMatchObject({
      draftCount: 1,
      taskDrafts: [{ title: '提出物' }],
    })

    editor.reset()
    editor.setDraftStorageScope('student-b')
    editor.setDraftStorageScope('student-a')
    expect(editor.getSnapshot()).toMatchObject({ draftCount: 0 })
  })

  it('coexists Note, Task, and Timetable Change drafts in one submitted batch', async () => {
    const ids = [
      '33000000-0000-4000-8000-000000000101',
      '33000000-0000-4000-8000-000000000102',
      '33000000-0000-4000-8000-000000000103',
    ]
    const submitted: unknown[] = []
    const editor = createTimetableEditorClient({
      storage: memoryStorage(),
      createId: () => ids.shift()!,
      submitDirectTimetableChanges: async (payload) => {
        submitted.push(payload)
        return { status: 'applied' }
      },
    })

    expect(createNewTaskDraftForm('2026-07-10')).toEqual({
      title: '',
      dueDate: '2026-07-10',
      relatedLessonName: null,
      targetScopeType: null,
    })
    expect(createNewNoteDraftForm('2026-07-10')).toEqual({
      body: '',
      schoolDate: '2026-07-10',
      targetScopeType: null,
    })
    expect(editor.saveTaskDraft({
      title: '地理ワークを提出',
      dueDate: '2026-07-10',
      relatedLessonName: {
        registeredLessonNameId: 'geography',
        lessonName: '地理',
      },
      targetScopeType: null,
    })).toEqual({ status: 'invalid-task' })
    expect(editor.saveTaskDraft({
      title: '地理ワークを提出',
      dueDate: '2026-07-10',
      relatedLessonName: {
        registeredLessonNameId: 'geography',
        lessonName: '地理',
      },
      targetScopeType: 'track',
    })).toMatchObject({ status: 'saved' })
    expect(editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 3,
      replacement: { type: 'lesson_name', lessonName: '総合' },
    })).toMatchObject({ status: 'saved' })
    expect(editor.saveNoteDraft({
      body: '  集合場所は視聴覚室です。\n上履きを持参してください。  ',
      schoolDate: '2026-07-10',
      targetScopeType: 'class',
    })).toMatchObject({ status: 'saved' })
    expect(editor.getSnapshot()).toMatchObject({
      draftCount: 3,
      taskDrafts: [
        {
          title: '地理ワークを提出',
          dueDate: '2026-07-10',
          targetScopeType: 'track',
        },
      ],
      noteDrafts: [{
        body: '集合場所は視聴覚室です。\n上履きを持参してください。',
        schoolDate: '2026-07-10',
        targetScopeType: 'class',
      }],
    })

    await expect(editor.submitCurrentBatch({
      confirmSubmission: () => true,
      applyFreshness: () => 'refreshed',
    })).resolves.toEqual({ status: 'applied', freshness: 'refreshed' })
    expect(submitted).toMatchObject([
      {
        changes: [
          {
            sourceId: '33000000-0000-4000-8000-000000000102',
            targetScopeType: 'track',
            changeDate: '2026-07-10',
            periodNumber: 3,
          },
          {
            kind: 'task',
            sourceId: '33000000-0000-4000-8000-000000000101',
            targetScopeType: 'track',
            title: '地理ワークを提出',
            dueDate: '2026-07-10',
            relatedLessonName: { registeredLessonNameId: 'geography' },
          },
          {
            kind: 'note',
            sourceId: '33000000-0000-4000-8000-000000000103',
            changeKind: 'add',
            targetScopeType: 'class',
            schoolDate: '2026-07-10',
            body: '集合場所は視聴覚室です。\n上履きを持参してください。',
          },
        ],
      },
    ])
  })

  it('keeps dependent Note drafts attached to stable temporary Task identity', async () => {
    const taskId = '33000000-0000-4000-8000-000000000121'
    const noteId = '33000000-0000-4000-8000-000000000122'
    const storage = memoryStorage()
    const submitted: unknown[] = []
    const editor = createTimetableEditorClient({
      storage,
      createId: (() => {
        const ids = [taskId, noteId]
        return () => ids.shift()!
      })(),
      submitDirectTimetableChanges: async (payload) => {
        submitted.push(payload)
        return {
          status: 'remote-conflict',
          conflictingKeys: [],
          conflictingSourceIds: [taskId],
        }
      },
    })
    expect(editor.saveTaskDraft({
      title: '新規Task', dueDate: null, relatedLessonName: null,
      targetScopeType: 'track',
    })).toEqual({ status: 'saved', sourceId: taskId })
    expect(editor.saveTaskNoteDraft({
      taskId,
      targetScopeType: 'track',
    }, ' Task draftへのノート ')).toEqual({ status: 'saved', sourceId: noteId })

    expect(createTimetableEditorClient({ storage }).getSnapshot())
      .toMatchObject({
        draftCount: 2,
        noteDrafts: [{
          sourceId: noteId,
          relatedTaskItemId: taskId,
          targetScopeType: 'track',
          body: 'Task draftへのノート',
        }],
      })
    await editor.submitCurrentBatch({
      confirmSubmission: () => true,
      applyFreshness: () => 'refreshed',
    })
    expect(submitted).toMatchObject([{
      changes: [
        { kind: 'task', sourceId: taskId },
        {
          kind: 'note', sourceId: noteId, changeKind: 'add',
          targetScopeType: 'track', relatedTaskItemId: taskId,
          body: 'Task draftへのノート',
        },
      ],
    }])
    expect(editor.getSnapshot()).toMatchObject({
      taskDrafts: [{ sourceId: taskId, conflicted: true }],
      noteDrafts: [{ sourceId: noteId, conflicted: true }],
      conflictCount: 2,
    })
    expect(editor.removeTaskDraft(taskId)).toEqual({ status: 'removed' })
    expect(editor.getSnapshot()).toMatchObject({
      draftCount: 0,
      taskDrafts: [],
      noteDrafts: [],
      conflictCount: 0,
    })

    const cancellable = createTimetableEditorClient({
      storage: memoryStorage(),
      createId: (() => {
        const ids = [taskId, noteId]
        return () => ids.shift()!
      })(),
    })
    cancellable.saveTaskDraft({
      title: '取消Task', dueDate: null, relatedLessonName: null,
      targetScopeType: 'track',
    })
    cancellable.saveTaskNoteDraft({ taskId, targetScopeType: 'track' }, '依存')
    expect(cancellable.removeTaskDraft(taskId)).toEqual({ status: 'removed' })
    expect(cancellable.getSnapshot()).toMatchObject({
      draftCount: 0,
      taskDrafts: [],
      noteDrafts: [],
    })

    const removing = createTimetableEditorClient({
      storage: memoryStorage(),
      createId: (() => {
        const ids = [
          '33000000-0000-4000-8000-000000000123',
          '33000000-0000-4000-8000-000000000124',
        ]
        return () => ids.shift()!
      })(),
    })
    removing.saveTaskRemoveDraft({
      taskId: '33000000-0000-4000-8000-000000000120',
      latestChangeId: 'task-change',
      title: '削除予定Task', dueDate: null, relatedLessonName: null,
      targetScopeType: 'track',
    })
    expect(removing.saveTaskNoteDraft({
      taskId: '33000000-0000-4000-8000-000000000120',
      targetScopeType: 'track',
    }, '追加してはいけない')).toEqual({ status: 'invalid-note' })
  })

  it('restores related Note drafts and conflicts when active Task removal is cancelled', async () => {
    const taskId = '33000000-0000-4000-8000-000000000141'
    const addedNoteSourceId = '33000000-0000-4000-8000-000000000142'
    const updatedNoteSourceId = '33000000-0000-4000-8000-000000000143'
    const removedNoteSourceId = '33000000-0000-4000-8000-000000000146'
    const taskRemovalSourceId = '33000000-0000-4000-8000-000000000147'
    const storage = memoryStorage()
    const editor = createTimetableEditorClient({
      storage,
      createId: (() => {
        const ids = [
          addedNoteSourceId,
          updatedNoteSourceId,
          removedNoteSourceId,
          taskRemovalSourceId,
        ]
        return () => ids.shift()!
      })(),
      submitDirectTimetableChanges: async () => ({
        status: 'remote-conflict',
        conflictingKeys: [],
        conflictingSourceIds: [addedNoteSourceId, updatedNoteSourceId],
      }),
    })
    const activeTask = {
      taskId,
      latestChangeId: `${taskId}:change`,
      title: '数学ワーク',
      dueDate: '2026-07-10',
      relatedLessonName: null,
      targetScopeType: 'track' as const,
    }
    const activeNote = {
      noteId: '33000000-0000-4000-8000-000000000144',
      latestChangeId: '33000000-0000-4000-8000-000000000144:change',
      body: '元のノート',
      schoolDate: null,
      targetScopeType: 'track' as const,
      relatedTaskItemId: taskId,
    }
    const removedActiveNote = {
      ...activeNote,
      noteId: '33000000-0000-4000-8000-000000000145',
      latestChangeId: '33000000-0000-4000-8000-000000000145:change',
      body: '削除する元のノート',
    }

    expect(editor.saveTaskNoteDraft(activeTask, '追加ノート')).toEqual({
      status: 'saved', sourceId: addedNoteSourceId,
    })
    expect(editor.saveNoteUpdateDraft(activeNote, '下書きの変更')).toEqual({
      status: 'saved', sourceId: updatedNoteSourceId,
    })
    expect(editor.saveNoteRemoveDraft(removedActiveNote)).toEqual({
      status: 'saved', sourceId: removedNoteSourceId,
    })
    await editor.submitCurrentBatch({
      confirmSubmission: () => true,
      applyFreshness: () => 'refreshed',
    })
    expect(editor.getSnapshot()).toMatchObject({
      noteDrafts: [
        { sourceId: addedNoteSourceId, changeKind: 'add', conflicted: true },
        { sourceId: updatedNoteSourceId, changeKind: 'update', conflicted: true },
        { sourceId: removedNoteSourceId, changeKind: 'remove' },
      ],
      conflictCount: 2,
    })

    expect(editor.saveTaskRemoveDraft(activeTask)).toEqual({
      status: 'saved', sourceId: taskRemovalSourceId,
    })
    expect(editor.getSnapshot()).toMatchObject({
      taskDrafts: [{ sourceId: taskRemovalSourceId, changeKind: 'remove' }],
      noteDrafts: [],
      conflictCount: 0,
    })

    const restored = createTimetableEditorClient({ storage })
    expect(restored.saveTaskUpdateDraftWithNotes(
      activeTask,
      activeTask,
      ['追加ノート'],
    )).toEqual({
      status: 'saved',
      sourceId: taskRemovalSourceId,
      noteSourceIds: [addedNoteSourceId],
    })
    expect(restored.getSnapshot()).toMatchObject({
      taskDrafts: [],
      noteDrafts: [
        {
          sourceId: addedNoteSourceId,
          changeKind: 'add',
          body: '追加ノート',
          conflicted: true,
        },
        {
          sourceId: updatedNoteSourceId,
          changeKind: 'update',
          body: '下書きの変更',
          conflicted: true,
        },
        {
          sourceId: removedNoteSourceId,
          changeKind: 'remove',
          body: '削除する元のノート',
        },
      ],
      conflictCount: 2,
    })
  })

  it('keeps dependent active Note drafts conflicted after Task conflict refresh', async () => {
    const taskDraftSourceId = '33000000-0000-4000-8000-000000000131'
    const noteDraftSourceId = '33000000-0000-4000-8000-000000000132'
    const ids = [taskDraftSourceId, noteDraftSourceId]
    const editor = createTimetableEditorClient({
      storage: memoryStorage(),
      createId: () => ids.shift()!,
      submitDirectTimetableChanges: async () => ({
        status: 'remote-conflict',
        conflictingKeys: [],
        conflictingSourceIds: [taskDraftSourceId],
      }),
    })
    const taskId = '33000000-0000-4000-8000-000000000130'
    editor.saveTaskUpdateDraft({
      taskId,
      latestChangeId: 'task-change-1',
      title: '元Task', dueDate: null, relatedLessonName: null,
      targetScopeType: 'track',
    }, {
      title: '変更Task', dueDate: null, relatedLessonName: null,
    })
    const activeNote = {
      noteId: '33000000-0000-4000-8000-000000000139',
      latestChangeId: 'note-change-1',
      body: '元Note', schoolDate: null, targetScopeType: 'track' as const,
      relatedTaskItemId: taskId,
    }
    editor.saveNoteUpdateDraft(activeNote, '変更Note')

    await editor.submitCurrentBatch({
      confirmSubmission: () => true,
      applyFreshness: () => 'refreshed',
    })
    editor.reconcileActiveNotes([activeNote])

    expect(editor.getSnapshot()).toMatchObject({
      taskDrafts: [{ sourceId: taskDraftSourceId, conflicted: true }],
      noteDrafts: [{ sourceId: noteDraftSourceId, conflicted: true }],
      conflictCount: 2,
    })
  })

  it('persists unrelated Note update/remove drafts and reconciles stale state', () => {
    const ids = [
      '33000000-0000-4000-8000-000000000111',
      '33000000-0000-4000-8000-000000000112',
      '33000000-0000-4000-8000-000000000113',
      '33000000-0000-4000-8000-000000000114',
    ]
    const storage = memoryStorage()
    const editor = createTimetableEditorClient({
      storage,
      createId: () => ids.shift()!,
    })
    expect(editor.saveNoteDraft({
      body: '関連先なし',
      schoolDate: null,
      targetScopeType: 'track',
    })).toMatchObject({ status: 'saved' })
    expect(editor.getSnapshot().noteDrafts).toMatchObject([
      { changeKind: 'add', schoolDate: null, body: '関連先なし' },
    ])
    expect(editor.updateNoteDraft(
      '33000000-0000-4000-8000-000000000111',
      { body: '編集した下書き', schoolDate: null, targetScopeType: 'class' },
    )).toEqual({ status: 'saved' })
    expect(editor.getSnapshot().noteDrafts).toMatchObject([{
      sourceId: '33000000-0000-4000-8000-000000000111',
      body: '編集した下書き',
      targetScopeType: 'class',
    }])
    editor.removeNoteDraft('33000000-0000-4000-8000-000000000111')

    const active = {
      noteId: '33000000-0000-4000-8000-000000000199',
      latestChangeId: 'note-change-1',
      body: '変更前\n全文',
      schoolDate: null,
      targetScopeType: 'track' as const,
    }
    expect(editor.saveNoteUpdateDraft(active, '  変更後\n全文  '))
      .toMatchObject({ status: 'saved' })
    expect(editor.getSnapshot().noteDrafts).toMatchObject([{
      changeKind: 'update',
      sharedInformationItemId: active.noteId,
      expectedLatestChangeId: active.latestChangeId,
      body: '変更後\n全文',
      schoolDate: null,
    }])
    expect(editor.saveNoteUpdateDraft(active, active.body))
      .toEqual({ status: 'removed-noop' })

    expect(editor.saveNoteUpdateDraft(active, '自動で変えない本文'))
      .toMatchObject({ status: 'saved' })
    const restoredUpdate = createTimetableEditorClient({ storage })
    restoredUpdate.reconcileActiveNotes([{
      ...active,
      latestChangeId: 'note-change-2',
      body: 'サーバー側の本文',
    }])
    expect(restoredUpdate.getSnapshot()).toMatchObject({
      conflictCount: 1,
      noteDrafts: [{ body: '自動で変えない本文', conflicted: true }],
    })
    restoredUpdate.removeNoteDraft(
      '33000000-0000-4000-8000-000000000113',
    )

    const freshActive = {
      ...active,
      latestChangeId: 'note-change-2',
      body: 'サーバー側の本文',
    }
    expect(restoredUpdate.saveNoteRemoveDraft(freshActive))
      .toMatchObject({ status: 'saved' })
    expect(createTimetableEditorClient({ storage }).getSnapshot().noteDrafts)
      .toMatchObject([{
        changeKind: 'remove',
        body: freshActive.body,
        schoolDate: null,
        sharedInformationItemId: active.noteId,
      }])

    const restored = createTimetableEditorClient({ storage })
    restored.reconcileActiveNotes([{
      ...freshActive,
      latestChangeId: 'note-change-3',
    }])
    expect(restored.getSnapshot()).toMatchObject({
      conflictCount: 1,
      noteDrafts: [{ changeKind: 'remove', conflicted: true }],
    })
  })

  it('saves reflected Note detail transitions through the removal checkbox', () => {
    const ids = [
      '33000000-0000-4000-8000-000000000301',
      '33000000-0000-4000-8000-000000000302',
      '33000000-0000-4000-8000-000000000303',
    ]
    const editor = createTimetableEditorClient({
      storage: memoryStorage(),
      createId: () => ids.shift()!,
    })
    const active = {
      noteId: '33000000-0000-4000-8000-000000000399',
      latestChangeId: 'note-change-1',
      body: '変更前の本文',
      schoolDate: '2026-07-10',
      targetScopeType: 'class' as const,
    }

    expect(editor.saveNoteDetailDraft(active, '変更後の本文', false))
      .toMatchObject({ status: 'saved' })
    expect(editor.getSnapshot().noteDrafts).toMatchObject([{
      changeKind: 'update',
      body: '変更後の本文',
    }])

    expect(editor.saveNoteDetailDraft(active, '無視される入力', true))
      .toMatchObject({ status: 'saved' })
    expect(editor.getSnapshot().noteDrafts).toMatchObject([{
      changeKind: 'remove',
      body: '変更前の本文',
    }])

    expect(editor.saveNoteDetailDraft(active, '削除を解除した本文', false))
      .toMatchObject({ status: 'saved' })
    expect(editor.getSnapshot().noteDrafts).toMatchObject([{
      changeKind: 'update',
      body: '削除を解除した本文',
    }])

    expect(editor.saveNoteDetailDraft(active, active.body, false))
      .toEqual({ status: 'removed-noop' })
    expect(editor.getSnapshot().noteDrafts).toEqual([])
  })

  it('retains and marks a Task draft after an idempotency conflict', async () => {
    const sourceId = '33000000-0000-4000-8000-000000000201'
    const storage = memoryStorage()
    const editor = createTimetableEditorClient({
      storage,
      createId: () => sourceId,
      submitDirectTimetableChanges: async () => ({
        status: 'idempotency-conflict',
        conflictingKeys: [],
        conflictingSourceIds: [sourceId],
      }),
    })
    editor.saveTaskDraft({
      title: '期限なしTask',
      dueDate: null,
      relatedLessonName: null,
      targetScopeType: 'student',
    })

    await expect(editor.submitCurrentBatch({
      confirmSubmission: () => true,
      applyFreshness: () => 'refreshed',
    })).resolves.toEqual({
      status: 'idempotency-conflict',
      freshness: 'refreshed',
    })
    expect(editor.getSnapshot()).toMatchObject({
      editing: true,
      draftCount: 1,
      conflictCount: 1,
      taskDrafts: [{ sourceId, conflicted: true }],
    })

    const restored = createTimetableEditorClient({ storage })
    expect(restored.getSnapshot()).toMatchObject({
      editing: true,
      draftCount: 1,
      conflictCount: 1,
      taskDrafts: [{ sourceId, conflicted: true }],
    })
  })

  it('drafts Task updates and removals against immutable server identity', async () => {
    const ids = [
      '33000000-0000-4000-8000-000000000301',
      '33000000-0000-4000-8000-000000000302',
    ]
    const submitted: unknown[] = []
    const editor = createTimetableEditorClient({
      storage: memoryStorage(),
      createId: () => ids.shift()!,
      submitDirectTimetableChanges: async (payload) => {
        submitted.push(payload)
        return { status: 'applied' }
      },
    })
    const activeTask = {
      taskId: '33000000-0000-4000-8000-000000000300',
      latestChangeId: '33000000-0000-4000-8000-000000000300:change',
      title: '更新前',
      dueDate: '2026-07-10',
      relatedLessonName: null,
      targetScopeType: 'track' as const,
    }

    expect(editor.saveTaskUpdateDraft(activeTask, {
      title: '更新後',
      dueDate: null,
      relatedLessonName: { lessonName: '特別活動' },
    })).toMatchObject({ status: 'saved' })
    expect(editor.saveTaskRemoveDraft({
      ...activeTask,
      taskId: '33000000-0000-4000-8000-000000000399',
      latestChangeId: '33000000-0000-4000-8000-000000000399:change',
    })).toMatchObject({ status: 'saved' })

    expect(editor.getSnapshot()).toMatchObject({
      draftCount: 2,
      taskDrafts: [
        {
          changeKind: 'update',
          sharedInformationItemId: activeTask.taskId,
          expectedLatestChangeId: activeTask.latestChangeId,
          targetScopeType: 'track',
          title: '更新後',
        },
        {
          changeKind: 'remove',
          targetScopeType: 'track',
        },
      ],
    })

    await editor.submitCurrentBatch({
      confirmSubmission: () => true,
      applyFreshness: () => 'refreshed',
    })
    expect(submitted).toMatchObject([{
      changes: [
        {
          kind: 'task',
          sourceId: '33000000-0000-4000-8000-000000000301',
          changeKind: 'update',
          sharedInformationItemId: activeTask.taskId,
          expectedLatestChangeId: activeTask.latestChangeId,
          targetScopeType: 'track',
          title: '更新後',
          dueDate: null,
          relatedLessonName: { lessonName: '特別活動' },
        },
        {
          kind: 'task',
          sourceId: '33000000-0000-4000-8000-000000000302',
          changeKind: 'remove',
          sharedInformationItemId: '33000000-0000-4000-8000-000000000399',
          expectedLatestChangeId: '33000000-0000-4000-8000-000000000399:change',
          targetScopeType: 'track',
        },
      ],
    }])
  })

  it('reuses Task draft identities and removes an update that returns to active values', () => {
    const ids = [
      '33000000-0000-4000-8000-000000000351',
      '33000000-0000-4000-8000-000000000352',
    ]
    const storage = memoryStorage()
    const editor = createTimetableEditorClient({
      storage,
      createId: () => ids.shift()!,
    })
    const activeTask = {
      taskId: '33000000-0000-4000-8000-000000000350',
      latestChangeId: '33000000-0000-4000-8000-000000000350:change',
      title: '元Task',
      dueDate: '2026-07-10',
      relatedLessonName: { lessonName: '地理', registeredLessonNameId: 'geography' },
      targetScopeType: 'track' as const,
      notes: [{
        noteId: '33000000-0000-4000-8000-000000000359',
        latestChangeId: '33000000-0000-4000-8000-000000000359:change',
        body: '関連ノート',
        targetScopeType: 'track' as const,
        relatedContext: {
          type: 'task' as const,
          taskId: '33000000-0000-4000-8000-000000000350',
        },
      }],
    }

    const added = editor.saveTaskDraft({
      title: '追加Task',
      dueDate: '2026-07-10',
      relatedLessonName: null,
      targetScopeType: 'track',
    })
    expect(added).toEqual({
      status: 'saved',
      sourceId: '33000000-0000-4000-8000-000000000351',
    })
    if (added.status !== 'saved') throw new Error('Task add draft was not saved')
    const addedSourceId = added.sourceId
    expect(editor.updateTaskDraft(addedSourceId, {
      title: '編集した追加Task',
      dueDate: null,
      relatedLessonName: { lessonName: '特別活動' },
      targetScopeType: 'class',
    })).toEqual({ status: 'saved', sourceId: addedSourceId })
    expect(editor.getSnapshot()).toMatchObject({
      draftCount: 1,
      taskDrafts: [{
        sourceId: addedSourceId,
        changeKind: 'add',
        title: '編集した追加Task',
        targetScopeType: 'class',
      }],
    })

    const firstUpdate = editor.saveTaskUpdateDraft(activeTask, {
      title: '変更Task',
      dueDate: '2026-07-11',
      relatedLessonName: null,
    })
    expect(firstUpdate).toEqual({
      status: 'saved',
      sourceId: '33000000-0000-4000-8000-000000000352',
    })
    if (firstUpdate.status !== 'saved') {
      throw new Error('Task update draft was not saved')
    }
    const firstUpdateSourceId = firstUpdate.sourceId
    expect(createTimetableEditorClient({ storage }).getSnapshot().taskDrafts)
      .toContainEqual(expect.objectContaining({
        sourceId: firstUpdateSourceId,
        baseTask: expect.objectContaining({
          taskId: activeTask.taskId,
          notes: activeTask.notes,
        }),
      }))
    expect(editor.saveTaskUpdateDraft(activeTask, {
      title: '再編集Task',
      dueDate: null,
      relatedLessonName: null,
    })).toEqual({ status: 'saved', sourceId: firstUpdateSourceId })
    expect(editor.getSnapshot().draftCount).toBe(2)
    expect(editor.getSnapshot().taskDrafts).toContainEqual(expect.objectContaining({
      sourceId: firstUpdateSourceId,
      changeKind: 'update',
      title: '再編集Task',
    }))

    expect(editor.saveTaskUpdateDraft(activeTask, {
      title: activeTask.title,
      dueDate: activeTask.dueDate,
      relatedLessonName: activeTask.relatedLessonName,
    })).toEqual({ status: 'removed-noop' })
    expect(editor.getSnapshot()).toMatchObject({
      draftCount: 1,
      taskDrafts: [{ sourceId: addedSourceId }],
    })
  })

  it('retains every mixed draft and marks a stale Task without rebasing it', async () => {
    const taskSourceId = '33000000-0000-4000-8000-000000000401'
    const editor = createTimetableEditorClient({
      storage: memoryStorage(),
      createId: () => taskSourceId,
      submitDirectTimetableChanges: async () => ({
        status: 'remote-conflict',
        conflictingKeys: [],
        conflictingSourceIds: [taskSourceId],
      }),
    })
    const activeTask = {
      taskId: '33000000-0000-4000-8000-000000000400',
      latestChangeId: '33000000-0000-4000-8000-000000000400:change',
      title: '更新前',
      dueDate: '2026-07-10',
      relatedLessonName: null,
      targetScopeType: 'class' as const,
    }
    editor.saveTaskUpdateDraft(activeTask, {
      title: 'ローカル更新',
      dueDate: '2026-07-11',
      relatedLessonName: null,
    })
    editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 3,
      replacement: { type: 'cancelled' },
    })

    await expect(editor.submitCurrentBatch({
      confirmSubmission: () => true,
      applyFreshness: () => 'refreshed',
    })).resolves.toEqual({ status: 'remote-conflict', freshness: 'refreshed' })
    expect(editor.getSnapshot()).toMatchObject({
      editing: true,
      draftCount: 2,
      taskDrafts: [{
        sourceId: taskSourceId,
        expectedLatestChangeId: activeTask.latestChangeId,
        title: 'ローカル更新',
        conflicted: true,
      }],
    })
  })

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

  it('derives an update from an active layer and eliminates a current-replacement no-op', () => {
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

    expect(editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'lesson_name', lessonName: '物理' },
    })).toEqual({ status: 'removed-noop' })
    expect(editor.getSnapshot().drafts).toEqual([])

    expect(editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'cancelled' },
    })).toMatchObject({ status: 'saved' })
    expect(editor.findDraft('track', '2026-07-10', 2)).toMatchObject({
      changeKind: 'update',
      sharedInformationItemId: 'item-1',
      expectedLatestChangeId: 'change-1',
      replacement: { type: 'cancelled' },
    })

    expect(editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'lesson_name', lessonName: '物理' },
    })).toEqual({ status: 'removed-noop' })
    expect(editor.getSnapshot().drafts).toEqual([])
  })

  it('persists Registered identity and compares Registered Lesson Names by identity', () => {
    const storage = memoryStorage()
    const editor = createTimetableEditorClient({ storage })
    editor.reconcileLayerState(layerState([
      { targetScopeType: 'grade', state: 'unchanged' },
      { targetScopeType: 'class', state: 'unchanged' },
      {
        targetScopeType: 'track',
        state: 'active',
        sharedInformationItemId: 'item-registered',
        latestChangeId: 'change-registered',
        replacement: {
          type: 'lesson_name',
          registeredLessonNameId: 'geography',
          lessonName: '地理（新）',
        },
        changedAt: 1,
      },
      { targetScopeType: 'student', state: 'unchanged' },
    ]))

    expect(editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: {
        type: 'lesson_name',
        registeredLessonNameId: 'geography',
        lessonName: '地理',
      },
    })).toEqual({ status: 'removed-noop' })

    editor.setDesiredState({
      targetScopeType: 'student',
      changeDate: '2026-07-11',
      periodNumber: 4,
      replacement: {
        type: 'lesson_name',
        registeredLessonNameId: 'geography',
        lessonName: '地理',
      },
    })
    const restored = createTimetableEditorClient({ storage })
    expect(restored.findDraft('student', '2026-07-11', 4)).toMatchObject({
      replacement: {
        type: 'lesson_name',
        registeredLessonNameId: 'geography',
        lessonName: '地理',
      },
    })
  })

  it('marks a restored update draft stale without rebasing or dropping its desired state', () => {
    const storage = memoryStorage()
    const initial = createTimetableEditorClient({ storage })
    initial.reconcileLayerState(layerState([
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
    ]))
    initial.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'lesson_name', lessonName: '化学' },
    })

    const restored = createTimetableEditorClient({ storage })
    expect(restored.getSnapshot().unreconciledDrafts).toEqual([
      {
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 2,
      },
    ])
    restored.reconcileLayerState(layerState([
      { targetScopeType: 'grade', state: 'unchanged' },
      { targetScopeType: 'class', state: 'unchanged' },
      {
        targetScopeType: 'track',
        state: 'active',
        sharedInformationItemId: 'item-1',
        latestChangeId: 'change-2',
        replacement: { type: 'lesson_name', lessonName: '生物' },
        changedAt: 2,
      },
      { targetScopeType: 'student', state: 'unchanged' },
    ]))

    expect(restored.getSnapshot()).toMatchObject({ conflictCount: 1 })
    expect(restored.getSnapshot().unreconciledDrafts).toEqual([])
    expect(restored.findDraft('track', '2026-07-10', 2)).toMatchObject({
      expectedLatestChangeId: 'change-1',
      replacement: { type: 'lesson_name', lessonName: '化学' },
      conflicted: true,
    })
  })

  it('keeps an idempotency conflict sticky until the draft is explicitly restored', async () => {
    const server = layerState([
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
    ])
    const key = {
      targetScopeType: 'track' as const,
      changeDate: '2026-07-10',
      periodNumber: 2,
    }
    const editor = createTimetableEditorClient({
      storage: memoryStorage(),
      submitDirectTimetableChanges: createSharedInformationDirectChangeTransport({
        fetcher: async () => Response.json({
          status: 'idempotency-conflict',
          conflictingKeys: [key],
        }, { status: 409 }),
      }),
    })
    editor.reconcileLayerState(server)
    editor.setDesiredState({
      ...key,
      replacement: { type: 'lesson_name', lessonName: '化学' },
    })

    await expect(editor.submitCurrentBatch({
      confirmSubmission: () => true,
      applyFreshness: async () => 'refreshed' as const,
    })).resolves.toEqual({
      status: 'idempotency-conflict',
      freshness: 'refreshed',
    })
    editor.reconcileLayerState(server)

    expect(editor.getSnapshot()).toMatchObject({ conflictCount: 1 })
    expect(editor.findDraft('track', '2026-07-10', 2)).toMatchObject({
      conflicted: true,
      replacement: { type: 'lesson_name', lessonName: '化学' },
    })

    editor.restoreServerState('track', '2026-07-10', 2)
    expect(editor.getSnapshot()).toMatchObject({ draftCount: 0, conflictCount: 0 })
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

  it('uses the canonical unresolved Floating Reference result in draft preview', () => {
    const editor = createTimetableEditorClient({ storage: memoryStorage() })
    const server = layerState()
    editor.reconcileLayerState(server)
    editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: {
        type: 'floating_lesson_reference',
        floatingLessonReferenceLabelId: 'unknown',
        referenceLabel: '★',
      },
    })

    expect(editor.previewLayerState(server, () => null).finalDailyLesson).toEqual({
      lessonName: 'エラー',
      timetableChangeState: 'unresolved-reference',
    })
  })

  it('derives remove only for an active layer and previews the next applicable layer', () => {
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
      {
        targetScopeType: 'track',
        state: 'active',
        sharedInformationItemId: 'track-item',
        latestChangeId: 'track-change',
        replacement: { type: 'cancelled' },
        changedAt: 2,
      },
      { targetScopeType: 'student', state: 'unchanged' },
    ])
    editor.reconcileLayerState(server)

    expect(editor.removeDesiredState({
      targetScopeType: 'class', changeDate: '2026-07-10', periodNumber: 2,
    })).toEqual({
      status: 'not-active',
    })
    expect(editor.removeDesiredState({
      targetScopeType: 'track', changeDate: '2026-07-10', periodNumber: 2,
    })).toMatchObject({
      status: 'saved',
    })
    expect(editor.findDraft('track', '2026-07-10', 2)).toMatchObject({
      changeKind: 'remove',
      sharedInformationItemId: 'track-item',
      expectedLatestChangeId: 'track-change',
    })
    expect(editor.findDraft('track', '2026-07-10', 2)).not.toHaveProperty(
      'replacement',
    )

    expect(editor.previewLayerState(server, () => null)).toMatchObject({
      layers: [
        { targetScopeType: 'grade', state: 'active', desired: false },
        { targetScopeType: 'class', state: 'unchanged', desired: false },
        {
          targetScopeType: 'track',
          state: 'unchanged',
          desired: true,
          removalPlanned: true,
        },
        { targetScopeType: 'student', state: 'unchanged', desired: false },
      ],
      finalDailyLesson: { lessonName: '体育', timetableChangeState: 'resolved' },
    })

    expect(editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'lesson_name', lessonName: '化学' },
    })).toMatchObject({ status: 'saved' })
    expect(editor.findDraft('track', '2026-07-10', 2)).toMatchObject({
      changeKind: 'update',
      sharedInformationItemId: 'track-item',
      expectedLatestChangeId: 'track-change',
      replacement: { type: 'lesson_name', lessonName: '化学' },
    })
  })

  it('persists, restores, cancels, and retains a remove draft through conflict', async () => {
    const storage = memoryStorage()
    const server = layerState([
      { targetScopeType: 'grade', state: 'unchanged' },
      { targetScopeType: 'class', state: 'unchanged' },
      {
        targetScopeType: 'track',
        state: 'active',
        sharedInformationItemId: 'track-item',
        latestChangeId: 'track-change',
        replacement: { type: 'lesson_name', lessonName: '物理' },
        changedAt: 2,
      },
      { targetScopeType: 'student', state: 'unchanged' },
    ])
    const initial = createTimetableEditorClient({ storage })
    initial.reconcileLayerState(server)
    initial.removeDesiredState({
      targetScopeType: 'track', changeDate: '2026-07-10', periodNumber: 2,
    })

    const key = {
      targetScopeType: 'track' as const,
      changeDate: '2026-07-10',
      periodNumber: 2,
    }
    const restored = createTimetableEditorClient({
      storage,
      submitDirectTimetableChanges: createSharedInformationDirectChangeTransport({
        fetcher: async () => Response.json({
          status: 'timetable-change-conflict',
          conflictingKeys: [key],
        }, { status: 409 }),
      }),
    })
    restored.reconcileLayerState(server)
    expect(restored.findDraft('track', '2026-07-10', 2)).toMatchObject({
      changeKind: 'remove',
      serverReplacement: { type: 'lesson_name', lessonName: '物理' },
      conflicted: false,
    })
    await restored.submitCurrentBatch({
      confirmSubmission: () => true,
      applyFreshness: async () => 'refreshed' as const,
    })
    expect(restored.findDraft('track', '2026-07-10', 2)).toMatchObject({
      changeKind: 'remove',
      conflicted: true,
    })
    expect(restored.restoreServerState('track', '2026-07-10', 2)).toEqual({
      status: 'removed-noop',
    })
    expect(restored.getSnapshot()).toMatchObject({ draftCount: 0, conflictCount: 0 })
  })

  it('persists only safe draft data, restores it, cancels one draft, and retains drafts after network failure', async () => {
    const storage = memoryStorage()
    const editor = createTimetableEditorClient({
      storage,
      submitDirectTimetableChanges: createSharedInformationDirectChangeTransport({
        fetcher: async () => { throw new Error('offline') },
      }),
    })
    editor.reconcileLayerState(layerState())
    editor.setDesiredState({
      targetScopeType: 'student',
      changeDate: '2026-07-11',
      periodNumber: 4,
      replacement: { type: 'lesson_name', lessonName: '面談' },
    })
    await expect(editor.submitCurrentBatch({
      confirmSubmission: () => true,
      applyFreshness: async () => 'refreshed' as const,
    })).resolves.toEqual({ status: 'network-error' })
    expect(editor.getSnapshot()).toMatchObject({
      draftCount: 1,
      lastCommitFailed: true,
      conflictCount: 0,
    })
    expect(editor.findDraft('student', '2026-07-11', 4)).toMatchObject({
      conflicted: false,
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

  it('restores a conflicted Note draft by source ID', async () => {
    const sourceId = '33000000-0000-4000-8000-000000000202'
    const storage = memoryStorage()
    const editor = createTimetableEditorClient({
      storage,
      createId: () => sourceId,
      submitDirectTimetableChanges: async () => ({
        status: 'idempotency-conflict',
        conflictingKeys: [],
        conflictingSourceIds: [sourceId],
      }),
    })
    editor.saveNoteDraft({
      body: '集合場所は視聴覚室です。',
      schoolDate: '2026-07-10',
      targetScopeType: 'class',
    })

    await editor.submitCurrentBatch({
      confirmSubmission: () => true,
      applyFreshness: () => 'refreshed',
    })
    expect(editor.getSnapshot()).toMatchObject({
      conflictCount: 1,
      noteDrafts: [{ sourceId, conflicted: true }],
    })
    expect(createTimetableEditorClient({ storage }).getSnapshot()).toMatchObject({
      conflictCount: 1,
      noteDrafts: [{ sourceId, conflicted: true }],
    })
  })

  it('rejects a restored Floating Lesson Reference without a selected label', () => {
    const storage = memoryStorage()
    storage.setItem('tsugi:timetable-direct-add-drafts:v1', JSON.stringify({
      editing: true,
      lastTargetScopeType: 'track',
      drafts: [{
        sourceId: 'draft-without-label',
        targetScopeType: 'track',
        changeDate: '2026-07-10',
        periodNumber: 2,
        changeKind: 'add',
        replacement: {
          type: 'floating_lesson_reference',
          floatingLessonReferenceLabelId: '',
          referenceLabel: '',
        },
      }],
      taskDrafts: [],
      taskConflictSourceIds: [],
    }))

    const restored = createTimetableEditorClient({ storage })

    expect(restored.getSnapshot()).toMatchObject({
      editing: true,
      draftCount: 0,
    })
    expect(restored.findDraft('track', '2026-07-10', 2)).toBeUndefined()
  })

  it('submits one immutable batch and refreshes after the applied state is published', async () => {
    const events: string[] = []
    const editor = createTimetableEditorClient({
      storage: memoryStorage(),
      submitDirectTimetableChanges: async (payload) => {
        events.push('transport')
        expect(payload).toEqual({
          changes: [{
            changeKind: 'add',
            sourceId: expect.any(String),
            targetScopeType: 'track',
            changeDate: '2026-07-10',
            periodNumber: 2,
            replacement: { type: 'cancelled' },
          }],
        })
        return { status: 'applied' }
      },
    })
    editor.reconcileLayerState(layerState())
    editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'cancelled' },
    })

    await expect(editor.submitCurrentBatch({
      confirmSubmission: async (preview) => {
        events.push('confirm')
        expect(preview.changes).toHaveLength(1)
        expect(Object.isFrozen(preview.changes)).toBe(true)
        return true
      },
      applyFreshness: async (effect) => {
        events.push(`freshness:${effect.type}`)
        expect(effect).toMatchObject({
          type: 'applied',
          affectedKeys: [{
            targetScopeType: 'track',
            changeDate: '2026-07-10',
            periodNumber: 2,
          }],
          signal: expect.any(AbortSignal),
        })
        expect(editor.getSnapshot()).toMatchObject({
          draftCount: 0,
          submitting: true,
        })
        return 'refreshed' as const
      },
    })).resolves.toEqual({ status: 'applied', freshness: 'refreshed' })
    expect(events).toEqual(['confirm', 'transport', 'freshness:applied'])
    expect(editor.getSnapshot().submitting).toBe(false)
  })

  it('locks draft mutation during submission and ignores a late response after reset', async () => {
    let finishRequest!: (
      response: DirectTimetableSubmissionTransportResult,
    ) => void
    const request = new Promise<DirectTimetableSubmissionTransportResult>((resolve) => {
      finishRequest = resolve
    })
    let freshnessCalls = 0
    const storage = memoryStorage()
    const editor = createTimetableEditorClient({
      storage,
      submitDirectTimetableChanges: async () => request,
    })
    editor.reconcileLayerState(layerState())
    editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'cancelled' },
    })
    const submission = editor.submitCurrentBatch({
      confirmSubmission: () => true,
      applyFreshness: async () => {
        freshnessCalls += 1
        return 'refreshed' as const
      },
    })
    await Promise.resolve()

    expect(editor.getSnapshot().submitting).toBe(true)
    expect([...storage.values.values()].join('')).not.toContain('submitting')
    expect(editor.setDesiredState({
      targetScopeType: 'class',
      changeDate: '2026-07-11',
      periodNumber: 3,
      replacement: { type: 'cancelled' },
    })).toEqual({ status: 'submission-in-progress' })
    expect(editor.discard()).toEqual({ status: 'submission-in-progress' })
    await expect(editor.submitCurrentBatch({
      confirmSubmission: () => true,
      applyFreshness: async () => 'refreshed' as const,
    })).resolves.toEqual({ status: 'already-submitting' })

    editor.reset()
    expect(editor.getSnapshot()).toMatchObject({
      submitting: false,
      draftCount: 0,
      editing: false,
    })
    finishRequest({ status: 'applied' })
    await expect(submission).resolves.toEqual({ status: 'cancelled' })
    expect(freshnessCalls).toBe(0)
    expect(editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'lesson_name', lessonName: '再編集' },
    })).toMatchObject({ status: 'saved' })
    expect(editor.findDraft('track', '2026-07-10', 2)).toMatchObject({
      changeKind: 'add',
    })
  })

  it('maps a remote Timetable Change conflict, keeps drafts, and refreshes layers', async () => {
    const key = {
      targetScopeType: 'track' as const,
      changeDate: '2026-07-10',
      periodNumber: 2,
    }
    const editor = createTimetableEditorClient({
      storage: memoryStorage(),
      submitDirectTimetableChanges: createSharedInformationDirectChangeTransport({
        fetcher: async () => Response.json({
          status: 'timetable-change-conflict',
          conflictingKeys: [key],
        }, { status: 409 }),
      }),
    })
    editor.reconcileLayerState(layerState())
    editor.setDesiredState({ ...key, replacement: { type: 'cancelled' } })

    await expect(editor.submitCurrentBatch({
      confirmSubmission: () => true,
      applyFreshness: async (effect) => {
        expect(effect).toMatchObject({
          type: 'remote-conflict',
          conflictingKeys: [key],
          signal: expect.any(AbortSignal),
        })
        return 'refreshed' as const
      },
    })).resolves.toEqual({
      status: 'remote-conflict',
      freshness: 'refreshed',
    })
    expect(editor.getSnapshot()).toMatchObject({
      submitting: false,
      draftCount: 1,
      conflictCount: 1,
      lastCommitFailed: true,
      unreconciledDrafts: [key],
    })
  })

  it('maps Affiliation Renewal without treating it as a Timetable Change conflict', async () => {
    let freshnessCalls = 0
    const editor = createTimetableEditorClient({
      storage: memoryStorage(),
      submitDirectTimetableChanges: createSharedInformationDirectChangeTransport({
        fetcher: async () => Response.json({
          status: 'affiliation-renewal-needed',
          schoolYear: 2026,
        }, { status: 409 }),
      }),
    })
    editor.reconcileLayerState(layerState())
    editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'cancelled' },
    })

    await expect(editor.submitCurrentBatch({
      confirmSubmission: () => true,
      applyFreshness: async () => {
        freshnessCalls += 1
        return 'refreshed' as const
      },
    })).resolves.toEqual({
      status: 'affiliation-renewal-needed',
      schoolYear: 2026,
    })
    expect(editor.getSnapshot()).toMatchObject({
      submitting: false,
      draftCount: 1,
      conflictCount: 0,
      lastCommitFailed: true,
    })
    expect(freshnessCalls).toBe(0)
  })

  it('does not transport an empty, locally conflicted, or cancelled batch', async () => {
    let transportCalls = 0
    const editor = createTimetableEditorClient({
      storage: memoryStorage(),
      submitDirectTimetableChanges: async () => {
        transportCalls += 1
        return { status: 'applied' }
      },
    })
    const options = {
      confirmSubmission: () => false,
      applyFreshness: async () => 'refreshed' as const,
    }
    await expect(editor.submitCurrentBatch(options)).resolves.toEqual({
      status: 'empty',
    })

    editor.reconcileLayerState(layerState())
    editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'cancelled' },
    })
    await expect(editor.submitCurrentBatch(options)).resolves.toEqual({
      status: 'cancelled',
    })
    editor.reconcileLayerState(layerState([{
      targetScopeType: 'track',
      state: 'active',
      sharedInformationItemId: 'item-1',
      latestChangeId: 'change-1',
      replacement: { type: 'cancelled' },
      changedAt: 1,
    }]))
    await expect(editor.submitCurrentBatch(options)).resolves.toEqual({
      status: 'local-conflict',
    })
    expect(transportCalls).toBe(0)
  })

  it('unlocks and retains drafts when confirmation fails', async () => {
    let transportCalls = 0
    const editor = createTimetableEditorClient({
      storage: memoryStorage(),
      submitDirectTimetableChanges: async () => {
        transportCalls += 1
        return { status: 'applied' }
      },
    })
    editor.reconcileLayerState(layerState())
    editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'cancelled' },
    })

    await expect(editor.submitCurrentBatch({
      confirmSubmission: async () => { throw new Error('dialog unavailable') },
      applyFreshness: async () => 'refreshed' as const,
    })).resolves.toEqual({ status: 'rejected' })
    expect(editor.getSnapshot()).toMatchObject({
      submitting: false,
      draftCount: 1,
      lastCommitFailed: false,
    })
    expect(transportCalls).toBe(0)
    expect(editor.setDesiredState({
      targetScopeType: 'class',
      changeDate: '2026-07-11',
      periodNumber: 3,
      replacement: { type: 'cancelled' },
    })).toMatchObject({ status: 'saved' })
  })

  it('unlocks and retries drafts after a non-conflict server failure', async () => {
    let transportCalls = 0
    const editor = createTimetableEditorClient({
      storage: memoryStorage(),
      submitDirectTimetableChanges: async () => {
        transportCalls += 1
        return transportCalls === 1
          ? { status: 'rejected' as const }
          : { status: 'applied' as const }
      },
    })
    editor.reconcileLayerState(layerState())
    editor.saveDailyLessonDialogDraft({
      targetScopeType: 'track',
      schoolDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'cancelled' },
      noteBodies: ['時間割と同時に追加するノート'],
    })
    const options = {
      confirmSubmission: () => true,
      applyFreshness: async () => 'refreshed' as const,
    }

    await expect(editor.submitCurrentBatch(options)).resolves.toEqual({
      status: 'rejected',
    })
    expect(editor.getSnapshot()).toMatchObject({
      submitting: false,
      draftCount: 2,
      conflictCount: 0,
      lastCommitFailed: true,
    })
    await expect(editor.submitCurrentBatch(options)).resolves.toEqual({
      status: 'applied',
      freshness: 'refreshed',
    })
    expect(transportCalls).toBe(2)
    expect(editor.getSnapshot()).toMatchObject({
      submitting: false,
      draftCount: 0,
      conflictCount: 0,
    })
  })

  it('does not apply freshness when reset runs after the server result is published', async () => {
    let freshnessCalls = 0
    const editor = createTimetableEditorClient({
      storage: memoryStorage(),
      submitDirectTimetableChanges: async () => ({ status: 'applied' }),
    })
    editor.reconcileLayerState(layerState())
    editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'cancelled' },
    })
    let reset = false
    editor.subscribe(() => {
      const state = editor.getSnapshot()
      if (!reset && state.submitting && state.draftCount === 0) {
        reset = true
        editor.reset()
      }
    })

    await expect(editor.submitCurrentBatch({
      confirmSubmission: () => true,
      applyFreshness: async () => {
        freshnessCalls += 1
        return 'refreshed' as const
      },
    })).resolves.toEqual({ status: 'cancelled' })
    expect(freshnessCalls).toBe(0)
    expect(editor.getSnapshot()).toMatchObject({
      submitting: false,
      draftCount: 0,
      editing: false,
    })
  })

  it('aborts in-progress freshness when reset invalidates the submission', async () => {
    let freshnessStarted!: () => void
    const started = new Promise<void>((resolve) => {
      freshnessStarted = resolve
    })
    let finishFreshness!: (result: 'refreshed') => void
    const freshness = new Promise<'refreshed'>((resolve) => {
      finishFreshness = resolve
    })
    let freshnessSignal: AbortSignal | undefined
    const editor = createTimetableEditorClient({
      storage: memoryStorage(),
      submitDirectTimetableChanges: async () => ({ status: 'applied' }),
    })
    editor.reconcileLayerState(layerState())
    editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'cancelled' },
    })
    const submission = editor.submitCurrentBatch({
      confirmSubmission: () => true,
      applyFreshness: async (effect) => {
        freshnessSignal = effect.signal
        freshnessStarted()
        return freshness
      },
    })
    await started

    editor.reset()
    expect(freshnessSignal?.aborted).toBe(true)
    finishFreshness('refreshed')
    await expect(submission).resolves.toEqual({ status: 'cancelled' })
    expect(editor.getSnapshot()).toMatchObject({
      submitting: false,
      draftCount: 0,
      editing: false,
    })
  })

  it('keeps an applied result when freshness cannot be restored', async () => {
    const editor = createTimetableEditorClient({
      storage: memoryStorage(),
      submitDirectTimetableChanges: async () => ({ status: 'applied' }),
    })
    editor.reconcileLayerState(layerState())
    editor.setDesiredState({
      targetScopeType: 'track',
      changeDate: '2026-07-10',
      periodNumber: 2,
      replacement: { type: 'cancelled' },
    })

    await expect(editor.submitCurrentBatch({
      confirmSubmission: () => true,
      applyFreshness: async () => { throw new Error('refresh failed') },
    })).resolves.toEqual({ status: 'applied', freshness: 'stale' })
    expect(editor.getSnapshot()).toMatchObject({ draftCount: 0 })
  })

  it('saves zero, one, and multiple Task Notes with one atomic Task draft mutation', () => {
    const taskInput = {
      title: 'ノート付きTask',
      dueDate: '2026-07-10',
      relatedLessonName: null,
      targetScopeType: 'track' as const,
    }

    const zeroNotes = createTimetableEditorClient({ storage: memoryStorage() })
    expect(zeroNotes.saveTaskDraftWithNotes(taskInput, [])).toMatchObject({
      status: 'saved',
    })
    expect(zeroNotes.getSnapshot()).toMatchObject({
      taskDrafts: [{ title: 'ノート付きTask' }],
      noteDrafts: [],
      draftCount: 1,
    })

    const oneNote = createTimetableEditorClient({ storage: memoryStorage() })
    const oneResult = oneNote.saveTaskDraftWithNotes(taskInput, ['  集合場所  '])
    expect(oneResult).toMatchObject({ status: 'saved' })
    expect(oneNote.getSnapshot()).toMatchObject({
      draftCount: 2,
      noteDrafts: [{ body: '集合場所', relatedTaskItemId: oneResult.sourceId }],
    })

    const multipleNotes = createTimetableEditorClient({ storage: memoryStorage() })
    const multipleResult = multipleNotes.saveTaskDraftWithNotes(taskInput, [
      '提出方法',
      '持ち物',
      '  ',
    ])
    expect(multipleResult).toMatchObject({ status: 'saved' })
    expect(multipleNotes.getSnapshot()).toMatchObject({
      draftCount: 3,
      noteDrafts: [
        { body: '提出方法', relatedTaskItemId: multipleResult.sourceId },
        { body: '持ち物', relatedTaskItemId: multipleResult.sourceId },
      ],
    })
  })

  it('saves Task edits and new Task Notes together, while rejecting the whole form on validation or limit failure', () => {
    const activeTask = {
      taskId: 'active-task-60',
      latestChangeId: 'active-task-change-60',
      title: '元のTask',
      dueDate: null,
      relatedLessonName: null,
      targetScopeType: 'track' as const,
      notes: [],
    }
    const editor = createTimetableEditorClient({ storage: memoryStorage() })
    expect(editor.saveTaskUpdateDraftWithNotes(activeTask, {
      title: '更新Task',
      dueDate: '2026-07-11',
      relatedLessonName: { lessonName: '数学' },
    }, ['更新メモ', '補足'])).toMatchObject({ status: 'saved' })
    expect(editor.getSnapshot()).toMatchObject({
      draftCount: 3,
      taskDrafts: [{ title: '更新Task' }],
      noteDrafts: [
        { body: '更新メモ', relatedTaskItemId: activeTask.taskId },
        { body: '補足', relatedTaskItemId: activeTask.taskId },
      ],
    })

    const invalid = createTimetableEditorClient({ storage: memoryStorage() })
    expect(invalid.saveTaskDraftWithNotes(activeTask, ['有効', 'x'.repeat(1001)]))
      .toEqual({ status: 'invalid-note' })
    expect(invalid.getSnapshot()).toMatchObject({
      draftCount: 0,
      taskDrafts: [],
      noteDrafts: [],
    })

    const atLimit = createTimetableEditorClient({ storage: memoryStorage() })
    for (let index = 0; index < 49; index += 1) {
      expect(atLimit.saveNoteDraft({
        body: `既存ノート${index}`,
        schoolDate: null,
        targetScopeType: 'track',
      }).status).toBe('saved')
    }
    expect(atLimit.saveTaskDraftWithNotes(activeTask, ['追加ノート']))
      .toEqual({ status: 'limit-reached' })
    expect(atLimit.getSnapshot()).toMatchObject({
      draftCount: 49,
      taskDrafts: [],
    })
  })

  it('replaces Task Note fields without duplicates and leaves existing drafts untouched on failure', () => {
    let nextId = 0
    const editor = createTimetableEditorClient({
      storage: memoryStorage(),
      createId: () => `draft-${++nextId}`,
    })
    const added = editor.saveTaskDraftWithNotes({
      title: '追加Task',
      dueDate: null,
      relatedLessonName: null,
      targetScopeType: 'class',
    }, ['古い補足1', '古い補足2'])
    expect(added).toMatchObject({ status: 'saved', sourceId: 'draft-1' })

    expect(editor.updateTaskDraftWithNotes('draft-1', {
      title: '追加Task・更新',
      dueDate: null,
      relatedLessonName: null,
      targetScopeType: 'class',
    }, ['  新しい補足  ', ' '])).toMatchObject({ status: 'saved' })
    expect(editor.getSnapshot()).toMatchObject({
      draftCount: 2,
      taskDrafts: [{ sourceId: 'draft-1', title: '追加Task・更新' }],
      noteDrafts: [{ body: '新しい補足', relatedTaskItemId: 'draft-1' }],
    })

    const beforeInvalid = JSON.stringify(editor.getSnapshot())
    expect(editor.updateTaskDraftWithNotes('draft-1', {
      title: '保存されない更新',
      dueDate: null,
      relatedLessonName: null,
      targetScopeType: 'class',
    }, ['x'.repeat(1001)])).toEqual({ status: 'invalid-note' })
    expect(JSON.stringify(editor.getSnapshot())).toBe(beforeInvalid)
  })

  it('supports Note-only Task editing and preserves a full draft batch when replacement exceeds the limit', () => {
    const activeTask = {
      taskId: 'active-task-atomic',
      latestChangeId: 'active-task-change-atomic',
      title: '変更なしTask',
      dueDate: null,
      relatedLessonName: null,
      targetScopeType: 'track' as const,
      notes: [],
    }
    const noteOnly = createTimetableEditorClient({ storage: memoryStorage() })
    expect(noteOnly.saveTaskUpdateDraftWithNotes(activeTask, {
      title: activeTask.title,
      dueDate: activeTask.dueDate,
      relatedLessonName: activeTask.relatedLessonName,
    }, ['Taskだけは変更しない補足'])).toMatchObject({ status: 'saved' })
    expect(noteOnly.getSnapshot()).toMatchObject({
      draftCount: 1,
      taskDrafts: [],
      noteDrafts: [{
        body: 'Taskだけは変更しない補足',
        relatedTaskItemId: activeTask.taskId,
      }],
    })

    const full = createTimetableEditorClient({ storage: memoryStorage() })
    for (let index = 0; index < 48; index += 1) {
      expect(full.saveNoteDraft({
        body: `既存${index}`,
        schoolDate: null,
        targetScopeType: 'track',
      }).status).toBe('saved')
    }
    expect(full.saveTaskUpdateDraftWithNotes(activeTask, {
      title: '更新ありTask',
      dueDate: null,
      relatedLessonName: null,
    }, ['既存の追加補足'])).toMatchObject({ status: 'saved' })
    expect(full.getSnapshot().draftCount).toBe(50)

    const beforeLimit = JSON.stringify(full.getSnapshot())
    expect(full.saveTaskUpdateDraftWithNotes(activeTask, {
      title: '保存されないTask',
      dueDate: null,
      relatedLessonName: null,
    }, ['追加1', '追加2'])).toEqual({ status: 'limit-reached' })
    expect(JSON.stringify(full.getSnapshot())).toBe(beforeLimit)
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
