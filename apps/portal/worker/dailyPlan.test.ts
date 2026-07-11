import { describe, expect, it } from 'vitest'
import { createInMemoryPersistenceAdapters } from './persistence'
import { readDailyPlan, readDailyPlansRange } from './dailyPlan'
import { createStudentAccountAccess } from './studentAccountAccess'

const studentAccountId = 'test-student-2026-2-3-humanities-1'
const sessionToken = 'daily-plan-test-session'

async function createReadyDailyPlanStore() {
  const store = createInMemoryPersistenceAdapters()

  await store.seed.saveStudentAccount({
    studentAccountId,
    schoolEmail: 'test-student@example.invalid',
    displayName: 'Test Student',
  })
  await store.seed.saveSchoolYear({
    schoolYear: 2026,
    startsOn: '2026-04-01',
    endsOn: '2027-03-31',
    isCurrent: true,
  })
  await store.seed.saveSchoolYearClass({
    classId: '2026-grade-2-class-3',
    schoolYear: 2026,
    grade: 2,
    classNumber: 3,
  })
  await store.seed.saveTrack({
    trackId: '2026-grade-2-class-3-humanities',
    classId: '2026-grade-2-class-3',
    trackName: '文科',
  })
  await store.seed.saveStudentAffiliation({
    studentAffiliationId: 'affiliation-1',
    studentAccountId,
    schoolYear: 2026,
    grade: 2,
    classId: '2026-grade-2-class-3',
    trackId: '2026-grade-2-class-3-humanities',
    selectedAt: Date.UTC(2026, 3, 1),
    endedAt: null,
  })
  await store.seed.saveStandardTimetableEntry({
    standardTimetableEntryId: 'fri-1-common',
    classId: '2026-grade-2-class-3',
    trackId: null,
    referenceType: 'period',
    weekday: 5,
    periodNumber: 1,
    lessonName: '地理',
  })
  await store.seed.saveStandardTimetableEntry({
    standardTimetableEntryId: 'fri-4-common',
    classId: '2026-grade-2-class-3',
    trackId: null,
    referenceType: 'period',
    weekday: 5,
    periodNumber: 4,
    lessonName: '共通授業',
  })
  await store.seed.saveStandardTimetableEntry({
    standardTimetableEntryId: 'fri-4-humanities',
    classId: '2026-grade-2-class-3',
    trackId: '2026-grade-2-class-3-humanities',
    referenceType: 'period',
    weekday: 5,
    periodNumber: 4,
    lessonName: '現代文',
  })
  await createStudentAccountAccess({
    studentAccountStore: store.studentAccount,
    studentAffiliationStore: store.studentAffiliation,
    sendEmail: async () => undefined,
    generateSessionToken: () => sessionToken,
  }).createTestLoginSession({
    studentAccountId,
    now: Date.UTC(2026, 6, 10),
  })

  return store
}

describe('Daily Plan module', () => {
  it('rejects an unauthenticated Daily Plan read', async () => {
    const store = createInMemoryPersistenceAdapters()
    const result = await readDailyPlan({
      sessionToken: null,
      schoolDate: '2026-07-10',
      now: Date.UTC(2026, 6, 10),
      studentAccountStore: store.studentAccount,
      dailyPlanStore: store.dailyPlan,
    })

    expect(result).toEqual({ status: 'unauthenticated' })
  })

  it('projects Student Affiliation, Standard Timetable, Tasks, and Notes for a Daily Plan', async () => {
    const store = await createReadyDailyPlanStore()
    const result = await readDailyPlan({
      sessionToken,
      schoolDate: '2026-07-10',
      now: Date.UTC(2026, 6, 10),
      studentAccountStore: store.studentAccount,
      dailyPlanStore: store.dailyPlan,
    })

    expect(result).toMatchObject({
      status: 'ready',
      schoolDate: '2026-07-10',
      weekday: 5,
      studentAffiliation: {
        schoolYear: 2026,
        grade: 2,
        classNumber: 3,
        trackName: '文科',
      },
      tasks: [
        { taskId: 'placeholder-task-geography-worksheet' },
        { taskId: 'placeholder-task-modern-japanese-reading' },
      ],
      notes: [
        { noteId: 'placeholder-school-date-note-2026-07-10' },
        { noteId: 'placeholder-no-context-note' },
      ],
    })
    if (result.status !== 'ready') {
      return
    }

    expect(
      result.periods.map(({ periodNumber, lessonName, hasTasks }) => ({
        periodNumber,
        lessonName,
        hasTasks,
      })),
    ).toEqual([
      { periodNumber: 1, lessonName: '地理', hasTasks: true },
      { periodNumber: 2, lessonName: '', hasTasks: false },
      { periodNumber: 3, lessonName: '', hasTasks: false },
      { periodNumber: 4, lessonName: '現代文', hasTasks: true },
      { periodNumber: 5, lessonName: '', hasTasks: false },
      { periodNumber: 6, lessonName: '', hasTasks: false },
      { periodNumber: 7, lessonName: '', hasTasks: false },
    ])
  })

  it('uses the current JST date when no school date is selected', async () => {
    const store = await createReadyDailyPlanStore()
    const result = await readDailyPlan({
      sessionToken,
      schoolDate: null,
      now: Date.UTC(2026, 6, 9, 15),
      studentAccountStore: store.studentAccount,
      dailyPlanStore: store.dailyPlan,
    })

    expect(result).toMatchObject({ status: 'ready', schoolDate: '2026-07-10' })
  })

  it('rejects invalid dates and ranges longer than 31 days', async () => {
    const store = await createReadyDailyPlanStore()

    await expect(
      readDailyPlan({
        sessionToken,
        schoolDate: '2026-02-31',
        now: Date.UTC(2026, 6, 10),
        studentAccountStore: store.studentAccount,
        dailyPlanStore: store.dailyPlan,
      }),
    ).resolves.toEqual({ status: 'invalid-date' })
    await expect(
      readDailyPlansRange({
        sessionToken,
        start: '2026-07-01',
        end: '2026-08-01',
        now: Date.UTC(2026, 6, 10),
        studentAccountStore: store.studentAccount,
        dailyPlanStore: store.dailyPlan,
      }),
    ).resolves.toEqual({ status: 'date-range-too-large' })
  })

  it('returns a school-date keyed range for a Multi-Day Plan', async () => {
    const store = await createReadyDailyPlanStore()
    const result = await readDailyPlansRange({
      sessionToken,
      start: '2026-07-09',
      end: '2026-07-11',
      now: Date.UTC(2026, 6, 10),
      studentAccountStore: store.studentAccount,
      dailyPlanStore: store.dailyPlan,
    })

    expect(result.status).toBe('ready')
    if (result.status !== 'ready') {
      return
    }

    expect(Object.keys(result.dailyPlans)).toEqual([
      '2026-07-09',
      '2026-07-10',
      '2026-07-11',
    ])
    expect(result.dailyPlans['2026-07-10']).toMatchObject({
      schoolDate: '2026-07-10',
      weekday: 5,
      schoolYearRange: {
        startsOn: '2026-04-01',
        endsOn: '2027-03-31',
      },
    })
  })
})
