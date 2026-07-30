import { describe, expect, it } from 'vitest'
import {
  createD1AtomicChangeExecutor,
} from './d1AtomicChangeExecutor'
import type { AtomicApplicationProgram } from './atomicProgram'
import { StorageUnavailableError } from './storageError'

const program: AtomicApplicationProgram = {
  affiliation: {
    studentAffiliationId: 'affiliation-1',
    studentAccountId: 'student-1',
    schoolYear: 2026,
    grade: 2,
    classId: 'class-1',
    trackId: 'track-1',
    selectedAt: 1,
  },
  appliedAt: 100,
  changes: [{
    kind: 'note',
    changeKind: 'add',
    source: {
      type: 'direct',
      directChangeId: '11111111-1111-4111-8111-111111111111',
    },
    persistenceIds: {
      sharedInformationChangeId:
        '11111111-1111-4111-8111-111111111111:change',
      snapshotId: '11111111-1111-4111-8111-111111111111:snapshot',
      targetScopeId: '11111111-1111-4111-8111-111111111111:scope',
      targetScopePartId: '11111111-1111-4111-8111-111111111111:part',
    },
    sharedInformationItemId: '11111111-1111-4111-8111-111111111111',
    targetScope: {
      type: 'class',
      schoolYear: 2026,
      classId: 'class-1',
    },
    changedByStudentAccountId: 'student-1',
    schoolDate: null,
    periodNumber: null,
    body: 'Note',
  }],
}

describe('D1AtomicChangeExecutor failures', () => {
  it('returns invalid-change when a stable catalog reference disappears before commit', async () => {
    const sourceKey =
      'direct:11111111-1111-4111-8111-111111111111'
    let loadCount = 0
    const executor = createD1AtomicChangeExecutor({
      loadSnapshot: async () => ({
        existingBySource: new Map(),
        activeTimetableByItem: new Map(),
        activeTaskByItem: new Map(),
        activeNoteByItem: new Map(),
        occupiedItemIds: new Set(),
        occupiedTimetableSlots: new Set(),
        invalidReferenceSourceKeys: loadCount++ === 0
          ? new Set()
          : new Set([sourceKey]),
        affiliationMatches: true,
      }),
      commit: async () => {
        throw new Error('FOREIGN KEY constraint failed')
      },
    })

    await expect(executor.execute(program)).resolves.toEqual({
      status: 'invalid-change',
      sourceIds: ['11111111-1111-4111-8111-111111111111'],
    })
  })

  it('turns a known unavailable D1 failure into StorageUnavailableError', async () => {
    const executor = createD1AtomicChangeExecutor({
      loadSnapshot: async () => {
        throw new Error('D1_ERROR: Network connection lost.')
      },
      commit: async () => undefined,
    })

    await expect(executor.execute(program)).rejects.toBeInstanceOf(
      StorageUnavailableError,
    )
  })

  it('does not classify an unmarked application error as D1 unavailable', async () => {
    const failure = new Error('database unavailable')
    const executor = createD1AtomicChangeExecutor({
      loadSnapshot: async () => {
        throw failure
      },
      commit: async () => undefined,
    })

    await expect(executor.execute(program)).rejects.toBe(failure)
  })

  it('does not turn an unknown programming or constraint failure into conflict', async () => {
    const failure = new Error('NOT NULL constraint failed')
    const executor = createD1AtomicChangeExecutor({
      loadSnapshot: async () => {
        throw failure
      },
      commit: async () => undefined,
    })

    await expect(executor.execute(program)).rejects.toBe(failure)
  })
})
