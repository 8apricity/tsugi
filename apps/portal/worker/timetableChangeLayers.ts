import type {
  ActiveTimetableChange,
  DailyPlanStore,
  StudentAccountAccessStore,
  StudentAffiliation,
  TargetScopeType,
} from './persistence'
import {
  projectTimetableSlot,
  type ProjectedDailyLesson,
} from '../shared/timetableProjection'
import { resolveStudentOperationalContext } from './studentOperationalContext'
import {
  createTimetableReferenceResolver,
  isValidSchoolDate,
  type DisplayTimetableReplacement,
  withTimetableReferenceLabel,
  weekdayForSchoolDate,
} from './timetable'

type TimetableLayerReplacement = DisplayTimetableReplacement

type TimetableLayerNote = {
  noteId: string
  latestChangeId: string
  body: string
  targetScopeType: TargetScopeType
  relatedContext: {
    type: 'daily-lesson'
    schoolDate: string
    periodNumber: number
  }
}

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
        | {
            targetScopeType: TargetScopeType
            state: 'unchanged'
            notes?: TimetableLayerNote[]
          }
        | {
            targetScopeType: TargetScopeType
            state: 'active'
            sharedInformationItemId: string
            latestChangeId: string
            replacement: TimetableLayerReplacement
            changedAt: number
            notes?: TimetableLayerNote[]
          }
      >
      finalDailyLesson: ProjectedDailyLesson
    }
  | { status: 'unauthenticated' }
  | { status: 'invalid-selection' }
  | { status: 'affiliation-renewal-needed'; schoolYear: number }
  | { status: 'unavailable' }

export type TimetableChangeLayerRangeResult =
  | {
      status: 'ready'
      states: Array<Extract<TimetableChangeLayerResult, { status: 'ready' }>>
    }
  | Exclude<TimetableChangeLayerResult, { status: 'ready' }>

export async function readTimetableChangeLayerRange({
  sessionToken,
  startDate,
  endDate,
  now,
  studentAccountStore,
  store,
}: {
  sessionToken: string | null
  startDate: string | null
  endDate: string | null
  now: number
  studentAccountStore: StudentAccountAccessStore
  store: DailyPlanStore
}): Promise<TimetableChangeLayerRangeResult> {
  const context = await resolveStudentOperationalContext({
    sessionToken,
    now,
    studentAccountStore,
    contextStore: store,
  })
  if (context.status === 'unauthenticated') return context
  if (context.status === 'school-year-unavailable') {
    return { status: 'unavailable' }
  }
  const schoolYear = context.currentSchoolYear
  if (
    startDate === null ||
    endDate === null ||
    !isValidSchoolDate(startDate) ||
    !isValidSchoolDate(endDate) ||
    startDate < schoolYear.startsOn ||
    endDate > schoolYear.endsOn
  ) {
    return { status: 'invalid-selection' }
  }
  const start = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(`${endDate}T00:00:00.000Z`)
  const dayCount = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
  if (dayCount < 1 || dayCount > 5) return { status: 'invalid-selection' }
  if (context.status === 'affiliation-renewal-needed') {
    return { status: context.status, schoolYear: schoolYear.schoolYear }
  }
  const affiliation = context.studentAffiliation

  const schoolDates = Array.from({ length: dayCount }, (_, day) =>
    new Date(start.getTime() + day * 86_400_000).toISOString().slice(0, 10),
  )
  const weekdays = [...new Set(schoolDates.map(weekdayForSchoolDate))]
  const [standardEntriesByWeekday, activeChanges, activeNotesByDate] = await Promise.all([
    Promise.all(
      weekdays.map(async (weekday) => [
        weekday,
        await store.listStandardTimetableEntriesForWeekday(
          affiliation.classId,
          affiliation.trackId,
          weekday,
        ),
      ] as const),
    ).then((entries) => new Map(entries)),
    store.listActiveTimetableChangesForStudent(
      affiliation,
      startDate,
      endDate,
    ),
    Promise.all(
      schoolDates.map(async (schoolDate) => [
        schoolDate,
        await store.listActiveNotesForStudent(affiliation, schoolDate),
      ] as const),
    ).then((entries) => new Map(entries)),
  ])

  const states: Array<Extract<TimetableChangeLayerResult, { status: 'ready' }>> = []
  for (const schoolDate of schoolDates) {
    const weekday = weekdayForSchoolDate(schoolDate)
    const standardEntries = standardEntriesByWeekday.get(weekday) ?? []
    const dateChanges = activeChanges.filter(
      (change) => change.changeDate === schoolDate,
    )
    for (let periodNumber = 1; periodNumber <= 7; periodNumber += 1) {
      states.push(await buildReadyLayerState({
        schoolDate,
        selectedPeriod: periodNumber,
        weekday,
        affiliation,
        store,
        standardEntries,
        activeChanges: dateChanges,
        activeNotes: activeNotesByDate.get(schoolDate) ?? [],
      }))
    }
  }
  return { status: 'ready', states }
}

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
  const context = await resolveStudentOperationalContext({
    sessionToken,
    now,
    studentAccountStore,
    contextStore: store,
  })
  if (context.status === 'unauthenticated') return context
  if (context.status === 'school-year-unavailable') {
    return { status: 'unavailable' }
  }
  const schoolYear = context.currentSchoolYear

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
  if (context.status === 'affiliation-renewal-needed') {
    return { status: context.status, schoolYear: schoolYear.schoolYear }
  }
  const affiliation = context.studentAffiliation

  const weekday = weekdayForSchoolDate(schoolDate)
  const [standardEntries, activeChanges, activeNotes] = await Promise.all([
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
    store.listActiveNotesForStudent(affiliation, schoolDate),
  ])
  return buildReadyLayerState({
    schoolDate,
    selectedPeriod,
    weekday,
    affiliation,
    store,
    standardEntries,
    activeChanges,
    activeNotes,
  })
}

async function buildReadyLayerState({
  schoolDate,
  selectedPeriod,
  weekday,
  affiliation,
  store,
  standardEntries,
  activeChanges,
  activeNotes,
}: {
  schoolDate: string
  selectedPeriod: number
  weekday: number
  affiliation: StudentAffiliation
  store: DailyPlanStore
  standardEntries: Awaited<
    ReturnType<DailyPlanStore['listStandardTimetableEntriesForWeekday']>
  >
  activeChanges: ActiveTimetableChange[]
  activeNotes: Awaited<ReturnType<DailyPlanStore['listActiveNotesForStudent']>>
}): Promise<Extract<TimetableChangeLayerResult, { status: 'ready' }>> {
  const changesByLayer = new Map(
    activeChanges
      .filter((change) => change.periodNumber === selectedPeriod)
      .map((change) => [change.targetScope.type, change]),
  )
  const activeLayers = await Promise.all(
    [...changesByLayer.values()].map(async (change) => ({
      targetScopeType: change.targetScope.type,
      replacement: await withTimetableReferenceLabel(
        change.replacement,
        affiliation,
        store,
      ),
    })),
  )
  const activeLayerByScope = new Map(
    activeLayers.map((layer) => [layer.targetScopeType, layer]),
  )
  const resolveReference = await createTimetableReferenceResolver(
    activeLayers.map((layer) => layer.replacement),
    affiliation,
    store,
  )
  const projection = projectTimetableSlot({
    standardTimetable: {
      type: 'candidates',
      selectedTrackId: affiliation.trackId,
      periodReference: { weekday, periodNumber: selectedPeriod },
      candidates: standardEntries.filter(
        (entry) => entry.periodNumber === selectedPeriod,
      ),
    },
    activeLayers,
    resolveReference,
  })

  const layers = await Promise.all(
    projection.layers.map(async (layer) => {
      const change = changesByLayer.get(layer.targetScopeType)
      const notes = activeNotes
        .filter((note) =>
          note.schoolDate === schoolDate &&
          note.periodNumber === selectedPeriod &&
          note.targetScope.type === layer.targetScopeType)
        .map((note) => ({
          noteId: note.sharedInformationItemId,
          latestChangeId: note.latestChangeId,
          body: note.body,
          targetScopeType: note.targetScope.type,
          relatedContext: {
            type: 'daily-lesson' as const,
            schoolDate,
            periodNumber: selectedPeriod,
          },
        }))
      return layer.state === 'active' && change
        ? {
            targetScopeType: layer.targetScopeType,
            state: 'active' as const,
            sharedInformationItemId: change.sharedInformationItemId,
            latestChangeId: change.latestChangeId,
            replacement: activeLayerByScope.get(layer.targetScopeType)!
              .replacement,
            changedAt: change.changedAt,
            ...(notes.length > 0 ? { notes } : {}),
          }
        : {
            targetScopeType: layer.targetScopeType,
            state: 'unchanged' as const,
            ...(notes.length > 0 ? { notes } : {}),
          }
    }),
  )

  return {
    status: 'ready',
    schoolDate,
    periodNumber: selectedPeriod,
    standardTimetable: projection.standardTimetable
      ? {
          periodReference: { weekday, periodNumber: selectedPeriod },
          lessonName: projection.standardTimetable.lessonName,
        }
      : null,
    layers,
    finalDailyLesson: projection.finalDailyLesson,
  }
}
