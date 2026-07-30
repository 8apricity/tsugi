import { expect } from 'vitest'
import type { PersistenceAdapters } from '../persistence'
import type { ReadyStudentOperationalContext } from '../studentOperationalContext'
import {
  affiliationAssertion,
  persistenceIds,
  type AtomicApplicationProgram,
  type ChangeSource,
} from '../sharedInformationChange/atomicProgram'
import { createDirectChangeApplication } from './application'

const taskId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const taskNoteId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const secondNoteId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const updateId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const removalId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

export async function expectDirectChangeApplicationContract(
  persistence: PersistenceAdapters,
  { seedSchoolStructure = true }: { seedSchoolStructure?: boolean } = {},
) {
  const context = await seedReadyContext(persistence, seedSchoolStructure)
  let now = 100
  const application = createDirectChangeApplication({
    catalog: persistence.directChangeCatalog,
    executor: persistence.atomicChangeExecutor,
    clock: () => now,
  })
  const task = {
    kind: 'task',
    changeKind: 'add',
    sourceId: taskId,
    targetScopeType: 'class',
    title: 'Geometry worksheet',
    dueDate: '2026-07-31',
    relatedLessonName: null,
  }
  const taskNote = {
    kind: 'note',
    changeKind: 'add',
    sourceId: taskNoteId,
    targetScopeType: 'class',
    relatedTaskItemId: taskId,
    body: 'Bring a ruler',
  }

  await expect(application.apply({
    context,
    drafts: [taskNote, task],
  })).resolves.toEqual({
    status: 'applied',
    changes: [
      { sourceId: taskNoteId, sharedInformationItemId: taskNoteId },
      { sourceId: taskId, sharedInformationItemId: taskId },
    ],
  })

  now = 200
  const secondNote = {
    kind: 'note',
    changeKind: 'add',
    sourceId: secondNoteId,
    targetScopeType: 'class',
    schoolDate: '2026-07-31',
    body: 'A second note',
  }
  await expect(application.apply({
    context,
    drafts: [task, secondNote],
  })).resolves.toEqual({
    status: 'applied',
    changes: [
      { sourceId: taskId, sharedInformationItemId: taskId },
      { sourceId: secondNoteId, sharedInformationItemId: secondNoteId },
    ],
  })

  await expect(application.apply({
    context,
    drafts: [{ ...secondNote, body: 'Different semantic content' }],
  })).resolves.toEqual({
    status: 'idempotency-conflict',
    sourceIds: [secondNoteId],
  })

  await expect(application.apply({
    context,
    drafts: [
      {
        kind: 'task',
        changeKind: 'update',
        sourceId: updateId,
        sharedInformationItemId: taskId,
        expectedLatestChangeId: 'stale-change',
        targetScopeType: 'class',
        title: 'Changed title',
        dueDate: '2026-07-31',
        relatedLessonName: null,
      },
      {
        kind: 'note',
        changeKind: 'add',
        sourceId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        targetScopeType: 'class',
        schoolDate: '2026-07-31',
        body: 'Must be rolled back',
      },
    ],
  })).resolves.toEqual({
    status: 'conflict',
    sourceIds: [updateId],
  })

  now = 300
  await expect(application.apply({
    context,
    drafts: [{
      kind: 'task',
      changeKind: 'remove',
      sourceId: removalId,
      sharedInformationItemId: taskId,
      expectedLatestChangeId: `${taskId}:change`,
      targetScopeType: 'class',
    }],
  })).resolves.toEqual({
    status: 'applied',
    changes: [{ sourceId: removalId, sharedInformationItemId: taskId }],
  })
  await expect(
    persistence.editHistory.listNoteEditHistory(taskNoteId),
  ).resolves.toEqual([
    expect.objectContaining({
      changeKind: 'add',
      changedAt: 100,
    }),
    expect.objectContaining({
      changeKind: 'remove',
      sharedInformationChangeId:
        `${removalId}:task-cascade:${taskNoteId}:change`,
      precedingChangeId: `${taskNoteId}:change`,
      removalReason: 'task_cascade',
      changedAt: 300,
    }),
  ])

  return context
}

export async function expectChangeSourceIsolationContract(
  persistence: PersistenceAdapters,
  { seedSchoolStructure = true }: { seedSchoolStructure?: boolean } = {},
) {
  const context = await seedReadyContext(persistence, seedSchoolStructure)
  const sharedSourceId = 'source-shared-across-origin-types'
  const proposalSource: ChangeSource = {
    type: 'proposal',
    changeProposalId: sharedSourceId,
  }
  const directSource: ChangeSource = {
    type: 'direct',
    directChangeId: sharedSourceId,
  }
  const program = (
    source: ChangeSource,
    sharedInformationItemId: string,
    body: string,
    appliedAt: number,
  ): AtomicApplicationProgram => ({
    affiliation: affiliationAssertion(context),
    appliedAt,
    changes: [{
      kind: 'note',
      changeKind: 'add',
      source,
      persistenceIds: persistenceIds(source),
      sharedInformationItemId,
      targetScope: {
        type: 'class',
        schoolYear: 2026,
        classId: '2026-grade-2-class-3',
      },
      changedByStudentAccountId: context.studentAccount.studentAccountId,
      schoolDate: null,
      periodNumber: null,
      body,
    }],
  })
  const proposalProgram = program(
    proposalSource,
    'proposal-note-item',
    'Proposal note',
    400,
  )
  const directProgram = program(
    directSource,
    'direct-note-item',
    'Direct note',
    500,
  )

  await expect(
    persistence.atomicChangeExecutor.execute(proposalProgram),
  ).resolves.toEqual({
    status: 'applied',
    changes: [{
      sourceId: sharedSourceId,
      sharedInformationItemId: 'proposal-note-item',
    }],
  })
  await expect(
    persistence.atomicChangeExecutor.execute(proposalProgram),
  ).resolves.toEqual({
    status: 'applied',
    changes: [{
      sourceId: sharedSourceId,
      sharedInformationItemId: 'proposal-note-item',
    }],
  })
  await expect(
    persistence.atomicChangeExecutor.execute(directProgram),
  ).resolves.toEqual({
    status: 'applied',
    changes: [{
      sourceId: sharedSourceId,
      sharedInformationItemId: 'direct-note-item',
    }],
  })

  await expect(
    persistence.editHistory.listNoteEditHistory('proposal-note-item'),
  ).resolves.toEqual([
    expect.objectContaining({
      sharedInformationChangeId:
        `proposal:${sharedSourceId}:change`,
      sourceType: 'proposal',
      changedAt: 400,
    }),
  ])
  await expect(
    persistence.editHistory.listNoteEditHistory('direct-note-item'),
  ).resolves.toEqual([
    expect.objectContaining({
      sharedInformationChangeId: `${sharedSourceId}:change`,
      sourceType: 'direct',
      changedAt: 500,
    }),
  ])
}

async function seedReadyContext(
  persistence: PersistenceAdapters,
  seedSchoolStructure: boolean,
): Promise<ReadyStudentOperationalContext> {
  const context: ReadyStudentOperationalContext = {
    status: 'ready',
    studentAccount: {
      studentAccountId: 'contract-student',
      schoolEmail: 'contract@example.invalid',
      displayName: 'Contract Student',
    },
    currentSchoolYear: {
      schoolYear: 2026,
      startsOn: '2026-04-01',
      endsOn: '2027-03-31',
      isCurrent: true,
    },
    studentAffiliation: {
      studentAffiliationId: 'contract-affiliation',
      studentAccountId: 'contract-student',
      schoolYear: 2026,
      grade: 2,
      classId: '2026-grade-2-class-3',
      trackId: '2026-grade-2-class-3-humanities',
      selectedAt: 1,
      endedAt: null,
    },
  }
  await persistence.seed.saveStudentAccount(context.studentAccount)
  if (seedSchoolStructure) {
    await persistence.seed.saveSchoolYear(context.currentSchoolYear)
    await persistence.seed.saveSchoolYearClass({
      classId: '2026-grade-2-class-3',
      schoolYear: 2026,
      grade: 2,
      classNumber: 3,
    })
    await persistence.seed.saveTrack({
      trackId: '2026-grade-2-class-3-humanities',
      classId: '2026-grade-2-class-3',
      trackName: 'Humanities',
    })
  }
  await persistence.seed.saveStudentAffiliation(context.studentAffiliation)
  return context
}
