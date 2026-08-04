import type {
  DailyPlanStore,
  StudentAccountAccessStore,
  TargetScopeType,
} from './persistence'
import {
  type DisplayTimetableReplacement,
  type ProjectedDailyLesson,
  type TimetableProjection,
} from '../shared/timetableProjection'
import { resolveStudentOperationalContext } from './studentOperationalContext'
import {
  isValidSchoolDate,
} from './timetable'
import { createTimetableProjectionModule } from './timetableProjection'
import { createTargetScopePolicy } from './targetScopePolicy'

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
  const scopePolicy = createTargetScopePolicy(affiliation)
  const scopeAccess = scopePolicy.ownReadAccess
  const [projections, activeNotes] = await Promise.all([
    createTimetableProjectionModule({ store }).project({
      scopePolicy,
      schoolDates,
    }),
    store.listActiveNotes(scopeAccess, startDate, endDate),
  ])

  const states: Array<Extract<TimetableChangeLayerResult, { status: 'ready' }>> = []
  for (const schoolDate of schoolDates) {
    for (let periodNumber = 1; periodNumber <= 7; periodNumber += 1) {
      const projection = projections.find((candidate) =>
        candidate.schoolDate === schoolDate &&
        candidate.periodNumber === periodNumber)
      if (!projection) {
        throw new Error('Timetable Projection did not return every requested slot')
      }
      states.push(buildReadyLayerState({
        schoolDate,
        projection,
        activeNotes,
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
  const scopePolicy = createTargetScopePolicy(affiliation)
  const scopeAccess = scopePolicy.ownReadAccess

  const [projections, activeNotes] = await Promise.all([
    createTimetableProjectionModule({ store }).project({
      scopePolicy,
      schoolDates: [schoolDate],
    }),
    store.listActiveNotes(scopeAccess, schoolDate, schoolDate),
  ])
  const projection = projections.find(
    (candidate) => candidate.periodNumber === selectedPeriod,
  )
  if (!projection) {
    throw new Error('Timetable Projection did not return the requested slot')
  }
  return buildReadyLayerState({
    schoolDate,
    projection,
    activeNotes,
  })
}

function buildReadyLayerState({
  schoolDate,
  projection,
  activeNotes,
}: {
  schoolDate: string
  projection: TimetableProjection
  activeNotes: Awaited<ReturnType<DailyPlanStore['listActiveNotes']>>
}): Extract<TimetableChangeLayerResult, { status: 'ready' }> {
  const layers = projection.layers.map((layer) => {
      const active = layer.active
      const notes = activeNotes
        .filter((note) =>
          note.schoolDate === schoolDate &&
          note.periodNumber === projection.periodNumber &&
          note.targetScope.type === layer.targetScopeType)
        .map((note) => ({
          noteId: note.sharedInformationItemId,
          latestChangeId: note.latestChangeId,
          body: note.body,
          targetScopeType: note.targetScope.type,
          relatedContext: {
              type: 'daily-lesson' as const,
              schoolDate,
              periodNumber: projection.periodNumber,
            },
          }))
      return active
        ? {
            targetScopeType: layer.targetScopeType,
            state: 'active' as const,
            sharedInformationItemId: active.sharedInformationItemId,
            latestChangeId: active.latestChangeId,
            replacement: active.replacement,
            changedAt: active.changedAt,
            ...(notes.length > 0 ? { notes } : {}),
          }
        : {
            targetScopeType: layer.targetScopeType,
            state: 'unchanged' as const,
            ...(notes.length > 0 ? { notes } : {}),
          }
    })

  return {
    status: 'ready',
    schoolDate,
    periodNumber: projection.periodNumber,
    standardTimetable: projection.standardTimetable,
    layers,
    finalDailyLesson: projection.finalDailyLesson,
  }
}
