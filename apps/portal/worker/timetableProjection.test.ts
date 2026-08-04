import { describe, expect, it } from 'vitest'
import {
  InMemoryPersistenceAdapters,
  type ActiveTimetableChange,
} from './persistence'
import {
  createTimetableProjectionModule,
  type TimetableProjectionStore,
} from './timetableProjection'
import { expectTimetableProjectionContract } from './timetableProjectionContract.testSupport'
import { createTargetScopePolicy } from './targetScopePolicy'

const affiliation = {
  studentAffiliationId: 'affiliation-1',
  studentAccountId: 'student-1',
  schoolYear: 2026,
  grade: 2,
  classId: 'class-1',
  trackId: 'track-1',
  selectedAt: 1,
  endedAt: null,
}

describe('InMemory Timetable Projection module', () => {
  it('satisfies the Timetable Projection contract', async () => {
    const implementation = new InMemoryPersistenceAdapters()

    await expectTimetableProjectionContract({
      store: implementation,
      seed: implementation,
      commit: (changes) =>
        implementation.commitDirectChangesForTest(changes),
      seedSchoolStructure: true,
    })
  })

  it('rejects duplicate active Timetable Layers from an adapter', async () => {
    const change = activeChange()
    const projection = createTimetableProjectionModule({
      store: projectionStoreWithChanges([change, { ...change }]),
    })

    await expect(projection.project({
      scopePolicy: createTargetScopePolicy(affiliation),
      schoolDates: ['2026-07-06'],
    })).rejects.toThrow('duplicate active layers')
  })

  it('rejects an invalid period from an adapter', async () => {
    const projection = createTimetableProjectionModule({
      store: projectionStoreWithChanges([activeChange({ periodNumber: 8 })]),
    })

    await expect(projection.project({
      scopePolicy: createTargetScopePolicy(affiliation),
      schoolDates: ['2026-07-06'],
    })).rejects.toThrow('invalid period number')
  })

  it('rejects an invalid Period Reference from an adapter', async () => {
    const projection = createTimetableProjectionModule({
      store: projectionStoreWithChanges([activeChange({
        replacement: {
          type: 'period_reference',
          weekday: 1,
          periodNumber: 8,
        },
      })]),
    })

    await expect(projection.project({
      scopePolicy: createTargetScopePolicy(affiliation),
      schoolDates: ['2026-07-06'],
    })).rejects.toThrow('invalid Period Reference')
  })
})

function projectionStoreWithChanges(
  changes: ActiveTimetableChange[],
): TimetableProjectionStore {
  return {
    async listStandardTimetableEntriesForWeekday() {
      return []
    },
    async findStandardTimetableEntryForFloatingReferenceLabelId() {
      return null
    },
    async listActiveTimetableChanges() {
      return changes
    },
  }
}

function activeChange(
  overrides: Partial<ActiveTimetableChange> = {},
): ActiveTimetableChange {
  return {
    sourceId: 'change-1',
    sharedInformationItemId: 'item-1',
    latestChangeId: 'change-1',
    targetScope: { type: 'class', schoolYear: 2026, classId: 'class-1' },
    changeDate: '2026-07-06',
    periodNumber: 1,
    replacement: { type: 'lesson_name', lessonName: '数学' },
    changedByStudentAccountId: 'student-1',
    changedAt: 1,
    ...overrides,
  }
}
