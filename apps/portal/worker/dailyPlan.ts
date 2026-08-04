import {
  type ProjectedDailyLesson,
  type TimetableReference,
} from '../shared/timetableProjection'
import {
  type DailyPlanStore,
  type SchoolYearClassRecord,
  type StudentAffiliation,
  type StudentAccountAccessStore,
  type TrackRecord,
} from './persistence'
import {
  resolveStudentOperationalContext,
  type StudentOperationalContextResult,
} from './studentOperationalContext'
import {
  isValidSchoolDate,
  weekdayForSchoolDate,
} from './timetable'
import { createTimetableProjectionModule } from './timetableProjection'

type DailyPlanTask = {
  taskId: string
  latestChangeId: string
  title: string
  dueDate: string | null
  relatedLessonName?: string
  registeredRelatedLessonNameId?: string
  targetScopeType: 'grade' | 'class' | 'track' | 'student'
  createdAt: number
  notes: DailyPlanNote[]
}

type DailyPlanNote = {
  noteId: string
  latestChangeId: string
  body: string
  targetScopeType: 'grade' | 'class' | 'track' | 'student'
  relatedContext:
    | {
        type: 'daily-lesson'
        schoolDate: string
        periodNumber: number
      }
    | {
        type: 'school-date'
        schoolDate: string
      }
    | {
        type: 'task'
        taskId: string
      }
    | null
}

export type DailyPlanResult =
  | {
      status: 'ready'
      schoolDate: string
      weekday: number
      studentAffiliation: {
        schoolYear: number
        grade: number
        classId: string
        classNumber: number
        trackId: string
        trackName: string
      }
      schoolYearRange: {
        startsOn: string
        endsOn: string
      }
      periods: Array<{
        periodNumber: number
        lessonName: string
        lessonReference?: TimetableReference
        timetableChangeState?: 'resolved' | 'cancelled' | 'unresolved-reference'
        hasTasks: boolean
        notes: DailyPlanNote[]
      }>
      tasks: DailyPlanTask[]
      notes: DailyPlanNote[]
    }
  | { status: 'unauthenticated' }
  | { status: 'invalid-date' }
  | { status: 'daily-plan-unavailable' }
  | { status: 'affiliation-renewal-needed'; schoolYear: number }

export type DailyPlansRangeResult =
  | {
      status: 'ready'
      start: string
      end: string
      dailyPlans: Record<string, Extract<DailyPlanResult, { status: 'ready' }>>
    }
  | { status: 'unauthenticated' }
  | { status: 'invalid-date' }
  | { status: 'date-range-too-large' }
  | { status: 'daily-plan-unavailable' }
  | { status: 'affiliation-renewal-needed'; schoolYear: number }

export async function readDailyPlan({
  sessionToken,
  schoolDate,
  now,
  studentAccountStore,
  dailyPlanStore,
}: {
  sessionToken: string | null
  schoolDate: string | null
  now: number
  studentAccountStore: StudentAccountAccessStore
  dailyPlanStore: DailyPlanStore
}): Promise<DailyPlanResult> {
  const operationalContext = await resolveStudentOperationalContext({
    sessionToken,
    now,
    studentAccountStore,
    contextStore: dailyPlanStore,
  })
  if (operationalContext.status === 'unauthenticated') return operationalContext

  const resolvedSchoolDate = schoolDate ?? formatJstSchoolDate(now)

  if (!isValidSchoolDate(resolvedSchoolDate)) {
    return { status: 'invalid-date' }
  }
  if (operationalContext.status === 'school-year-unavailable') {
    return { status: 'daily-plan-unavailable' }
  }
  if (operationalContext.status === 'affiliation-renewal-needed') {
    return {
      status: operationalContext.status,
      schoolYear: operationalContext.currentSchoolYear.schoolYear,
    }
  }

  return readDailyPlanForAuthenticatedStudent({
    operationalContext,
    schoolDate: resolvedSchoolDate,
    store: dailyPlanStore,
  })
}

export async function readDailyPlansRange({
  sessionToken,
  start,
  end,
  now,
  studentAccountStore,
  dailyPlanStore,
}: {
  sessionToken: string | null
  start: string | null
  end: string | null
  now: number
  studentAccountStore: StudentAccountAccessStore
  dailyPlanStore: DailyPlanStore
}): Promise<DailyPlansRangeResult> {
  const operationalContext = await resolveStudentOperationalContext({
    sessionToken,
    now,
    studentAccountStore,
    contextStore: dailyPlanStore,
  })
  if (operationalContext.status === 'unauthenticated') return operationalContext

  const resolvedStart = start ?? formatJstSchoolDate(now)
  const resolvedEnd = end ?? resolvedStart

  if (!isValidSchoolDate(resolvedStart) || !isValidSchoolDate(resolvedEnd)) {
    return { status: 'invalid-date' }
  }

  const schoolDates = listSchoolDatesInRange(resolvedStart, resolvedEnd)

  if (!schoolDates || schoolDates.length > 31) {
    return {
      status: schoolDates ? 'date-range-too-large' : 'invalid-date',
    }
  }
  if (operationalContext.status === 'school-year-unavailable') {
    return { status: 'daily-plan-unavailable' }
  }
  if (operationalContext.status === 'affiliation-renewal-needed') {
    return {
      status: operationalContext.status,
      schoolYear: operationalContext.currentSchoolYear.schoolYear,
    }
  }

  const sharedContext = await resolveDailyPlanSharedContext({
    operationalContext,
    store: dailyPlanStore,
  })

  if (sharedContext.status !== 'ready') {
    return sharedContext
  }

  const timetableProjections = await createTimetableProjectionModule({
    store: dailyPlanStore,
  }).project({
    affiliation: sharedContext.studentAffiliation,
    schoolDates,
  })

  const dailyPlans: Record<
    string,
    Extract<DailyPlanResult, { status: 'ready' }>
  > = {}

  for (const date of schoolDates) {
    const [tasks, notes] = await Promise.all([
      dailyPlanStore.listActiveTasksForStudent(
        sharedContext.studentAffiliation,
        date,
      ),
      dailyPlanStore.listActiveNotesForStudent(
        sharedContext.studentAffiliation,
        date,
      ),
    ])
    dailyPlans[date] = buildReadyDailyPlan({
      schoolDate: date,
      sharedContext,
      tasks,
      notes,
      projectedLessons: projectedLessonsForDate(timetableProjections, date),
    })
  }

  return {
    status: 'ready',
    start: resolvedStart,
    end: resolvedEnd,
    dailyPlans,
  }
}

async function readDailyPlanForAuthenticatedStudent({
  operationalContext,
  schoolDate,
  store,
}: {
  operationalContext: Extract<
    StudentOperationalContextResult,
    { status: 'ready' }
  >
  schoolDate: string
  store: DailyPlanStore
}): Promise<DailyPlanResult> {
  const sharedContext = await resolveDailyPlanSharedContext({
    operationalContext,
    store,
  })

  if (sharedContext.status !== 'ready') {
    return sharedContext
  }

  const [timetableProjections, tasks, notes] = await Promise.all([
    createTimetableProjectionModule({ store }).project({
      affiliation: sharedContext.studentAffiliation,
      schoolDates: [schoolDate],
    }),
    store.listActiveTasksForStudent(
      sharedContext.studentAffiliation,
      schoolDate,
    ),
    store.listActiveNotesForStudent(
      sharedContext.studentAffiliation,
      schoolDate,
    ),
  ])

  return buildReadyDailyPlan({
    schoolDate,
    sharedContext,
    tasks,
    notes,
    projectedLessons: projectedLessonsForDate(timetableProjections, schoolDate),
  })
}

async function resolveDailyPlanSharedContext({
  operationalContext,
  store,
}: {
  operationalContext: Extract<
    StudentOperationalContextResult,
    { status: 'ready' }
  >
  store: DailyPlanStore
}): Promise<
  | {
      status: 'ready'
      currentSchoolYear: Extract<
        StudentOperationalContextResult,
        { status: 'ready' }
      >['currentSchoolYear']
      studentAffiliation: StudentAffiliation
      schoolClass: SchoolYearClassRecord
      track: TrackRecord
    }
  | { status: 'daily-plan-unavailable' }
> {
  const { currentSchoolYear, studentAffiliation } = operationalContext

  const [schoolClass, track] = await Promise.all([
    store.findSchoolYearClassById(
      studentAffiliation.classId,
      currentSchoolYear.schoolYear,
    ),
    store.findTrackById(studentAffiliation.trackId),
  ])

  if (!schoolClass || !track) {
    return { status: 'daily-plan-unavailable' }
  }

  return {
    status: 'ready',
    currentSchoolYear,
    studentAffiliation,
    schoolClass,
    track,
  }
}

function buildReadyDailyPlan({
  schoolDate,
  sharedContext,
  projectedLessons,
  tasks,
  notes,
}: {
  schoolDate: string
  sharedContext: Extract<
    Awaited<ReturnType<typeof resolveDailyPlanSharedContext>>,
    { status: 'ready' }
  >
  projectedLessons: Map<number, ProjectedDailyLesson>
  tasks: Awaited<ReturnType<DailyPlanStore['listActiveTasksForStudent']>>
  notes: Awaited<ReturnType<DailyPlanStore['listActiveNotesForStudent']>>
}): Extract<DailyPlanResult, { status: 'ready' }> {
  const weekday = weekdayForSchoolDate(schoolDate)
  return {
    status: 'ready',
    schoolDate,
    weekday,
    studentAffiliation: {
      schoolYear: sharedContext.currentSchoolYear.schoolYear,
      grade: sharedContext.studentAffiliation.grade,
      classId: sharedContext.studentAffiliation.classId,
      classNumber: sharedContext.schoolClass.classNumber,
      trackId: sharedContext.studentAffiliation.trackId,
      trackName: sharedContext.track.trackName,
    },
    schoolYearRange: {
      startsOn: sharedContext.currentSchoolYear.startsOn,
      endsOn: sharedContext.currentSchoolYear.endsOn,
    },
    periods: Array.from({ length: 7 }, (_, index) => {
      const periodNumber = index + 1
      const projectedLesson = projectedLessons.get(periodNumber)
      const lessonName = projectedLesson?.lessonName ?? ''

      return {
        periodNumber,
        lessonName,
        ...(projectedLesson?.lessonReference
          ? { lessonReference: projectedLesson.lessonReference }
          : {}),
        ...(projectedLesson && projectedLesson.timetableChangeState !== 'unchanged'
          ? { timetableChangeState: projectedLesson.timetableChangeState }
          : {}),
        hasTasks: false,
        notes: notes
          .filter((note) =>
            note.schoolDate === schoolDate &&
            note.periodNumber === periodNumber)
          .sort(compareDailyLessonNotes)
          .map(toDailyPlanNote),
      }
    }),
    tasks: tasks.map((task) => ({
      taskId: task.sharedInformationItemId,
      latestChangeId: task.latestChangeId,
      title: task.title,
      dueDate: task.dueDate,
      ...(task.relatedLessonName
        ? {
            relatedLessonName: task.relatedLessonName.lessonName,
            ...(task.relatedLessonName.registeredLessonNameId
              ? {
                  registeredRelatedLessonNameId:
                    task.relatedLessonName.registeredLessonNameId,
                }
              : {}),
          }
        : {}),
      targetScopeType: task.targetScope.type,
      createdAt: task.createdAt,
      notes: notes
        .filter((note) =>
          note.relatedTaskItemId === task.sharedInformationItemId)
        .map(toDailyPlanNote),
    })),
    notes: notes
      .filter((note) =>
        note.relatedTaskItemId === undefined && note.periodNumber === null)
      .map(toDailyPlanNote),
  }
}

function toDailyPlanNote(
  note: Awaited<ReturnType<DailyPlanStore['listActiveNotesForStudent']>>[number],
): DailyPlanNote {
  return {
    noteId: note.sharedInformationItemId,
    latestChangeId: note.latestChangeId,
    body: note.body,
    relatedContext: note.relatedTaskItemId
      ? { type: 'task', taskId: note.relatedTaskItemId }
      : note.schoolDate === null
        ? null
        : note.periodNumber === null
          ? { type: 'school-date', schoolDate: note.schoolDate }
          : {
              type: 'daily-lesson',
              schoolDate: note.schoolDate,
              periodNumber: note.periodNumber,
            },
    targetScopeType: note.targetScope.type,
  }
}

const targetScopeOrder = new Map([
  ['grade', 0],
  ['class', 1],
  ['track', 2],
  ['student', 3],
])

function compareDailyLessonNotes(
  left: Awaited<ReturnType<DailyPlanStore['listActiveNotesForStudent']>>[number],
  right: Awaited<ReturnType<DailyPlanStore['listActiveNotesForStudent']>>[number],
) {
  const scopeDifference =
    (targetScopeOrder.get(left.targetScope.type) ?? 4) -
    (targetScopeOrder.get(right.targetScope.type) ?? 4)
  if (scopeDifference !== 0) return scopeDifference
  if (left.createdAt !== right.createdAt) return right.createdAt - left.createdAt
  return right.sharedInformationItemId.localeCompare(left.sharedInformationItemId)
}

function projectedLessonsForDate(
  projections: readonly {
    schoolDate: string
    periodNumber: number
    finalDailyLesson: ProjectedDailyLesson
  }[],
  schoolDate: string,
) {
  return new Map(projections
    .filter((projection) => projection.schoolDate === schoolDate)
    .map((projection) => [
      projection.periodNumber,
      projection.finalDailyLesson,
    ]))
}

function formatJstSchoolDate(now: number) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now))
  const valueByType = new Map(parts.map((part) => [part.type, part.value]))

  return `${valueByType.get('year')}-${valueByType.get('month')}-${valueByType.get('day')}`
}

function listSchoolDatesInRange(start: string, end: string) {
  const startDate = parseSchoolDate(start)
  const endDate = parseSchoolDate(end)

  if (endDate.getTime() < startDate.getTime()) {
    return null
  }

  const schoolDates: string[] = []

  for (
    let cursor = startDate;
    cursor.getTime() <= endDate.getTime();
    cursor = addDays(cursor, 1)
  ) {
    schoolDates.push(formatSchoolDate(cursor))
  }

  return schoolDates
}

function parseSchoolDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000)
}

function formatSchoolDate(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}
