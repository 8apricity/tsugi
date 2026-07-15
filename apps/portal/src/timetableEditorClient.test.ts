import { describe, expect, it } from 'vitest'
import {
  createNewTaskDraftForm,
  createTimetableEditorClient as createEditorClient,
  normalizeDirectLessonReplacement,
  type DirectTimetableSubmissionTransportResult,
  type TimetableLayerState,
} from './timetableEditorClient'
import { createDirectTimetableChangeTransport } from './timetableSubmissionTransport'

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

describe('Timetable editor client', () => {
  it('coexists Task and Timetable Change drafts in one submitted batch', async () => {
    const ids = [
      '33000000-0000-4000-8000-000000000101',
      '33000000-0000-4000-8000-000000000102',
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
    expect(editor.getSnapshot()).toMatchObject({
      draftCount: 2,
      taskDrafts: [
        {
          title: '地理ワークを提出',
          dueDate: '2026-07-10',
          targetScopeType: 'track',
        },
      ],
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
        ],
      },
    ])
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
      submitDirectTimetableChanges: createDirectTimetableChangeTransport({
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
      submitDirectTimetableChanges: createDirectTimetableChangeTransport({
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
      submitDirectTimetableChanges: createDirectTimetableChangeTransport({
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
      submitDirectTimetableChanges: createDirectTimetableChangeTransport({
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
      submitDirectTimetableChanges: createDirectTimetableChangeTransport({
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
