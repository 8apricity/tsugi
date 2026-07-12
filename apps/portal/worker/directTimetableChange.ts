import type {
  DirectTimetableChangeOperation,
  DirectTimetableChangeStore,
  StudentAccountAccessStore,
  TargetScopeType,
  TimetableLayerKey,
  TimetableChangeReplacement,
} from './persistence'
import { readStudentSession } from './studentAccountAccess'
import { isValidSchoolDate, selectStandardTimetableEntry } from './timetable'

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
  const session = await readStudentSession({ sessionToken, now, store: studentAccountStore })
  if (session.status === 'unauthenticated') return session
  const schoolYear = await store.findCurrentSchoolYear()
  if (!schoolYear) return { status: 'unavailable' as const }
  const affiliation = await store.findCurrentStudentAffiliation(
    session.studentAccount.studentAccountId,
    schoolYear.schoolYear,
  )
  if (!affiliation) {
    return { status: 'affiliation-renewal-needed' as const, schoolYear: schoolYear.schoolYear }
  }
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
  const periodReferences = entriesByWeekday.flatMap((entries, weekdayIndex) =>
    Array.from({ length: 7 }, (_, periodIndex) => {
      const entry = selectStandardTimetableEntry(
        entries,
        affiliation.trackId,
        periodIndex + 1,
      )
      return entry
        ? {
            weekday: weekdayIndex + 1,
            periodNumber: periodIndex + 1,
            lessonName: entry.lessonName,
          }
        : []
    }).flat(),
  )
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
  const session = await readStudentSession({
    sessionToken,
    now,
    store: studentAccountStore,
  })

  if (session.status === 'unauthenticated') return session

  const schoolYear = await store.findCurrentSchoolYear()

  if (!schoolYear) return { status: 'invalid-change' }

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

  if (!Array.isArray(drafts) || drafts.length === 0 || drafts.length > 50) {
    return { status: 'invalid-change' }
  }

  const changes: DirectTimetableChangeOperation[] = []

  for (const candidate of drafts as DirectChangeDraft[]) {
    const replacement = parseReplacement(candidate.replacement)
    const changeKind = candidate.changeKind ?? 'add'

    if (
      typeof candidate.sourceId !== 'string' ||
      !uuidPattern.test(candidate.sourceId) ||
      (changeKind !== 'add' && changeKind !== 'update') ||
      !isTargetScopeType(candidate.targetScopeType) ||
      typeof candidate.changeDate !== 'string' ||
      !isValidSchoolDate(candidate.changeDate) ||
      candidate.changeDate < schoolYear.startsOn ||
      candidate.changeDate > schoolYear.endsOn ||
      !Number.isInteger(candidate.periodNumber) ||
      Number(candidate.periodNumber) < 1 ||
      Number(candidate.periodNumber) > 7 ||
      !replacement
    ) {
      return { status: 'invalid-change' }
    }

    if (
      changeKind === 'update' &&
      (typeof candidate.sharedInformationItemId !== 'string' ||
        !uuidPattern.test(candidate.sharedInformationItemId) ||
        typeof candidate.expectedLatestChangeId !== 'string' ||
        candidate.expectedLatestChangeId.length === 0 ||
        candidate.expectedLatestChangeId.length > 200)
    ) {
      return { status: 'invalid-change' }
    }

    if (
      replacement.type === 'floating_lesson_reference' &&
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
      schoolYear: schoolYear.schoolYear,
      targetScopeType,
      targetScopeValue: targetScopeValue(targetScopeType, affiliation),
      changeDate: candidate.changeDate,
      periodNumber: Number(candidate.periodNumber),
      replacement,
      changedByStudentAccountId: session.studentAccount.studentAccountId,
      changedAt: now,
    }
    changes.push(
      changeKind === 'update'
        ? {
            ...common,
            changeKind,
            sharedInformationItemId: candidate.sharedInformationItemId as string,
            expectedLatestChangeId: candidate.expectedLatestChangeId as string,
          }
        : {
            ...common,
            changeKind,
            sharedInformationItemId: candidate.sourceId,
          },
    )
  }

  const slotKeys = changes.map((change) =>
    [
      change.schoolYear,
      change.targetScopeType,
      change.targetScopeValue,
      change.changeDate,
      change.periodNumber,
    ].join(':'),
  )
  if (
    new Set(changes.map((change) => change.sourceId)).size !== changes.length ||
    new Set(slotKeys).size !== changes.length
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
    .map(({ targetScopeType, changeDate, periodNumber }) => ({
      targetScopeType,
      changeDate,
      periodNumber,
    }))
}

function targetScopeValue(
  type: TargetScopeType,
  affiliation: {
    grade: number
    classId: string
    trackId: string
    studentAccountId: string
  },
) {
  if (type === 'grade') return String(affiliation.grade)
  if (type === 'class') return affiliation.classId
  if (type === 'track') return affiliation.trackId
  return affiliation.studentAccountId
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

function isTargetScopeType(value: unknown): value is TargetScopeType {
  return value === 'grade' || value === 'class' || value === 'track' || value === 'student'
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
