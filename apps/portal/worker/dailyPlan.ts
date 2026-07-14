import {
  type ActiveTimetableChange,
  type DailyPlanStore,
  type PeriodStandardTimetableEntry,
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
  resolveTimetableChangeReplacement,
  selectStandardTimetableEntry,
  timetableLayerOrder,
  weekdayForSchoolDate,
} from './timetable'

type DailyPlanTask = {
  taskId: string
  title: string
  dueDate?: string
  dueLabel?: string
  relatedLesson?: {
    schoolDate: string
    periodNumber: number
    lessonName: string
  }
  relatedLessonName?: string
  completed: false
}

type DailyPlanNote = {
  noteId: string
  body: string
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

  const entriesByWeekday = new Map<
    number,
    Map<number, PeriodStandardTimetableEntry>
  >()
  const uniqueWeekdays = new Set(schoolDates.map(weekdayForSchoolDate))

  await Promise.all(
    [...uniqueWeekdays].map(async (weekday) => {
      const entries =
        await dailyPlanStore.listStandardTimetableEntriesForWeekday(
          sharedContext.studentAffiliation.classId,
          sharedContext.studentAffiliation.trackId,
          weekday,
        )
      entriesByWeekday.set(
        weekday,
        buildEntriesByPeriod(entries, sharedContext.studentAffiliation.trackId),
      )
    }),
  )

  const activeTimetableChanges =
    await dailyPlanStore.listActiveTimetableChangesForStudent(
      sharedContext.studentAffiliation,
      resolvedStart,
      resolvedEnd,
    )

  const dailyPlans: Record<
    string,
    Extract<DailyPlanResult, { status: 'ready' }>
  > = {}

  for (const date of schoolDates) {
    dailyPlans[date] = buildReadyDailyPlan({
      schoolDate: date,
      sharedContext,
      entriesByPeriod:
        entriesByWeekday.get(weekdayForSchoolDate(date)) ?? new Map(),
      changedLessonNames: await resolveChangedLessonNames(
        activeTimetableChanges.filter((change) => change.changeDate === date),
        sharedContext.studentAffiliation,
        dailyPlanStore,
      ),
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

  const weekday = weekdayForSchoolDate(schoolDate)
  const standardTimetableEntries =
    await store.listStandardTimetableEntriesForWeekday(
      sharedContext.studentAffiliation.classId,
      sharedContext.studentAffiliation.trackId,
      weekday,
    )
  const activeTimetableChanges = await store.listActiveTimetableChangesForStudent(
    sharedContext.studentAffiliation,
    schoolDate,
    schoolDate,
  )

  return buildReadyDailyPlan({
    schoolDate,
    sharedContext,
    entriesByPeriod: buildEntriesByPeriod(
      standardTimetableEntries,
      sharedContext.studentAffiliation.trackId,
    ),
    changedLessonNames: await resolveChangedLessonNames(
      activeTimetableChanges,
      sharedContext.studentAffiliation,
      store,
    ),
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

function buildEntriesByPeriod(
  standardTimetableEntries: PeriodStandardTimetableEntry[],
  trackId: string,
) {
  const entriesByPeriod = new Map<number, PeriodStandardTimetableEntry>()
  const periodNumbers = new Set(
    standardTimetableEntries.map((entry) => entry.periodNumber),
  )

  for (const periodNumber of periodNumbers) {
    const entry = selectStandardTimetableEntry(
      standardTimetableEntries,
      trackId,
      periodNumber,
    )
    if (entry) entriesByPeriod.set(periodNumber, entry)
  }

  return entriesByPeriod
}

function buildReadyDailyPlan({
  schoolDate,
  sharedContext,
  entriesByPeriod,
  changedLessonNames = new Map(),
}: {
  schoolDate: string
  sharedContext: Extract<
    Awaited<ReturnType<typeof resolveDailyPlanSharedContext>>,
    { status: 'ready' }
  >
  entriesByPeriod: Map<number, PeriodStandardTimetableEntry>
  changedLessonNames?: Map<
    number,
    {
      lessonName: string
      timetableChangeState: 'resolved' | 'cancelled' | 'unresolved-reference'
    }
  >
}): Extract<DailyPlanResult, { status: 'ready' }> {
  const weekday = weekdayForSchoolDate(schoolDate)
  const placeholderTasks = listPlaceholderDailyPlanTasks(schoolDate)
  const placeholderNotes = listPlaceholderDailyPlanNotes(schoolDate)
  const placeholderDailyLessonNotes = placeholderNotes.filter(
    (note) => note.relatedContext?.type === 'daily-lesson',
  )
  const placeholderBottomNotes = placeholderNotes.filter(
    (note) => note.relatedContext?.type !== 'daily-lesson',
  )

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
      const changedLesson = changedLessonNames.get(periodNumber)
      const lessonName = changedLesson
        ? changedLesson.lessonName
        : entriesByPeriod.get(periodNumber)?.lessonName ?? ''

      return {
        periodNumber,
        lessonName,
        ...(changedLesson
          ? { timetableChangeState: changedLesson.timetableChangeState }
          : {}),
        hasTasks: placeholderTasks.some((task) =>
          isPlaceholderTaskRelatedToLesson(task, {
            schoolDate,
            periodNumber,
            lessonName,
          }),
        ),
        notes: placeholderDailyLessonNotes.filter(
          (note) =>
            note.relatedContext?.type === 'daily-lesson' &&
            note.relatedContext.periodNumber === periodNumber,
        ),
      }
    }),
    tasks: placeholderTasks,
    notes: placeholderBottomNotes,
  }
}

async function resolveChangedLessonNames(
  changes: ActiveTimetableChange[],
  affiliation: StudentAffiliation,
  store: DailyPlanStore,
) {
  const result = new Map<
    number,
    {
      lessonName: string
      timetableChangeState: 'resolved' | 'cancelled' | 'unresolved-reference'
    }
  >()
  for (const change of [...changes].sort(
    (left, right) =>
      timetableLayerOrder.indexOf(left.targetScope.type) -
      timetableLayerOrder.indexOf(right.targetScope.type),
  )) {
    result.set(
      change.periodNumber,
      await resolveTimetableChangeReplacement(change.replacement, affiliation, store),
    )
  }

  return result
}

const placeholderDailyPlanTasks: DailyPlanTask[] = [
  {
    taskId: 'placeholder-task-geography-worksheet',
    title: 'Placeholder: Bring geography worksheet',
    dueDate: '2026-07-10',
    relatedLesson: {
      schoolDate: '2026-07-10',
      periodNumber: 1,
      lessonName: '地理',
    },
    completed: false,
  },
  {
    taskId: 'placeholder-task-modern-japanese-reading',
    title: 'Placeholder: Modern Japanese reading',
    dueLabel: '今日',
    relatedLessonName: '現代文',
    completed: false,
  },
]

const placeholderDailyPlanNotes: DailyPlanNote[] = [
  {
    noteId: 'placeholder-daily-lesson-note-2026-07-10-period-2',
    body: 'Placeholder: Bring dictionary for second period.',
    relatedContext: {
      type: 'daily-lesson',
      schoolDate: '2026-07-10',
      periodNumber: 2,
    },
  },
  {
    noteId: 'placeholder-school-date-note-2026-07-10',
    body: 'Placeholder: Submit library form today.',
    relatedContext: {
      type: 'school-date',
      schoolDate: '2026-07-10',
    },
  },
  {
    noteId: 'placeholder-school-date-note-2026-07-12',
    body: 'Placeholder: Other School Date note.',
    relatedContext: {
      type: 'school-date',
      schoolDate: '2026-07-12',
    },
  },
  {
    noteId: 'placeholder-no-context-note',
    body: 'Placeholder: Student council announcement.',
    relatedContext: null,
  },
]

function listPlaceholderDailyPlanTasks(schoolDate: string) {
  return placeholderDailyPlanTasks.filter((task) => {
    if (task.relatedLesson?.schoolDate) {
      return task.relatedLesson.schoolDate === schoolDate
    }

    return true
  })
}

function listPlaceholderDailyPlanNotes(schoolDate: string) {
  return placeholderDailyPlanNotes.filter((note) => {
    if (!note.relatedContext) {
      return true
    }

    return note.relatedContext.schoolDate === schoolDate
  })
}

function isPlaceholderTaskRelatedToLesson(
  task: DailyPlanTask,
  lesson: {
    schoolDate: string
    periodNumber: number
    lessonName: string
  },
) {
  if (
    task.relatedLesson?.schoolDate === lesson.schoolDate &&
    task.relatedLesson.periodNumber === lesson.periodNumber &&
    task.relatedLesson.lessonName === lesson.lessonName
  ) {
    return true
  }

  return (
    !task.relatedLesson &&
    task.relatedLessonName !== undefined &&
    task.relatedLessonName === lesson.lessonName
  )
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
