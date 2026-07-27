import { describe, expect, it } from 'vitest'
import {
  InMemoryPersistenceAdapters,
  type EditHistoryStore,
  type HistoricalTaskChange,
  type HistoricalTimetableChange,
  type TaskEditHistoryStore,
  type TimetableChangeHistoryStore,
} from './persistence'
import {
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
