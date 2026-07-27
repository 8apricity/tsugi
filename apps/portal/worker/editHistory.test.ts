import { describe, expect, it } from 'vitest'
import {
  InMemoryPersistenceAdapters,
  type EditHistoryStore,
  type HistoricalNoteChange,
  type HistoricalTaskChange,
  type HistoricalTimetableChange,
  type NoteEditHistoryStore,
  type TaskEditHistoryStore,
  type TimetableChangeHistoryStore,
} from './persistence'
import {
  readNoteEditHistory,
  readSharedInformationChangeDetail,
  readTaskEditHistory,
  readTimetableChangeHistory,
} from './editHistory'

const now = Date.parse('2026-07-27T00:00:00.000Z')
const sessionToken = 'edit-history-session'

describe('Edit History', () => {
  it('does not invent Timetable Change transitions from a broken history chain', async () => {
    const accessStore = await authenticatedStore()
    const targetScope = {
      type: 'track' as const,
      schoolYear: 2026,
      trackId: 'track-1',
    }
    const historyStore: TimetableChangeHistoryStore = {
      listTimetableChangeHistory: async () => [
        timetableChange({
          sharedInformationChangeId: 'change-1',
          precedingChangeId: null,
          changeKind: 'add',
          replacement: { type: 'lesson_name', lessonName: '数学' },
        }),
        timetableChange({
          sharedInformationChangeId: 'change-2',
          precedingChangeId: 'missing-change',
          changeKind: 'update',
          replacement: { type: 'lesson_name', lessonName: '英語' },
        }),
      ],
      listTimetableChangeItemHistory: async () => [],
    }

    await expect(readTimetableChangeHistory({
      sessionToken,
      targetScopeType: 'track',
      changeDate: '2026-07-27',
      periodNumber: '1',
      now,
      studentAccountStore: accessStore,
      dailyPlanStore: accessStore,
      historyStore,
    })).resolves.toEqual({ status: 'unavailable' })

    function timetableChange(
      input: Pick<
        HistoricalTimetableChange,
        'sharedInformationChangeId' | 'precedingChangeId' |
        'changeKind' | 'replacement'
      >,
    ): HistoricalTimetableChange {
      return {
        sharedInformationItemId: 'item-1',
        sourceType: 'direct',
        targetScope,
        changeDate: '2026-07-27',
        periodNumber: 1,
        primaryActorDisplayName: 'Student',
        changedAt: now,
        ...input,
      }
    }
  })

  it('rejects Shared Information Change Detail when its Timetable slot changes', async () => {
    const accessStore = await authenticatedStore()
    const itemId = 'item-1'
    const changeId = 'change-2'
    const targetScope = {
      type: 'track' as const,
      schoolYear: 2026,
      trackId: 'track-1',
    }
    const changes: HistoricalTimetableChange[] = [
      {
        sharedInformationChangeId: 'change-1',
        sharedInformationItemId: itemId,
        precedingChangeId: null,
        changeKind: 'add',
        sourceType: 'direct',
        targetScope,
        changeDate: '2026-07-27',
        periodNumber: 1,
        primaryActorDisplayName: 'Student',
        changedAt: now,
        replacement: { type: 'lesson_name', lessonName: '数学' },
      },
      {
        sharedInformationChangeId: changeId,
        sharedInformationItemId: itemId,
        precedingChangeId: 'change-1',
        changeKind: 'update',
        sourceType: 'direct',
        targetScope,
        changeDate: '2026-07-28',
        periodNumber: 1,
        primaryActorDisplayName: 'Student',
        changedAt: now + 1,
        replacement: { type: 'lesson_name', lessonName: '英語' },
      },
    ]
    const historyStore: EditHistoryStore = {
      findSharedInformationChange: async () => ({
        kind: 'timetable_change',
        sharedInformationItemId: itemId,
      }),
      listTaskEditHistory: async () => [],
      listNoteEditHistory: async () => [],
      listTimetableChangeHistory: async () => [],
      listTimetableChangeItemHistory: async () => changes,
    }

    await expect(readSharedInformationChangeDetail({
      sessionToken,
      sharedInformationChangeId: changeId,
      now,
      studentAccountStore: accessStore,
      dailyPlanStore: accessStore,
      historyStore,
    })).resolves.toEqual({ status: 'unavailable' })
  })

  it('rejects a Task history whose immutable Target Scope changes', async () => {
    const accessStore = await authenticatedStore()
    const taskId = 'task-1'
    const historyStore: TaskEditHistoryStore = {
      listTaskEditHistory: async () => [
        taskChange({
          sharedInformationChangeId: 'change-1',
          precedingChangeId: null,
          changeKind: 'add',
          snapshot: {
            title: '数学',
            dueDate: null,
            relatedLessonName: null,
          },
          targetScope: {
            type: 'track',
            schoolYear: 2026,
            trackId: 'track-1',
          },
        }),
        taskChange({
          sharedInformationChangeId: 'change-2',
          precedingChangeId: 'change-1',
          changeKind: 'update',
          snapshot: {
            title: '英語',
            dueDate: null,
            relatedLessonName: null,
          },
          targetScope: {
            type: 'track',
            schoolYear: 2026,
            trackId: 'track-2',
          },
        }),
      ],
    }

    await expect(readTaskEditHistory({
      sessionToken,
      sharedInformationItemId: taskId,
      now,
      studentAccountStore: accessStore,
      dailyPlanStore: accessStore,
      historyStore,
    })).resolves.toEqual({ status: 'unavailable' })

    function taskChange(
      input: Pick<
        HistoricalTaskChange,
        'sharedInformationChangeId' | 'precedingChangeId' |
        'changeKind' | 'snapshot' | 'targetScope'
      >,
    ): HistoricalTaskChange {
      return {
        sharedInformationItemId: taskId,
        sourceType: 'direct',
        primaryActorDisplayName: 'Student',
        changedAt: now,
        ...input,
      }
    }
  })

  it('rejects a second add inside one Task history chain', async () => {
    const accessStore = await authenticatedStore()
    const taskId = 'task-1'
    const targetScope = {
      type: 'track' as const,
      schoolYear: 2026,
      trackId: 'track-1',
    }
    const historyStore: TaskEditHistoryStore = {
      listTaskEditHistory: async () => [
        taskChange('change-1', null),
        taskChange('change-2', 'change-1'),
      ],
    }

    await expect(readTaskEditHistory({
      sessionToken,
      sharedInformationItemId: taskId,
      now,
      studentAccountStore: accessStore,
      dailyPlanStore: accessStore,
      historyStore,
    })).resolves.toEqual({ status: 'unavailable' })

    function taskChange(
      sharedInformationChangeId: string,
      precedingChangeId: string | null,
    ): HistoricalTaskChange {
      return {
        sharedInformationChangeId,
        sharedInformationItemId: taskId,
        precedingChangeId,
        changeKind: 'add',
        sourceType: 'direct',
        primaryActorDisplayName: 'Student',
        targetScope,
        changedAt: now,
        snapshot: {
          title: '数学',
          dueDate: null,
          relatedLessonName: null,
        },
      }
    }
  })

  it('keeps Change Proposal attribution out of Change Detail', async () => {
    const accessStore = await authenticatedStore()
    const taskId = 'task-1'
    const changeId = 'proposal-change'
    const proposal: HistoricalTaskChange = {
      sharedInformationChangeId: changeId,
      sharedInformationItemId: taskId,
      precedingChangeId: null,
      changeKind: 'add',
      sourceType: 'proposal',
      targetScope: {
        type: 'track',
        schoolYear: 2026,
        trackId: 'track-1',
      },
      changedAt: now,
      snapshot: {
        title: '数学',
        dueDate: null,
        relatedLessonName: null,
      },
    }
    const historyStore: EditHistoryStore = {
      findSharedInformationChange: async () => ({
        kind: 'task',
        sharedInformationItemId: taskId,
      }),
      listTaskEditHistory: async () => [proposal],
      listNoteEditHistory: async () => [],
      listTimetableChangeHistory: async () => [],
      listTimetableChangeItemHistory: async () => [],
    }

    await expect(readSharedInformationChangeDetail({
      sessionToken,
      sharedInformationChangeId: changeId,
      now,
      studentAccountStore: accessStore,
      dailyPlanStore: accessStore,
      historyStore,
    })).resolves.toEqual({
      status: 'ready',
      kind: 'task',
      sharedInformationChangeId: changeId,
      sharedInformationItemId: taskId,
      changeKind: 'add',
      source: { type: 'proposal' },
      changedAt: now,
      targetScope: { type: 'track', value: 'track-1' },
      before: null,
      after: {
        title: '数学',
        dueDate: null,
        relatedLessonName: null,
      },
    })
  })

  it('returns proposal-sourced Note detail without changing Note history shape', async () => {
    const accessStore = await authenticatedStore()
    const noteId = 'note-1'
    const targetScope = {
      type: 'track' as const,
      schoolYear: 2026,
      trackId: 'track-1',
    }
    const changes: HistoricalNoteChange[] = [
      {
        sharedInformationChangeId: 'direct-change',
        sharedInformationItemId: noteId,
        precedingChangeId: null,
        changeKind: 'add',
        sourceType: 'direct',
        primaryActorDisplayName: 'Student',
        targetScope,
        changedAt: now,
        snapshot: { body: '提案前' },
        relatedContext: { type: 'none' },
        removalReason: null,
      },
      {
        sharedInformationChangeId: 'proposal-change',
        sharedInformationItemId: noteId,
        precedingChangeId: 'direct-change',
        changeKind: 'update',
        sourceType: 'proposal',
        targetScope,
        changedAt: now + 1,
        snapshot: { body: '提案後' },
        relatedContext: { type: 'none' },
        removalReason: null,
      },
    ]
    const historyStore: EditHistoryStore = {
      findSharedInformationChange: async () => ({
        kind: 'note',
        sharedInformationItemId: noteId,
      }),
      listTaskEditHistory: async () => [],
      listNoteEditHistory: async () => changes,
      listTimetableChangeHistory: async () => [],
      listTimetableChangeItemHistory: async () => [],
    }

    await expect(readSharedInformationChangeDetail({
      sessionToken,
      sharedInformationChangeId: 'proposal-change',
      now,
      studentAccountStore: accessStore,
      dailyPlanStore: accessStore,
      historyStore,
    })).resolves.toEqual({
      status: 'ready',
      kind: 'note',
      sharedInformationChangeId: 'proposal-change',
      sharedInformationItemId: noteId,
      changeKind: 'update',
      source: { type: 'proposal' },
      changedAt: now + 1,
      targetScope: { type: 'track', value: 'track-1' },
      before: { body: '提案前' },
      after: { body: '提案後' },
    })
    await expect(readNoteEditHistory({
      sessionToken,
      sharedInformationItemId: noteId,
      now,
      studentAccountStore: accessStore,
      dailyPlanStore: accessStore,
      historyStore,
    })).resolves.toEqual({
      status: 'ready',
      noteId,
      targetScope: { type: 'track', value: 'track-1' },
      entries: [{
        sharedInformationChangeId: 'direct-change',
        changeKind: 'add',
        sourceType: 'direct',
        primaryActorDisplayName: 'Student',
        changedAt: now,
        before: null,
        after: { body: '提案前' },
      }],
    })
  })

  it('rejects a Note history whose immutable Related Context changes', async () => {
    const accessStore = await authenticatedStore()
    const noteId = 'note-1'
    const common = {
      sharedInformationItemId: noteId,
      sourceType: 'direct' as const,
      targetScope: {
        type: 'track' as const,
        schoolYear: 2026,
        trackId: 'track-1',
      },
      primaryActorDisplayName: 'Student',
      changedAt: now,
      removalReason: null,
    }
    const historyStore: NoteEditHistoryStore = {
      listNoteEditHistory: async () => [
        {
          ...common,
          sharedInformationChangeId: 'change-1',
          changeKind: 'add',
          precedingChangeId: null,
          snapshot: { body: '追加' },
          relatedContext: {
            type: 'school_date',
            schoolDate: '2026-07-27',
          },
        },
        {
          ...common,
          sharedInformationChangeId: 'change-2',
          changeKind: 'update',
          precedingChangeId: 'change-1',
          snapshot: { body: '更新' },
          relatedContext: {
            type: 'school_date',
            schoolDate: '2026-07-28',
          },
        },
      ] satisfies HistoricalNoteChange[],
    }

    await expect(readNoteEditHistory({
      sessionToken,
      sharedInformationItemId: noteId,
      now,
      studentAccountStore: accessStore,
      dailyPlanStore: accessStore,
      historyStore,
    })).resolves.toEqual({ status: 'unavailable' })
  })

  it('rejects branching and cyclic Task history chains', async () => {
    const accessStore = await authenticatedStore()
    const taskId = 'task-1'
    const root = taskHistoryChange({
      sharedInformationChangeId: 'root',
      precedingChangeId: null,
      changeKind: 'add',
    })
    const histories = [
      [
        root,
        taskHistoryChange({
          sharedInformationChangeId: 'left',
          precedingChangeId: 'root',
          changeKind: 'update',
        }),
        taskHistoryChange({
          sharedInformationChangeId: 'right',
          precedingChangeId: 'root',
          changeKind: 'update',
        }),
      ],
      [
        taskHistoryChange({
          sharedInformationChangeId: 'left',
          precedingChangeId: 'right',
          changeKind: 'update',
        }),
        taskHistoryChange({
          sharedInformationChangeId: 'right',
          precedingChangeId: 'left',
          changeKind: 'update',
        }),
      ],
    ]

    for (const changes of histories) {
      await expect(readTaskEditHistory({
        sessionToken,
        sharedInformationItemId: taskId,
        now,
        studentAccountStore: accessStore,
        dailyPlanStore: accessStore,
        historyStore: {
          listTaskEditHistory: async () => changes,
        },
      })).resolves.toEqual({ status: 'unavailable' })
    }

    function taskHistoryChange({
      sharedInformationChangeId,
      precedingChangeId,
      changeKind,
    }: Pick<
      HistoricalTaskChange,
      'sharedInformationChangeId' | 'precedingChangeId' | 'changeKind'
    >): HistoricalTaskChange {
      return {
        sharedInformationChangeId,
        sharedInformationItemId: taskId,
        precedingChangeId,
        changeKind,
        sourceType: 'direct',
        primaryActorDisplayName: 'Student',
        targetScope: {
          type: 'track',
          schoolYear: 2026,
          trackId: 'track-1',
        },
        changedAt: now,
        snapshot: { title: '数学', dueDate: null, relatedLessonName: null },
      }
    }
  })

  it('authorizes the requested Change before rejecting mixed-scope history', async () => {
    const accessStore = await authenticatedStore()
    const taskId = 'task-1'
    const changes: HistoricalTaskChange[] = [
      {
        sharedInformationChangeId: 'allowed-change',
        sharedInformationItemId: taskId,
        precedingChangeId: null,
        changeKind: 'add',
        sourceType: 'direct',
        primaryActorDisplayName: 'Student',
        targetScope: {
          type: 'track',
          schoolYear: 2026,
          trackId: 'track-1',
        },
        changedAt: now,
        snapshot: { title: '数学', dueDate: null, relatedLessonName: null },
      },
      {
        sharedInformationChangeId: 'outside-change',
        sharedInformationItemId: taskId,
        precedingChangeId: 'allowed-change',
        changeKind: 'update',
        sourceType: 'direct',
        primaryActorDisplayName: 'Other Student',
        targetScope: {
          type: 'track',
          schoolYear: 2026,
          trackId: 'track-2',
        },
        changedAt: now + 1,
        snapshot: { title: '英語', dueDate: null, relatedLessonName: null },
      },
    ]
    const historyStore: EditHistoryStore = {
      findSharedInformationChange: async () => ({
        kind: 'task',
        sharedInformationItemId: taskId,
      }),
      listTaskEditHistory: async () => changes,
      listNoteEditHistory: async () => [],
      listTimetableChangeHistory: async () => [],
      listTimetableChangeItemHistory: async () => [],
    }
    const input = {
      sessionToken,
      now,
      studentAccountStore: accessStore,
      dailyPlanStore: accessStore,
      historyStore,
    }

    await expect(readSharedInformationChangeDetail({
      ...input,
      sharedInformationChangeId: 'allowed-change',
    })).resolves.toEqual({ status: 'unavailable' })
    await expect(readSharedInformationChangeDetail({
      ...input,
      sharedInformationChangeId: 'outside-change',
    })).resolves.toEqual({ status: 'not-found' })
  })
})

async function authenticatedStore() {
  const store = new InMemoryPersistenceAdapters()
  await store.saveStudentAccount({
    studentAccountId: 'student-1',
    schoolEmail: 'student@example.invalid',
    displayName: 'Student',
  })
  await store.saveStudentSession({
    sessionTokenHash: await hashToken(sessionToken),
    studentAccountId: 'student-1',
    createdAt: now - 1,
    expiresAt: now + 1,
    invalidatedAt: null,
  })
  await store.saveSchoolYear({
    schoolYear: 2026,
    startsOn: '2026-04-01',
    endsOn: '2027-03-31',
    isCurrent: true,
  })
  await store.saveStudentAffiliation({
    studentAffiliationId: 'affiliation-1',
    studentAccountId: 'student-1',
    schoolYear: 2026,
    grade: 2,
    classId: 'class-1',
    trackId: 'track-1',
    selectedAt: now,
    endedAt: null,
  })
  return store
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
