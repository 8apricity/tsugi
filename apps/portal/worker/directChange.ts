import type {
  DirectChangeOptionsStore,
  StudentAccountAccessStore,
  TimetableLayerKey,
} from './persistence'
import { createDirectChangeApplication } from './directChange/application'
import type { DirectChangeDraft } from './directChange/kindRules'
import {
  type AtomicChangeExecutor,
  type DirectChangeCatalog,
} from './sharedInformationChange/atomicProgram'
import {
  resolveStudentOperationalContext,
  type StudentOperationalContextStore,
} from './studentOperationalContext'
import { isTargetScopeType } from './targetScopePolicy'

export type ApplyDirectChangesResult =
  | {
      status: 'applied'
      changes: Array<{
        sourceId: string
        sharedInformationItemId: string
      }>
    }
  | { status: 'unauthenticated' }
  | { status: 'invalid-change' }
  | { status: 'affiliation-renewal-needed'; schoolYear: number }
  | {
      status: 'timetable-change-conflict'
      conflictingKeys: TimetableLayerKey[]
      conflictingSourceIds?: string[]
    }
  | {
      status: 'idempotency-conflict'
      conflictingKeys: TimetableLayerKey[]
      conflictingSourceIds?: string[]
    }

export async function applyDirectChanges({
  sessionToken,
  drafts,
  now,
  studentAccountStore,
  contextStore,
  catalog,
  executor,
}: {
  sessionToken: string | null
  drafts: unknown
  now: number
  studentAccountStore: StudentAccountAccessStore
  contextStore: StudentOperationalContextStore
  catalog: DirectChangeCatalog
  executor: AtomicChangeExecutor
}): Promise<ApplyDirectChangesResult> {
  const context = await resolveStudentOperationalContext({
    sessionToken,
    now,
    studentAccountStore,
    contextStore,
  })
  if (context.status === 'unauthenticated') return context
  if (context.status === 'school-year-unavailable') {
    return { status: 'invalid-change' }
  }
  if (context.status === 'affiliation-renewal-needed') {
    return {
      status: context.status,
      schoolYear: context.currentSchoolYear.schoolYear,
    }
  }

  const result = await createDirectChangeApplication({
    catalog,
    executor,
    clock: () => now,
  }).apply({ context, drafts })

  if (result.status === 'invalid-change') {
    return { status: 'invalid-change' }
  }
  if (
    result.status === 'conflict' ||
    result.status === 'idempotency-conflict'
  ) {
    const conflict = legacyConflictDetails(drafts, result.sourceIds)
    return {
      status: result.status === 'conflict'
        ? 'timetable-change-conflict'
        : 'idempotency-conflict',
      ...conflict,
    }
  }
  return result
}

function legacyConflictDetails(
  drafts: unknown,
  sourceIds: readonly string[],
) {
  if (!Array.isArray(drafts)) {
    return {
      conflictingKeys: [],
      conflictingSourceIds: [...sourceIds],
    }
  }
  const conflicting = new Set(sourceIds)
  const conflictingKeys: TimetableLayerKey[] = []
  const conflictingNonTimetableSourceIds: string[] = []
  for (const candidate of drafts as DirectChangeDraft[]) {
    if (
      typeof candidate.sourceId !== 'string' ||
      !conflicting.has(candidate.sourceId)
    ) continue
    if ((candidate.kind ?? 'timetable_change') !== 'timetable_change') {
      conflictingNonTimetableSourceIds.push(candidate.sourceId)
      continue
    }
    if (
      isTargetScopeType(candidate.targetScopeType) &&
      typeof candidate.changeDate === 'string' &&
      Number.isInteger(candidate.periodNumber)
    ) {
      conflictingKeys.push({
        targetScopeType: candidate.targetScopeType,
        changeDate: candidate.changeDate,
        periodNumber: Number(candidate.periodNumber),
      })
    }
  }
  return {
    conflictingKeys,
    ...(conflictingNonTimetableSourceIds.length > 0
      ? { conflictingSourceIds: conflictingNonTimetableSourceIds }
      : {}),
  }
}

export async function readDirectTimetableChangeOptions({
  sessionToken,
  now,
  studentAccountStore,
  store,
}: {
  sessionToken: string | null
  now: number
  studentAccountStore: StudentAccountAccessStore
  store: DirectChangeOptionsStore
}) {
  const context = await resolveStudentOperationalContext({
    sessionToken,
    now,
    studentAccountStore,
    contextStore: store,
  })
  if (context.status === 'unauthenticated') return context
  if (context.status === 'school-year-unavailable') {
    return { status: 'unavailable' as const }
  }
  if (context.status === 'affiliation-renewal-needed') {
    return {
      status: context.status,
      schoolYear: context.currentSchoolYear.schoolYear,
    }
  }
  const { currentSchoolYear: schoolYear, studentAffiliation: affiliation } =
    context
  const floatingLabels = await store.listFloatingLessonReferenceLabels(
    schoolYear.schoolYear,
    affiliation.grade,
  )
  const entriesByWeekday = await Promise.all(
    Array.from({ length: 6 }, (_, weekdayIndex) =>
      store.listStandardTimetableEntriesForWeekday(
        affiliation.classId,
        affiliation.trackId,
        weekdayIndex + 1,
      ),
    ),
  )
  const resolvedPeriodEntries = entriesByWeekday.flatMap((entries) =>
    Array.from({ length: 7 }, (_, periodIndex) => {
      const periodNumber = periodIndex + 1
      return entries.find((entry) =>
        entry.periodNumber === periodNumber &&
        entry.trackId === affiliation.trackId
      ) ?? entries.find((entry) =>
        entry.periodNumber === periodNumber && entry.trackId === null
      ) ?? null
    }),
  ).filter((entry) => entry !== null)
  const periodReferences = resolvedPeriodEntries.map(
    ({ weekday, periodNumber, lessonName }) => ({
      weekday,
      periodNumber,
      lessonName,
    }),
  )
  const resolvedFloatingEntries = await Promise.all(
    floatingLabels.map((label) =>
      store.findStandardTimetableEntryForFloatingReferenceLabelId(
        affiliation.classId,
        affiliation.trackId,
        label.floatingLessonReferenceLabelId,
      ),
    ),
  )
  const floatingLessonReferenceLabels = floatingLabels.map((label, index) => ({
    floatingLessonReferenceLabelId: label.floatingLessonReferenceLabelId,
    referenceLabel: label.referenceLabel,
    lessonName: resolvedFloatingEntries[index]?.lessonName ?? null,
  }))
  const prioritizedIds = new Set([
    ...resolvedPeriodEntries.map((entry) => entry.registeredLessonNameId),
    ...resolvedFloatingEntries.flatMap((entry) =>
      entry ? [entry.registeredLessonNameId] : []),
  ])
  const allRegisteredLessonNames = await store.listRegisteredLessonNames()
  const toOption = ({
    registeredLessonNameId,
    fullLessonName,
    shortLessonName,
  }: typeof allRegisteredLessonNames[number]) => ({
    registeredLessonNameId,
    fullLessonName,
    shortLessonName,
  })
  return {
    status: 'ready' as const,
    schoolYearRange: {
      startsOn: schoolYear.startsOn,
      endsOn: schoolYear.endsOn,
    },
    periodReferences,
    floatingLessonReferenceLabels,
    registeredLessonNames: allRegisteredLessonNames
      .filter((lessonName) =>
        prioritizedIds.has(lessonName.registeredLessonNameId))
      .map(toOption),
    allRegisteredLessonNames: allRegisteredLessonNames.map(toOption),
  }
}
