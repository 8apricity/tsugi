import { expect } from 'vitest'
import type {
  DirectChangeOperation,
  PersistenceSeedStore,
  StudentAffiliation,
} from './persistence'
import {
  createTimetableProjectionModule,
  type TimetableProjectionStore,
} from './timetableProjection'
import { createTargetScopePolicy } from './targetScopePolicy'

const affiliation: StudentAffiliation = {
  studentAffiliationId: 'projection-contract-affiliation',
  studentAccountId: 'projection-contract-student',
  schoolYear: 2026,
  grade: 2,
  classId: '2026-grade-2-class-3',
  trackId: '2026-grade-2-class-3-humanities',
  selectedAt: 1,
  endedAt: null,
}

export async function expectTimetableProjectionContract({
  store,
  seed,
  commit,
  seedSchoolStructure,
}: {
  store: TimetableProjectionStore
  seed: PersistenceSeedStore
  commit(changes: DirectChangeOperation[]): Promise<unknown>
  seedSchoolStructure: boolean
}) {
  await seed.saveStudentAccount({
    studentAccountId: affiliation.studentAccountId,
    schoolEmail: 'projection-contract@example.invalid',
    displayName: 'Projection Contract',
  })
  if (seedSchoolStructure) {
    await seed.saveSchoolYear({
      schoolYear: 2026,
      startsOn: '2026-04-01',
      endsOn: '2027-03-31',
      isCurrent: true,
    })
    await seed.saveSchoolYearClass({
      classId: affiliation.classId,
      schoolYear: 2026,
      grade: 2,
      classNumber: 3,
    })
    await seed.saveTrack({
      trackId: affiliation.trackId,
      classId: affiliation.classId,
      trackName: 'Humanities',
    })
  }
  await seedLesson(seed, 'projection-contract-english', '契約英語')
  await seedLesson(seed, 'projection-contract-physics', '契約物理')
  await seedLesson(seed, 'projection-contract-classics', '契約古典')
  await seed.saveStandardTimetableEntry({
    standardTimetableEntryId: 'projection-contract-saturday-2-common',
    classId: affiliation.classId,
    trackId: null,
    referenceType: 'period',
    weekday: 6,
    periodNumber: 2,
    registeredLessonNameId: 'projection-contract-english',
  })
  await seed.saveStandardTimetableEntry({
    standardTimetableEntryId: 'projection-contract-saturday-2-track',
    classId: affiliation.classId,
    trackId: affiliation.trackId,
    referenceType: 'period',
    weekday: 6,
    periodNumber: 2,
    registeredLessonNameId: 'projection-contract-physics',
  })
  await seed.saveStandardTimetableEntry({
    standardTimetableEntryId: 'projection-contract-saturday-3-common',
    classId: affiliation.classId,
    trackId: null,
    referenceType: 'period',
    weekday: 6,
    periodNumber: 3,
    registeredLessonNameId: 'projection-contract-classics',
  })
  await expect(commit([
    timetableChange({
      sourceId: '97111111-1111-4111-8111-111111111111',
      targetScope: { type: 'grade', schoolYear: 2026, grade: 2 },
      replacement: { type: 'lesson_name', lessonName: '契約体育' },
      changedAt: 100,
    }),
    timetableChange({
      sourceId: '97222222-2222-4222-8222-222222222222',
      targetScope: {
        type: 'track',
        schoolYear: 2026,
        trackId: affiliation.trackId,
      },
      replacement: {
        type: 'period_reference',
        weekday: 6,
        periodNumber: 3,
      },
      changedAt: 200,
    }),
  ])).resolves.toMatchObject({ status: 'applied' })

  const result = await createTimetableProjectionModule({ store }).project({
    scopePolicy: createTargetScopePolicy(affiliation),
    schoolDates: ['2026-07-04'],
  })

  expect(result).toHaveLength(7)
  expect(result).toContainEqual({
    schoolDate: '2026-07-04',
    periodNumber: 2,
    standardTimetable: {
      lessonName: '契約物理',
      periodReference: { weekday: 6, periodNumber: 2 },
    },
    layers: [
      projectedActiveLayer({
        targetScopeType: 'grade',
        sourceId: '97111111-1111-4111-8111-111111111111',
        replacement: { type: 'lesson_name', lessonName: '契約体育' },
        changedAt: 100,
      }),
      projectedUnchangedLayer('class'),
      projectedActiveLayer({
        targetScopeType: 'track',
        sourceId: '97222222-2222-4222-8222-222222222222',
        replacement: {
          type: 'period_reference',
          weekday: 6,
          periodNumber: 3,
        },
        changedAt: 200,
      }),
      projectedUnchangedLayer('student'),
    ],
    finalDailyLesson: {
      lessonName: '契約古典',
      lessonReference: {
        type: 'period_reference',
        weekday: 6,
        periodNumber: 3,
      },
      timetableChangeState: 'resolved',
    },
  })
}

async function seedLesson(
  seed: PersistenceSeedStore,
  registeredLessonNameId: string,
  lessonName: string,
) {
  await seed.saveRegisteredLessonName({
    registeredLessonNameId,
    fullLessonName: lessonName,
    shortLessonName: lessonName,
    normalizedFullLessonName: lessonName,
  })
}

function timetableChange({
  sourceId,
  targetScope,
  replacement,
  changedAt,
}: {
  sourceId: string
  targetScope: Extract<
    DirectChangeOperation,
    { kind: 'timetable_change' }
  >['targetScope']
  replacement: Extract<
    DirectChangeOperation,
    { kind: 'timetable_change'; changeKind: 'add' }
  >['replacement']
  changedAt: number
}): DirectChangeOperation {
  return {
    kind: 'timetable_change',
    changeKind: 'add',
    sourceId,
    sharedInformationItemId: sourceId,
    latestChangeId: `${sourceId}:change`,
    targetScope,
    changeDate: '2026-07-04',
    periodNumber: 2,
    replacement,
    changedByStudentAccountId: affiliation.studentAccountId,
    changedAt,
  }
}

function projectedActiveLayer({
  targetScopeType,
  sourceId,
  replacement,
  changedAt,
}: {
  targetScopeType: 'grade' | 'class' | 'track' | 'student'
  sourceId: string
  replacement: Extract<
    DirectChangeOperation,
    { kind: 'timetable_change'; changeKind: 'add' }
  >['replacement']
  changedAt: number
}) {
  return {
    targetScopeType,
    active: {
      targetScopeType,
      sharedInformationItemId: sourceId,
      latestChangeId: `${sourceId}:change`,
      replacement,
      changedAt,
    },
    desired: null,
    projected: { state: 'active', replacement },
  }
}

function projectedUnchangedLayer(
  targetScopeType: 'grade' | 'class' | 'track' | 'student',
) {
  return {
    targetScopeType,
    active: null,
    desired: null,
    projected: { state: 'unchanged' },
  }
}
