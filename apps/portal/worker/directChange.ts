import type {
  DirectChangeOperation,
  DirectChangeStore,
  DirectNoteOperation,
  DirectTaskOperation,
  DirectTimetableChangeOperation,
  SchoolYearRecord,
  StudentAffiliation,
  StudentAccountAccessStore,
  TimetableLayerKey,
  TimetableChangeReplacement,
} from './persistence'
import { resolveStudentOperationalContext } from './studentOperationalContext'
import {
  isTargetScopeType,
  targetScopeForStudentAffiliation,
  targetScopesEqual,
} from './targetScopePolicy'
import { isValidSchoolDate } from './timetable'

type DirectChangeDraft = {
  kind?: unknown
  changeKind?: unknown
  sourceId: unknown
  sharedInformationItemId?: unknown
  expectedLatestChangeId?: unknown
  targetScopeType: unknown
  changeDate: unknown
  periodNumber: unknown
  replacement: unknown
  title?: unknown
  dueDate?: unknown
  relatedLessonName?: unknown
  schoolDate?: unknown
  body?: unknown
}

type DirectChangeKind = DirectChangeOperation['kind']

type DirectChangeKindParseInput = {
  candidate: DirectChangeDraft
  changeKind: unknown
  schoolYear: SchoolYearRecord
  affiliation: StudentAffiliation
  changedByStudentAccountId: string
  now: number
  store: DirectChangeStore
}

type DirectChangeKindRule = {
  parse(
    input: DirectChangeKindParseInput,
  ): Promise<DirectChangeOperation | null>
}

const directChangeKindRules: Record<DirectChangeKind, DirectChangeKindRule> = {
  timetable_change: {
    async parse(input) {
      const operation = await parseTimetableChangeOperation(input)
      return operation ? { ...operation, kind: 'timetable_change' } : null
    },
  },
  task: {
    async parse(input) {
      const operation = await parseTaskOperation(input)
      return operation ? { ...operation, kind: 'task' } : null
    },
  },
  note: {
    async parse(input) {
      const operation = parseNoteOperation(input)
      return operation ? { ...operation, kind: 'note' } : null
    },
  },
}

function isDirectChangeKind(value: unknown): value is DirectChangeKind {
  return typeof value === 'string' && value in directChangeKindRules
}

export type ApplyDirectChangesResult =
  | { status: 'applied'; changes: Array<{ sourceId: string; sharedInformationItemId: string }> }
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

export async function readDirectTimetableChangeOptions({
  sessionToken,
  now,
  studentAccountStore,
  store,
}: {
  sessionToken: string | null
  now: number
  studentAccountStore: StudentAccountAccessStore
  store: DirectChangeStore
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
  const periodReferences = resolvedPeriodEntries
    .map(({ weekday, periodNumber, lessonName }) => ({
      weekday,
      periodNumber,
      lessonName,
    }))
    .filter((entry) => entry !== null)
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
    schoolYearRange: { startsOn: schoolYear.startsOn, endsOn: schoolYear.endsOn },
    periodReferences,
    floatingLessonReferenceLabels,
    registeredLessonNames: allRegisteredLessonNames
      .filter((lessonName) => prioritizedIds.has(lessonName.registeredLessonNameId))
      .map(toOption),
    allRegisteredLessonNames: allRegisteredLessonNames.map(toOption),
  }
}

export async function applyDirectChanges({
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
  store: DirectChangeStore
}): Promise<ApplyDirectChangesResult> {
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

  const changes: DirectChangeOperation[] = []

  for (const candidate of drafts as DirectChangeDraft[]) {
    const kind = candidate.kind ?? 'timetable_change'
    const changeKind = candidate.changeKind ?? 'add'
    if (!isDirectChangeKind(kind)) return { status: 'invalid-change' }
    const change = await directChangeKindRules[kind].parse({
      candidate,
      changeKind,
      schoolYear,
      affiliation,
      changedByStudentAccountId: studentAccount.studentAccountId,
      now,
      store,
    })
    if (!change) return { status: 'invalid-change' }
    changes.push(change)
  }

  const timetableChanges = changes.filter(
    (change): change is Extract<DirectChangeOperation, { kind: 'timetable_change' }> =>
      change.kind === 'timetable_change',
  )
  const hasDuplicateSlot = timetableChanges.some((change, index) =>
    timetableChanges.slice(0, index).some((candidate) =>
      targetScopesEqual(candidate.targetScope, change.targetScope) &&
      candidate.changeDate === change.changeDate &&
      candidate.periodNumber === change.periodNumber
    )
  )
  const taskItemChanges = changes.filter(
    (change): change is Extract<DirectChangeOperation, { kind: 'task' }> =>
      change.kind === 'task' && change.changeKind !== 'add',
  )
  const hasDuplicateTaskItem = taskItemChanges.some((change, index) =>
    taskItemChanges.slice(0, index).some(
      (candidate) =>
        candidate.sharedInformationItemId === change.sharedInformationItemId,
    )
  )
  if (
    new Set(changes.map((change) => change.sourceId)).size !== changes.length ||
    hasDuplicateSlot ||
    hasDuplicateTaskItem
  ) {
    return { status: 'invalid-change' }
  }

  const result = await store.commitDirectChanges(changes)

  if (result.status === 'conflict') {
    const conflictingNonTimetableSourceIds = nonTimetableConflictSourceIds(
      changes,
      result.conflictingSourceIds,
    )
    return {
      status: 'timetable-change-conflict',
      conflictingKeys: conflictingKeysFor(timetableChanges, result.conflictingSourceIds),
      ...(conflictingNonTimetableSourceIds.length > 0
        ? { conflictingSourceIds: conflictingNonTimetableSourceIds }
        : {}),
    }
  }
  if (result.status === 'idempotency-conflict') {
    const conflictingNonTimetableSourceIds = nonTimetableConflictSourceIds(
      changes,
      result.conflictingSourceIds,
    )
    return {
      status: 'idempotency-conflict',
      conflictingKeys: conflictingKeysFor(timetableChanges, result.conflictingSourceIds),
      ...(conflictingNonTimetableSourceIds.length > 0
        ? { conflictingSourceIds: conflictingNonTimetableSourceIds }
        : {}),
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

function nonTimetableConflictSourceIds(
  changes: DirectChangeOperation[],
  conflictingSourceIds: string[],
) {
  const nonTimetableSources = new Set(
    changes
      .filter((change) => change.kind !== 'timetable_change')
      .map((change) => change.sourceId),
  )
  return conflictingSourceIds.filter((sourceId) => nonTimetableSources.has(sourceId))
}

async function parseTimetableChangeOperation({
  candidate,
  changeKind,
  schoolYear,
  affiliation,
  changedByStudentAccountId,
  now,
  store,
}: DirectChangeKindParseInput): Promise<DirectTimetableChangeOperation | null> {
  const replacement = changeKind === 'remove'
    ? null
    : await parseReplacement(candidate.replacement, store)

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
  ) return null

  if (
    changeKind !== 'add' &&
    (typeof candidate.sharedInformationItemId !== 'string' ||
      !uuidPattern.test(candidate.sharedInformationItemId) ||
      typeof candidate.expectedLatestChangeId !== 'string' ||
      candidate.expectedLatestChangeId.length === 0 ||
      candidate.expectedLatestChangeId.length > 200)
  ) return null

  if (
    replacement?.type === 'floating_lesson_reference' &&
    !(await store.findFloatingLessonReferenceLabel(
      replacement.floatingLessonReferenceLabelId,
      schoolYear.schoolYear,
      affiliation.grade,
    ))
  ) return null

  const common = {
    sourceId: candidate.sourceId,
    latestChangeId: `${candidate.sourceId}:change`,
    targetScope: targetScopeForStudentAffiliation(
      affiliation,
      candidate.targetScopeType,
    ),
    changeDate: candidate.changeDate,
    periodNumber: Number(candidate.periodNumber),
    changedByStudentAccountId,
    changedAt: now,
  }
  return changeKind === 'update'
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
        }
}

function parseNoteOperation({
  candidate,
  changeKind,
  schoolYear,
  affiliation,
  changedByStudentAccountId,
  now,
}: {
  candidate: DirectChangeDraft
  changeKind: unknown
  schoolYear: SchoolYearRecord
  affiliation: StudentAffiliation
  changedByStudentAccountId: string
  now: number
}): DirectNoteOperation | null {
  if (
    !Object.keys(candidate).every((key) => noteDraftKeys.has(key)) ||
    changeKind !== 'add' ||
    typeof candidate.sourceId !== 'string' ||
    !uuidPattern.test(candidate.sourceId) ||
    !isTargetScopeType(candidate.targetScopeType) ||
    typeof candidate.schoolDate !== 'string' ||
    !isValidSchoolDate(candidate.schoolDate) ||
    candidate.schoolDate < schoolYear.startsOn ||
    candidate.schoolDate > schoolYear.endsOn ||
    typeof candidate.body !== 'string' ||
    candidate.body.trim().length < 1 ||
    candidate.body.trim().length > 1000 ||
    candidate.sharedInformationItemId !== undefined ||
    candidate.expectedLatestChangeId !== undefined
  ) return null

  return {
    sourceId: candidate.sourceId,
    sharedInformationItemId: candidate.sourceId,
    latestChangeId: `${candidate.sourceId}:change`,
    targetScope: targetScopeForStudentAffiliation(
      affiliation,
      candidate.targetScopeType,
    ),
    schoolDate: candidate.schoolDate,
    body: candidate.body.trim(),
    changedByStudentAccountId,
    changedAt: now,
    createdAt: now,
    changeKind: 'add',
  }
}

const noteDraftKeys = new Set([
  'kind',
  'changeKind',
  'sourceId',
  'targetScopeType',
  'schoolDate',
  'body',
])

async function parseTaskOperation({
  candidate,
  changeKind,
  schoolYear,
  affiliation,
  changedByStudentAccountId,
  now,
  store,
}: {
  candidate: DirectChangeDraft
  changeKind: unknown
  schoolYear: SchoolYearRecord
  affiliation: StudentAffiliation
  changedByStudentAccountId: string
  now: number
  store: DirectChangeStore
}): Promise<DirectTaskOperation | null> {
  if (
    !Object.keys(candidate).every((key) => taskDraftKeys.has(key)) ||
    (changeKind !== 'add' && changeKind !== 'update' && changeKind !== 'remove') ||
    typeof candidate.sourceId !== 'string' ||
    !uuidPattern.test(candidate.sourceId) ||
    !isTargetScopeType(candidate.targetScopeType) ||
    candidate.changeDate !== undefined ||
    candidate.periodNumber !== undefined ||
    candidate.replacement !== undefined
  ) {
    return null
  }

  if (
    changeKind === 'add'
      ? candidate.sharedInformationItemId !== undefined ||
        candidate.expectedLatestChangeId !== undefined
      : typeof candidate.sharedInformationItemId !== 'string' ||
        !uuidPattern.test(candidate.sharedInformationItemId) ||
        typeof candidate.expectedLatestChangeId !== 'string' ||
        candidate.expectedLatestChangeId.length < 1 ||
        candidate.expectedLatestChangeId.length > 200
  ) return null

  const common = {
    sourceId: candidate.sourceId,
    sharedInformationItemId: changeKind === 'add'
      ? candidate.sourceId
      : candidate.sharedInformationItemId as string,
    latestChangeId: `${candidate.sourceId}:change`,
    targetScope: targetScopeForStudentAffiliation(
      affiliation,
      candidate.targetScopeType,
    ),
    changedByStudentAccountId,
    changedAt: now,
  }

  if (changeKind === 'remove') {
    if (
      candidate.title !== undefined ||
      candidate.dueDate !== undefined ||
      candidate.relatedLessonName !== undefined
    ) return null
    return {
      ...common,
      changeKind,
      expectedLatestChangeId: candidate.expectedLatestChangeId as string,
    }
  }

  if (
    typeof candidate.title !== 'string' ||
    candidate.title.trim().length < 1 ||
    candidate.title.trim().length > 120 ||
    /[\r\n]/.test(candidate.title)
  ) return null

  const dueDate = candidate.dueDate === undefined || candidate.dueDate === null
    ? null
    : typeof candidate.dueDate === 'string' &&
        isValidSchoolDate(candidate.dueDate) &&
        candidate.dueDate >= schoolYear.startsOn &&
        candidate.dueDate <= schoolYear.endsOn
      ? candidate.dueDate
      : undefined
  if (dueDate === undefined) return null

  const relatedLessonName = await parseTaskRelatedLessonName(
    candidate.relatedLessonName,
    store,
  )
  if (relatedLessonName === undefined) return null

  const snapshot = {
    title: candidate.title.trim(),
    dueDate,
    relatedLessonName,
  }
  return changeKind === 'add'
    ? { ...common, ...snapshot, changeKind, createdAt: now }
    : {
        ...common,
        ...snapshot,
        changeKind,
        expectedLatestChangeId: candidate.expectedLatestChangeId as string,
      }
}

const taskDraftKeys = new Set([
  'kind',
  'changeKind',
  'sourceId',
  'sharedInformationItemId',
  'expectedLatestChangeId',
  'targetScopeType',
  'title',
  'dueDate',
  'relatedLessonName',
])

async function parseTaskRelatedLessonName(
  value: unknown,
  store: DirectChangeStore,
) {
  if (value === undefined || value === null) return null
  if (!value || typeof value !== 'object') return undefined
  const lesson = value as Record<string, unknown>
  if (
    typeof lesson.registeredLessonNameId === 'string' &&
    lesson.lessonName === undefined &&
    Object.keys(lesson).every((key) => key === 'registeredLessonNameId')
  ) {
    const registered = await store.findRegisteredLessonName(
      lesson.registeredLessonNameId,
    )
    return registered
      ? {
          registeredLessonNameId: registered.registeredLessonNameId,
          lessonName: registered.shortLessonName,
        }
      : undefined
  }
  if (
    typeof lesson.lessonName === 'string' &&
    lesson.registeredLessonNameId === undefined &&
    lesson.lessonName.trim().length >= 1 &&
    lesson.lessonName.trim().length <= 80 &&
    !/[\r\n]/.test(lesson.lessonName) &&
    Object.keys(lesson).every((key) => key === 'lessonName')
  ) {
    return { lessonName: lesson.lessonName.trim() }
  }
  return undefined
}

async function parseReplacement(
  value: unknown,
  store: DirectChangeStore,
): Promise<TimetableChangeReplacement | null> {
  if (!value || typeof value !== 'object') return null
  const replacement = value as Record<string, unknown>

  if (replacement.type === 'cancelled') return { type: 'cancelled' }
  if (
    replacement.type === 'lesson_name' &&
    typeof replacement.registeredLessonNameId === 'string' &&
    replacement.registeredLessonNameId.length > 0 &&
    replacement.registeredLessonNameId.length <= 200
  ) {
    const registered = await store.findRegisteredLessonName(
      replacement.registeredLessonNameId,
    )
    return registered
      ? {
          type: 'lesson_name',
          registeredLessonNameId: registered.registeredLessonNameId,
          lessonName: registered.shortLessonName,
        }
      : null
  }
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

export const applyDirectTimetableChanges = applyDirectChanges
export type ApplyDirectTimetableChangesResult = ApplyDirectChangesResult
