import { describe, expect, it } from 'vitest'
import { createInMemoryPersistenceAdapters } from '../persistence'
import type { ReadyStudentOperationalContext } from '../studentOperationalContext'
import { createDirectChangeApplication } from './application'
import {
  expectChangeSourceIsolationContract,
  expectDirectChangeApplicationContract,
} from './applicationContract.testSupport'

const taskSourceId = '11111111-1111-4111-8111-111111111111'
const noteSourceId = '22222222-2222-4222-8222-222222222222'
const updateSourceId = '33333333-3333-4333-8333-333333333333'

describe('DirectChangeApplication', () => {
  it('satisfies the shared application contract with InMemory storage', async () => {
    await expectDirectChangeApplicationContract(
      createInMemoryPersistenceAdapters(),
    )
  })

  it('isolates Direct and Proposal sources with the same external ID', async () => {
    await expectChangeSourceIsolationContract(
      createInMemoryPersistenceAdapters(),
    )
  })

  it('serializes concurrent InMemory applications against the same slot', async () => {
    const { persistence, context } = await createReadyHarness()
    const application = createDirectChangeApplication({
      catalog: persistence.directChangeCatalog,
      executor: persistence.atomicChangeExecutor,
      clock: () => 100,
    })
    const draft = (sourceId: string) => ({
      kind: 'timetable_change',
      changeKind: 'add',
      sourceId,
      targetScopeType: 'class',
      changeDate: '2026-07-31',
      periodNumber: 1,
      replacement: { type: 'cancelled' },
    })

    const results = await Promise.all([
      application.apply({ context, drafts: [draft(taskSourceId)] }),
      application.apply({ context, drafts: [draft(noteSourceId)] }),
    ])

    expect(results.map((result) => result.status).sort()).toEqual([
      'applied',
      'conflict',
    ])
  })

  it('applies an unordered Task and related Note batch atomically', async () => {
    const persistence = createInMemoryPersistenceAdapters()
    const context: ReadyStudentOperationalContext = {
      status: 'ready',
      studentAccount: {
        studentAccountId: 'student-1',
        schoolEmail: 'student@example.invalid',
        displayName: 'Student',
      },
      currentSchoolYear: {
        schoolYear: 2026,
        startsOn: '2026-04-01',
        endsOn: '2027-03-31',
        isCurrent: true,
      },
      studentAffiliation: {
        studentAffiliationId: 'affiliation-1',
        studentAccountId: 'student-1',
        schoolYear: 2026,
        grade: 2,
        classId: 'class-1',
        trackId: 'track-1',
        selectedAt: 1,
        endedAt: null,
      },
    }
    await persistence.seed.saveStudentAccount(context.studentAccount)
    await persistence.seed.saveSchoolYear(context.currentSchoolYear)
    await persistence.seed.saveSchoolYearClass({
      classId: 'class-1',
      schoolYear: 2026,
      grade: 2,
      classNumber: 1,
    })
    await persistence.seed.saveTrack({
      trackId: 'track-1',
      classId: 'class-1',
      trackName: 'Track',
    })
    await persistence.seed.saveStudentAffiliation(context.studentAffiliation)

    const application = createDirectChangeApplication({
      catalog: persistence.directChangeCatalog,
      executor: persistence.atomicChangeExecutor,
      clock: () => 123_456,
    })

    await expect(application.apply({
      context,
      drafts: [
        {
          kind: 'note',
          changeKind: 'add',
          sourceId: noteSourceId,
          targetScopeType: 'class',
          relatedTaskItemId: taskSourceId,
          body: 'Bring a ruler',
        },
        {
          kind: 'task',
          changeKind: 'add',
          sourceId: taskSourceId,
          targetScopeType: 'class',
          title: 'Geometry worksheet',
          dueDate: '2026-07-31',
          relatedLessonName: null,
        },
      ],
    })).resolves.toEqual({
      status: 'applied',
      changes: [
        {
          sourceId: noteSourceId,
          sharedInformationItemId: noteSourceId,
        },
        {
          sourceId: taskSourceId,
          sharedInformationItemId: taskSourceId,
        },
      ],
    })

    await expect(
      persistence.dailyPlan.listActiveNotesForStudent(
        context.studentAffiliation,
        '2026-07-31',
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        sharedInformationItemId: noteSourceId,
        relatedTaskItemId: taskSourceId,
        body: 'Bring a ruler',
        changedAt: 123_456,
      }),
    ])
  })

  it('treats a Registered Lesson Name retry as the same change after its display name changes', async () => {
    const { persistence, context } = await createReadyHarness()
    await persistence.seed.saveRegisteredLessonName({
      registeredLessonNameId: 'mathematics',
      fullLessonName: 'Mathematics',
      shortLessonName: 'Math',
      normalizedFullLessonName: 'mathematics',
    })
    const application = createDirectChangeApplication({
      catalog: persistence.directChangeCatalog,
      executor: persistence.atomicChangeExecutor,
      clock: () => 123_456,
    })
    const draft = {
      kind: 'task',
      changeKind: 'add',
      sourceId: taskSourceId,
      targetScopeType: 'class',
      title: 'Geometry worksheet',
      dueDate: '2026-07-31',
      relatedLessonName: { registeredLessonNameId: 'mathematics' },
    }

    await expect(application.apply({ context, drafts: [draft] }))
      .resolves.toMatchObject({ status: 'applied' })
    await persistence.seed.saveRegisteredLessonName({
      registeredLessonNameId: 'mathematics',
      fullLessonName: 'Mathematics',
      shortLessonName: 'Mathematics',
      normalizedFullLessonName: 'mathematics',
    })

    await expect(application.apply({ context, drafts: [draft] })).resolves.toEqual({
      status: 'applied',
      changes: [{
        sourceId: taskSourceId,
        sharedInformationItemId: taskSourceId,
      }],
    })
  })

  it('returns receipts for exact replays while applying only new changes', async () => {
    const { persistence, context } = await createReadyHarness()
    let now = 100
    const application = createDirectChangeApplication({
      catalog: persistence.directChangeCatalog,
      executor: persistence.atomicChangeExecutor,
      clock: () => now,
    })
    const task = {
      kind: 'task',
      changeKind: 'add',
      sourceId: taskSourceId,
      targetScopeType: 'class',
      title: 'Geometry worksheet',
      dueDate: '2026-07-31',
      relatedLessonName: null,
    }
    await application.apply({ context, drafts: [task] })
    now = 200

    await expect(application.apply({
      context,
      drafts: [
        task,
        {
          kind: 'note',
          changeKind: 'add',
          sourceId: noteSourceId,
          targetScopeType: 'class',
          schoolDate: '2026-07-31',
          body: 'Bring a ruler',
        },
      ],
    })).resolves.toEqual({
      status: 'applied',
      changes: [
        {
          sourceId: taskSourceId,
          sharedInformationItemId: taskSourceId,
        },
        {
          sourceId: noteSourceId,
          sharedInformationItemId: noteSourceId,
        },
      ],
    })
    await expect(
      persistence.dailyPlan.listActiveTasksForStudent(
        context.studentAffiliation,
        '2026-07-31',
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        sharedInformationItemId: taskSourceId,
        changedAt: 100,
      }),
    ])
    await expect(
      persistence.dailyPlan.listActiveNotesForStudent(
        context.studentAffiliation,
        '2026-07-31',
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        sharedInformationItemId: noteSourceId,
        changedAt: 200,
      }),
    ])
  })

  it('does not apply the valid part of a batch when another change is stale', async () => {
    const { persistence, context } = await createReadyHarness()
    const application = createDirectChangeApplication({
      catalog: persistence.directChangeCatalog,
      executor: persistence.atomicChangeExecutor,
      clock: () => 100,
    })
    await application.apply({
      context,
      drafts: [{
        kind: 'task',
        changeKind: 'add',
        sourceId: taskSourceId,
        targetScopeType: 'class',
        title: 'Geometry worksheet',
        dueDate: '2026-07-31',
        relatedLessonName: null,
      }],
    })

    await expect(application.apply({
      context,
      drafts: [
        {
          kind: 'task',
          changeKind: 'update',
          sourceId: updateSourceId,
          sharedInformationItemId: taskSourceId,
          expectedLatestChangeId: 'stale-change',
          targetScopeType: 'class',
          title: 'Changed title',
          dueDate: '2026-07-31',
          relatedLessonName: null,
        },
        {
          kind: 'note',
          changeKind: 'add',
          sourceId: noteSourceId,
          targetScopeType: 'class',
          schoolDate: '2026-07-31',
          body: 'Must not be saved',
        },
      ],
    })).resolves.toEqual({
      status: 'conflict',
      sourceIds: [updateSourceId],
    })
    await expect(
      persistence.dailyPlan.listActiveNotesForStudent(
        context.studentAffiliation,
        '2026-07-31',
      ),
    ).resolves.toEqual([])
  })

  it('removes all current Task Notes with the parent removal time and cause', async () => {
    const { persistence, context } = await createReadyHarness()
    let now = 100
    const application = createDirectChangeApplication({
      catalog: persistence.directChangeCatalog,
      executor: persistence.atomicChangeExecutor,
      clock: () => now,
    })
    await application.apply({
      context,
      drafts: [
        {
          kind: 'task',
          changeKind: 'add',
          sourceId: taskSourceId,
          targetScopeType: 'class',
          title: 'Geometry worksheet',
          dueDate: '2026-07-31',
          relatedLessonName: null,
        },
        {
          kind: 'note',
          changeKind: 'add',
          sourceId: noteSourceId,
          targetScopeType: 'class',
          relatedTaskItemId: taskSourceId,
          body: 'Bring a ruler',
        },
      ],
    })
    now = 200

    await expect(application.apply({
      context,
      drafts: [{
        kind: 'task',
        changeKind: 'remove',
        sourceId: updateSourceId,
        sharedInformationItemId: taskSourceId,
        expectedLatestChangeId: `${taskSourceId}:change`,
        targetScopeType: 'class',
      }],
    })).resolves.toMatchObject({ status: 'applied' })

    await expect(
      persistence.editHistory.listNoteEditHistory(noteSourceId),
    ).resolves.toEqual([
      expect.objectContaining({
        changeKind: 'add',
        sharedInformationChangeId: `${noteSourceId}:change`,
        changedAt: 100,
      }),
      expect.objectContaining({
        changeKind: 'remove',
        sharedInformationChangeId:
          `${updateSourceId}:task-cascade:${noteSourceId}:change`,
        precedingChangeId: `${noteSourceId}:change`,
        removalReason: 'task_cascade',
        changedAt: 200,
      }),
    ])
  })

  it('rejects pending changes when the ready affiliation has ended', async () => {
    const { persistence, context } = await createReadyHarness()
    await persistence.seed.saveStudentAffiliation({
      ...context.studentAffiliation,
      endedAt: 50,
    })
    const application = createDirectChangeApplication({
      catalog: persistence.directChangeCatalog,
      executor: persistence.atomicChangeExecutor,
      clock: () => 100,
    })

    await expect(application.apply({
      context,
      drafts: [{
        kind: 'task',
        changeKind: 'add',
        sourceId: taskSourceId,
        targetScopeType: 'class',
        title: 'Geometry worksheet',
        dueDate: '2026-07-31',
        relatedLessonName: null,
      }],
    })).resolves.toEqual({
      status: 'conflict',
      sourceIds: [taskSourceId],
    })
  })

  it('rejects two kinds mutating the same Shared Information Item', async () => {
    const { persistence, context } = await createReadyHarness()
    const application = createDirectChangeApplication({
      catalog: persistence.directChangeCatalog,
      executor: persistence.atomicChangeExecutor,
      clock: () => 100,
    })

    await expect(application.apply({
      context,
      drafts: [
        {
          kind: 'task',
          changeKind: 'remove',
          sourceId: taskSourceId,
          sharedInformationItemId: noteSourceId,
          expectedLatestChangeId: 'task-base',
          targetScopeType: 'class',
        },
        {
          kind: 'note',
          changeKind: 'remove',
          sourceId: updateSourceId,
          sharedInformationItemId: noteSourceId,
          expectedLatestChangeId: 'note-base',
          targetScopeType: 'class',
        },
      ],
    })).resolves.toEqual({
      status: 'invalid-change',
      sourceIds: [taskSourceId, updateSourceId],
    })
  })
})

async function createReadyHarness() {
  const persistence = createInMemoryPersistenceAdapters()
  const context: ReadyStudentOperationalContext = {
    status: 'ready',
    studentAccount: {
      studentAccountId: 'student-1',
      schoolEmail: 'student@example.invalid',
      displayName: 'Student',
    },
    currentSchoolYear: {
      schoolYear: 2026,
      startsOn: '2026-04-01',
      endsOn: '2027-03-31',
      isCurrent: true,
    },
    studentAffiliation: {
      studentAffiliationId: 'affiliation-1',
      studentAccountId: 'student-1',
      schoolYear: 2026,
      grade: 2,
      classId: 'class-1',
      trackId: 'track-1',
      selectedAt: 1,
      endedAt: null,
    },
  }
  await persistence.seed.saveStudentAccount(context.studentAccount)
  await persistence.seed.saveSchoolYear(context.currentSchoolYear)
  await persistence.seed.saveSchoolYearClass({
    classId: 'class-1',
    schoolYear: 2026,
    grade: 2,
    classNumber: 1,
  })
  await persistence.seed.saveTrack({
    trackId: 'track-1',
    classId: 'class-1',
    trackName: 'Track',
  })
  await persistence.seed.saveStudentAffiliation(context.studentAffiliation)
  return { persistence, context }
}
