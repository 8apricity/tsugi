import type {
  ActiveTimetableChange,
  DailyPlanStore,
  StudentAccountAccessStore,
  StudentAffiliation,
  TargetScopeType,
  TimetableChangeReplacement,
} from './persistence'
import { readStudentSession } from './studentAccountAccess'
import {
  isValidSchoolDate,
  resolveTimetableChangeReplacement,
  selectStandardTimetableEntry,
  timetableLayerOrder,
  weekdayForSchoolDate,
} from './timetable'

type TimetableLayerReplacement =
  | Exclude<TimetableChangeReplacement, { type: 'floating_lesson_reference' }>
  | (Extract<
      TimetableChangeReplacement,
      { type: 'floating_lesson_reference' }
    > & { referenceLabel: string })

export type TimetableChangeLayerResult =
  | {
      status: 'ready'
      schoolDate: string
      periodNumber: number
      standardTimetable: {
        periodReference: { weekday: number; periodNumber: number }
        lessonName: string
      } | null
      layers: Array<
        | { targetScopeType: TargetScopeType; state: 'unchanged' }
        | {
            targetScopeType: TargetScopeType
            state: 'active'
            sharedInformationItemId: string
            latestChangeId: string
            replacement: TimetableLayerReplacement
            changedAt: number
          }
      >
      finalDailyLesson: {
        lessonName: string
        timetableChangeState:
          | 'unchanged'
          | 'resolved'
          | 'cancelled'
          | 'unresolved-reference'
      }
    }
  | { status: 'unauthenticated' }
  | { status: 'invalid-selection' }
  | { status: 'affiliation-renewal-needed'; schoolYear: number }
  | { status: 'unavailable' }

export async function readTimetableChangeLayers({
  sessionToken,
  schoolDate,
  periodNumber,
  now,
  studentAccountStore,
  store,
}: {
  sessionToken: string | null
  schoolDate: string | null
  periodNumber: string | null
  now: number
  studentAccountStore: StudentAccountAccessStore
  store: DailyPlanStore
}): Promise<TimetableChangeLayerResult> {
  const session = await readStudentSession({
    sessionToken,
    now,
    store: studentAccountStore,
  })
  if (session.status === 'unauthenticated') return session

  const schoolYear = await store.findCurrentSchoolYear()
  if (!schoolYear) return { status: 'unavailable' }

  const selectedPeriod = Number(periodNumber)
  if (
    schoolDate === null ||
    !isValidSchoolDate(schoolDate) ||
    schoolDate < schoolYear.startsOn ||
    schoolDate > schoolYear.endsOn ||
    periodNumber === null ||
    !/^[1-7]$/.test(periodNumber) ||
    !Number.isInteger(selectedPeriod)
  ) {
    return { status: 'invalid-selection' }
  }

  const affiliation = await store.findCurrentStudentAffiliation(
    session.studentAccount.studentAccountId,
    schoolYear.schoolYear,
  )
  if (!affiliation) {
    return {
      status: 'affiliation-renewal-needed',
      schoolYear: schoolYear.schoolYear,
    }
  }

  const weekday = weekdayForSchoolDate(schoolDate)
  const [standardEntries, activeChanges] = await Promise.all([
    store.listStandardTimetableEntriesForWeekday(
      affiliation.classId,
      affiliation.trackId,
      weekday,
    ),
    store.listActiveTimetableChangesForStudent(
      affiliation,
      schoolDate,
      schoolDate,
    ),
  ])
  const standardEntry = selectStandardTimetableEntry(
    standardEntries,
    affiliation.trackId,
    selectedPeriod,
  )
  const changesByLayer = new Map(
    activeChanges
      .filter((change) => change.periodNumber === selectedPeriod)
      .map((change) => [change.targetScopeType, change]),
  )

  let finalDailyLesson: Extract<
    TimetableChangeLayerResult,
    { status: 'ready' }
  >['finalDailyLesson'] = {
    lessonName: standardEntry?.lessonName ?? '',
    timetableChangeState: 'unchanged',
  }

  for (const targetScopeType of timetableLayerOrder) {
    const change = changesByLayer.get(targetScopeType)
    if (change) {
      finalDailyLesson = await resolveTimetableChangeReplacement(
        change.replacement,
        affiliation,
        store,
      )
    }
  }

  const layers = await Promise.all(
    timetableLayerOrder.map(async (targetScopeType) => {
      const change = changesByLayer.get(targetScopeType)
      return change
        ? {
            targetScopeType,
            state: 'active' as const,
            sharedInformationItemId: change.sharedInformationItemId,
            latestChangeId: change.latestChangeId,
            replacement: await displayReplacement(change, affiliation, store),
            changedAt: change.changedAt,
          }
        : { targetScopeType, state: 'unchanged' as const }
    }),
  )

  return {
    status: 'ready',
    schoolDate,
    periodNumber: selectedPeriod,
    standardTimetable: standardEntry
      ? {
          periodReference: { weekday, periodNumber: selectedPeriod },
          lessonName: standardEntry.lessonName,
        }
      : null,
    layers,
    finalDailyLesson,
  }
}

async function displayReplacement(
  change: ActiveTimetableChange,
  affiliation: StudentAffiliation,
  store: DailyPlanStore,
): Promise<TimetableLayerReplacement> {
  if (change.replacement.type !== 'floating_lesson_reference') {
    return change.replacement
  }
  const entry = await store.findStandardTimetableEntryForFloatingReferenceLabelId(
    affiliation.classId,
    affiliation.trackId,
    change.replacement.floatingLessonReferenceLabelId,
  )
  return {
    ...change.replacement,
    referenceLabel: entry?.referenceLabel ?? '不明な参照',
  }
}
