import type {
  DirectTimetableChangeOperation,
  DirectTimetableChangeStore,
  StudentAccountAccessStore,
  TimetableLayerKey,
  TimetableChangeReplacement,
} from './persistence'
import { projectTimetableSlot } from '../shared/timetableProjection'
import { resolveStudentOperationalContext } from './studentOperationalContext'
import {
  isTargetScopeType,
  targetScopeForStudentAffiliation,
  targetScopesEqual,
} from './targetScopePolicy'
import { isValidSchoolDate } from './timetable'

type DirectChangeDraft = {
  changeKind?: unknown
  sourceId: unknown
  sharedInformationItemId?: unknown
  expectedLatestChangeId?: unknown
  targetScopeType: unknown
  changeDate: unknown
  periodNumber: unknown
  replacement: unknown
}

export type ApplyDirectTimetableChangesResult =
  | { status: 'applied'; changes: Array<{ sourceId: string; sharedInformationItemId: string }> }
  | { status: 'unauthenticated' }
  | { status: 'invalid-change' }
  | { status: 'affiliation-renewal-needed'; schoolYear: number }
  | {
      status: 'timetable-change-conflict'
      conflictingKeys: TimetableLayerKey[]
    }
  | { status: 'idempotency-conflict'; conflictingKeys: TimetableLayerKey[] }

export async function readDirectTimetableChangeOptions({
  sessionToken,
  now,
  studentAccountStore,
  store,
}: {
  sessionToken: string | null
  now: number
  studentAccountStore: StudentAccountAccessStore
  store: DirectTimetableChangeStore
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
  const periodReferences = entriesByWeekday
    .flatMap((entries, weekdayIndex) =>
      Array.from({ length: 7 }, (_, periodIndex) => {
        const periodNumber = periodIndex + 1
        const projection = projectTimetableSlot({
          standardTimetable: {
            type: 'candidates',
            selectedTrackId: affiliation.trackId,
            candidates: entries.filter(
              (entry) => entry.periodNumber === periodNumber,
            ),
          },
          activeLayers: [],
          resolveReference: () => null,
        })
        return projection.standardTimetable
        ? {
            weekday: weekdayIndex + 1,
            periodNumber,
            lessonName: projection.standardTimetable.lessonName,
          }
          : null
      }),
    )
    .filter((entry) => entry !== null)
  return {
    status: 'ready' as const,
    schoolYearRange: { startsOn: schoolYear.startsOn, endsOn: schoolYear.endsOn },
    periodReferences,
    floatingLessonReferenceLabels: await Promise.all(
      floatingLabels.map(async (label) => ({
        floatingLessonReferenceLabelId: label.floatingLessonReferenceLabelId,
        referenceLabel: label.referenceLabel,
        lessonName: (
          await store.findStandardTimetableEntryForFloatingReferenceLabelId(
            affiliation.classId,
            affiliation.trackId,
            label.floatingLessonReferenceLabelId,
          )
        )?.lessonName ?? null,
      })),
    ),
  }
}

export async function applyDirectTimetableChanges({
  sessionToken,
  drafts,
  now,
  studentAccountStore,
  store,
}: {
  sessionToken: string | null
  drafts: unknown
  now: number
  studentAccountStore: StudentAccountAccessStore
  store: DirectTimetableChangeStore
}): Promise<ApplyDirectTimetableChangesResult> {
  const context = await resolveStudentOperationalContext({
    sessionToken,
    now,
    studentAccountStore,
    contextStore: store,
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
  const {
    currentSchoolYear: schoolYear,
    studentAffiliation: affiliation,
    studentAccount,
  } = context

  if (!Array.isArray(drafts) || drafts.length === 0 || drafts.length > 50) {
    return { status: 'invalid-change' }
  }

  const changes: DirectTimetableChangeOperation[] = []

  for (const candidate of drafts as DirectChangeDraft[]) {
    const changeKind = candidate.changeKind ?? 'add'
    const replacement = changeKind === 'remove'
      ? null
      : parseReplacement(candidate.replacement)

    if (
      typeof candidate.sourceId !== 'string' ||
      !uuidPattern.test(candidate.sourceId) ||
      (changeKind !== 'add' && changeKind !== 'update' && changeKind !== 'remove') ||
      !isTargetScopeType(candidate.targetScopeType) ||
      typeof candidate.changeDate !== 'string' ||
      !isValidSchoolDate(candidate.changeDate) ||
      candidate.changeDate < schoolYear.startsOn ||
      candidate.changeDate > schoolYear.endsOn ||
      !Number.isInteger(candidate.periodNumber) ||
      Number(candidate.periodNumber) < 1 ||
      Number(candidate.periodNumber) > 7 ||
      (changeKind === 'remove'
        ? candidate.replacement !== undefined
        : !replacement)
    ) {
      return { status: 'invalid-change' }
    }

    if (
      changeKind !== 'add' &&
      (typeof candidate.sharedInformationItemId !== 'string' ||
        !uuidPattern.test(candidate.sharedInformationItemId) ||
        typeof candidate.expectedLatestChangeId !== 'string' ||
        candidate.expectedLatestChangeId.length === 0 ||
        candidate.expectedLatestChangeId.length > 200)
    ) {
      return { status: 'invalid-change' }
    }

    if (
      replacement?.type === 'floating_lesson_reference' &&
      !(await store.findFloatingLessonReferenceLabel(
        replacement.floatingLessonReferenceLabelId,
        schoolYear.schoolYear,
        affiliation.grade,
      ))
    ) {
      return { status: 'invalid-change' }
    }

    const targetScopeType = candidate.targetScopeType
    const common = {
      sourceId: candidate.sourceId,
      latestChangeId: `${candidate.sourceId}:change`,
      targetScope: targetScopeForStudentAffiliation(
        affiliation,
        targetScopeType,
      ),
      changeDate: candidate.changeDate,
      periodNumber: Number(candidate.periodNumber),
      changedByStudentAccountId: studentAccount.studentAccountId,
      changedAt: now,
    }
    changes.push(
      changeKind === 'update'
        ? {
            ...common,
            changeKind,
            replacement: replacement!,
            sharedInformationItemId: candidate.sharedInformationItemId as string,
            expectedLatestChangeId: candidate.expectedLatestChangeId as string,
          }
        : changeKind === 'remove'
          ? {
              ...common,
              changeKind,
              sharedInformationItemId: candidate.sharedInformationItemId as string,
              expectedLatestChangeId: candidate.expectedLatestChangeId as string,
            }
        : {
            ...common,
            changeKind,
            replacement: replacement!,
            sharedInformationItemId: candidate.sourceId,
          },
    )
  }

  const hasDuplicateSlot = changes.some((change, index) =>
    changes.slice(0, index).some((candidate) =>
      targetScopesEqual(candidate.targetScope, change.targetScope) &&
      candidate.changeDate === change.changeDate &&
      candidate.periodNumber === change.periodNumber
    )
  )
  if (
    new Set(changes.map((change) => change.sourceId)).size !== changes.length ||
    hasDuplicateSlot
  ) {
    return { status: 'invalid-change' }
  }

  const result = await store.commitDirectTimetableChanges(changes)

  if (result.status === 'conflict') {
    return {
      status: 'timetable-change-conflict',
      conflictingKeys: conflictingKeysFor(changes, result.conflictingSourceIds),
    }
  }
  if (result.status === 'idempotency-conflict') {
    return {
      status: 'idempotency-conflict',
      conflictingKeys: conflictingKeysFor(changes, result.conflictingSourceIds),
    }
  }

  return {
    status: 'applied',
    changes: result.changes.map(({ sourceId, sharedInformationItemId }) => ({
      sourceId,
      sharedInformationItemId,
    })),
  }
}

function conflictingKeysFor(
  changes: DirectTimetableChangeOperation[],
  conflictingSourceIds: string[],
) {
  const conflictingSources = new Set(conflictingSourceIds)
  return changes
    .filter((change) => conflictingSources.has(change.sourceId))
    .map(({ targetScope, changeDate, periodNumber }) => ({
      targetScopeType: targetScope.type,
      changeDate,
      periodNumber,
    }))
}

function parseReplacement(value: unknown): TimetableChangeReplacement | null {
  if (!value || typeof value !== 'object') return null
  const replacement = value as Record<string, unknown>

  if (replacement.type === 'cancelled') return { type: 'cancelled' }
  if (
    replacement.type === 'lesson_name' &&
    typeof replacement.lessonName === 'string' &&
    replacement.lessonName.trim().length > 0 &&
    replacement.lessonName.trim().length <= 80
  ) {
    return { type: 'lesson_name', lessonName: replacement.lessonName.trim() }
  }
  if (
    replacement.type === 'period_reference' &&
    Number.isInteger(replacement.weekday) &&
    Number(replacement.weekday) >= 1 &&
    Number(replacement.weekday) <= 6 &&
    Number.isInteger(replacement.periodNumber) &&
    Number(replacement.periodNumber) >= 1 &&
    Number(replacement.periodNumber) <= 7
  ) {
    return {
      type: 'period_reference',
      weekday: Number(replacement.weekday),
      periodNumber: Number(replacement.periodNumber),
    }
  }
  if (
    replacement.type === 'floating_lesson_reference' &&
    typeof replacement.floatingLessonReferenceLabelId === 'string' &&
    replacement.floatingLessonReferenceLabelId.length > 0 &&
    replacement.floatingLessonReferenceLabelId.length <= 200
  ) {
    return {
      type: 'floating_lesson_reference',
      floatingLessonReferenceLabelId:
        replacement.floatingLessonReferenceLabelId,
    }
  }

  return null
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
