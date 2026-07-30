import type { ReadyStudentOperationalContext } from '../studentOperationalContext'
import {
  persistenceIds,
  type AtomicChange,
  type AtomicNoteChange,
  type AtomicTaskChange,
  type AtomicTimetableChange,
  type DirectChangeCatalog,
  type LessonNameValue,
  type TimetableReplacementValue,
} from '../sharedInformationChange/atomicProgram'
import {
  isTargetScopeType,
  targetScopeForStudentAffiliation,
  type TargetScopeType,
} from '../targetScopePolicy'
import { isValidSchoolDate } from '../timetable'

export type DirectChangeDraft = {
  kind?: unknown
  changeKind?: unknown
  sourceId: unknown
  sharedInformationItemId?: unknown
  expectedLatestChangeId?: unknown
  targetScopeType: unknown
  changeDate?: unknown
  periodNumber?: unknown
  replacement?: unknown
  title?: unknown
  dueDate?: unknown
  relatedLessonName?: unknown
  schoolDate?: unknown
  relatedTaskItemId?: unknown
  body?: unknown
}

type KindParseInput = {
  candidate: DirectChangeDraft
  changeKind: unknown
  context: ReadyStudentOperationalContext
  catalog: DirectChangeCatalog
}

type DirectChangeKind = AtomicChange['kind']

type DirectChangeKindRule = {
  parse(input: KindParseInput): Promise<AtomicChange | null>
}

const rules: Record<DirectChangeKind, DirectChangeKindRule> = {
  timetable_change: {
    parse: parseTimetableChange,
  },
  task: {
    parse: parseTask,
  },
  note: {
    parse: async (input) => parseNote(input),
  },
}

export function isDirectChangeKind(value: unknown): value is DirectChangeKind {
  return typeof value === 'string' && value in rules
}

export function parseDirectChange(
  kind: DirectChangeKind,
  input: KindParseInput,
) {
  return rules[kind].parse(input)
}

async function parseTimetableChange({
  candidate,
  changeKind,
  context,
  catalog,
}: KindParseInput): Promise<AtomicTimetableChange | null> {
  const { currentSchoolYear: schoolYear, studentAffiliation: affiliation } =
    context
  const replacement = changeKind === 'remove'
    ? null
    : await parseReplacement(candidate.replacement, catalog)
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
      !isExpectedChangeId(candidate.expectedLatestChangeId))
  ) return null

  if (
    replacement?.type === 'floating_lesson_reference' &&
    !(await catalog.findFloatingLessonReferenceLabel(
      replacement.floatingLessonReferenceLabelId,
      schoolYear.schoolYear,
      affiliation.grade,
    ))
  ) return null

  const common = directChangeBase(
    'timetable_change',
    candidate.sourceId,
    changeKind === 'add'
      ? candidate.sourceId
      : candidate.sharedInformationItemId as string,
    candidate.targetScopeType,
    context,
  )
  const timetable = {
    ...common,
    changeDate: candidate.changeDate,
    periodNumber: Number(candidate.periodNumber),
  }
  return changeKind === 'add'
    ? { ...timetable, changeKind, replacement: replacement! }
    : changeKind === 'update'
      ? {
          ...timetable,
          changeKind,
          replacement: replacement!,
          expectedLatestChangeId: candidate.expectedLatestChangeId as string,
        }
      : {
          ...timetable,
          changeKind,
          expectedLatestChangeId: candidate.expectedLatestChangeId as string,
        }
}

async function parseTask({
  candidate,
  changeKind,
  context,
  catalog,
}: KindParseInput): Promise<AtomicTaskChange | null> {
  const { currentSchoolYear: schoolYear } = context
  if (
    !Object.keys(candidate).every((key) => taskDraftKeys.has(key)) ||
    (changeKind !== 'add' && changeKind !== 'update' && changeKind !== 'remove') ||
    typeof candidate.sourceId !== 'string' ||
    !uuidPattern.test(candidate.sourceId) ||
    !isTargetScopeType(candidate.targetScopeType) ||
    candidate.changeDate !== undefined ||
    candidate.periodNumber !== undefined ||
    candidate.replacement !== undefined ||
    (changeKind === 'add'
      ? candidate.sharedInformationItemId !== undefined ||
        candidate.expectedLatestChangeId !== undefined
      : typeof candidate.sharedInformationItemId !== 'string' ||
        !uuidPattern.test(candidate.sharedInformationItemId) ||
        !isExpectedChangeId(candidate.expectedLatestChangeId))
  ) return null

  const common = directChangeBase(
    'task',
    candidate.sourceId,
    changeKind === 'add'
      ? candidate.sourceId
      : candidate.sharedInformationItemId as string,
    candidate.targetScopeType,
    context,
  )
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
      cascade: {
        type: 'remove-active-task-notes',
        cause: {
          type: 'task-cascade',
          causedByChangeId:
            common.persistenceIds.sharedInformationChangeId,
        },
      },
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

  const relatedLessonName = await parseLessonName(
    candidate.relatedLessonName,
    catalog,
  )
  if (relatedLessonName === undefined) return null
  const snapshot = {
    title: candidate.title.trim(),
    dueDate,
    relatedLessonName,
  }
  return changeKind === 'add'
    ? { ...common, ...snapshot, changeKind }
    : {
        ...common,
        ...snapshot,
        changeKind,
        expectedLatestChangeId: candidate.expectedLatestChangeId as string,
      }
}

function parseNote({
  candidate,
  changeKind,
  context,
}: KindParseInput): AtomicNoteChange | null {
  const { currentSchoolYear: schoolYear } = context
  const hasRelatedTask = candidate.relatedTaskItemId !== undefined
  const hasDailyLesson = candidate.periodNumber !== undefined
  if (
    !Object.keys(candidate).every((key) => noteDraftKeys.has(key)) ||
    (changeKind !== 'add' && changeKind !== 'update' && changeKind !== 'remove') ||
    typeof candidate.sourceId !== 'string' ||
    !uuidPattern.test(candidate.sourceId) ||
    !isTargetScopeType(candidate.targetScopeType) ||
    (changeKind === 'add'
      ? candidate.sharedInformationItemId !== undefined ||
        candidate.expectedLatestChangeId !== undefined
      : typeof candidate.sharedInformationItemId !== 'string' ||
        !uuidPattern.test(candidate.sharedInformationItemId) ||
        !isExpectedChangeId(candidate.expectedLatestChangeId)) ||
    (changeKind === 'add'
      ? hasRelatedTask
        ? typeof candidate.relatedTaskItemId !== 'string' ||
          !uuidPattern.test(candidate.relatedTaskItemId) ||
          candidate.schoolDate !== undefined ||
          candidate.periodNumber !== undefined
        : candidate.schoolDate !== null &&
          (typeof candidate.schoolDate !== 'string' ||
            !isValidSchoolDate(candidate.schoolDate) ||
            candidate.schoolDate < schoolYear.startsOn ||
            candidate.schoolDate > schoolYear.endsOn) ||
          (hasDailyLesson &&
            (candidate.schoolDate === null ||
              !Number.isInteger(candidate.periodNumber) ||
              Number(candidate.periodNumber) < 1 ||
              Number(candidate.periodNumber) > 7))
      : candidate.schoolDate !== undefined ||
        candidate.periodNumber !== undefined ||
        candidate.relatedTaskItemId !== undefined) ||
    (changeKind === 'remove'
      ? candidate.body !== undefined
      : typeof candidate.body !== 'string' ||
        candidate.body.trim().length < 1 ||
        candidate.body.trim().length > 1000)
  ) return null

  const common = directChangeBase(
    'note',
    candidate.sourceId,
    changeKind === 'add'
      ? candidate.sourceId
      : candidate.sharedInformationItemId as string,
    candidate.targetScopeType,
    context,
  )
  if (changeKind === 'remove') {
    return {
      ...common,
      changeKind,
      expectedLatestChangeId: candidate.expectedLatestChangeId as string,
      removalReason: 'student',
    }
  }
  const body = (candidate.body as string).trim()
  return changeKind === 'add'
    ? {
        ...common,
        changeKind,
        schoolDate: hasRelatedTask ? null : candidate.schoolDate as string | null,
        periodNumber: hasRelatedTask || !hasDailyLesson
          ? null
          : Number(candidate.periodNumber),
        ...(hasRelatedTask
          ? { relatedTaskItemId: candidate.relatedTaskItemId as string }
          : {}),
        body,
      }
    : {
        ...common,
        changeKind,
        body,
        expectedLatestChangeId: candidate.expectedLatestChangeId as string,
      }
}

async function parseLessonName(
  value: unknown,
  catalog: DirectChangeCatalog,
): Promise<LessonNameValue | null | undefined> {
  if (value === undefined || value === null) return null
  if (!value || typeof value !== 'object') return undefined
  const lesson = value as Record<string, unknown>
  if (
    typeof lesson.registeredLessonNameId === 'string' &&
    lesson.lessonName === undefined &&
    Object.keys(lesson).every((key) => key === 'registeredLessonNameId')
  ) {
    return await catalog.findRegisteredLessonName(
      lesson.registeredLessonNameId,
    )
      ? {
          type: 'registered',
          registeredLessonNameId: lesson.registeredLessonNameId,
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
    return { type: 'custom', lessonName: lesson.lessonName.trim() }
  }
  return undefined
}

function directChangeBase<K extends DirectChangeKind>(
  kind: K,
  directChangeId: string,
  sharedInformationItemId: string,
  targetScopeType: TargetScopeType,
  context: ReadyStudentOperationalContext,
) {
  const source = {
    type: 'direct' as const,
    directChangeId,
  }
  return {
    kind,
    source,
    sharedInformationItemId,
    persistenceIds: persistenceIds(source),
    targetScope: targetScopeForStudentAffiliation(
      context.studentAffiliation,
      targetScopeType,
    ),
    changedByStudentAccountId: context.studentAccount.studentAccountId,
  }
}

async function parseReplacement(
  value: unknown,
  catalog: DirectChangeCatalog,
): Promise<TimetableReplacementValue | null> {
  if (!value || typeof value !== 'object') return null
  const replacement = value as Record<string, unknown>
  if (
    replacement.type === 'cancelled' &&
    Object.keys(replacement).every((key) => key === 'type')
  ) return { type: 'cancelled' }
  if (
    replacement.type === 'lesson_name' &&
    Object.keys(replacement).every((key) =>
      key === 'type' ||
      key === 'registeredLessonNameId' ||
      key === 'lessonName'
    )
  ) {
    const lessonName = await parseLessonName(
      {
        ...(replacement.registeredLessonNameId !== undefined
          ? { registeredLessonNameId: replacement.registeredLessonNameId }
          : {}),
        ...(replacement.lessonName !== undefined
          ? { lessonName: replacement.lessonName }
          : {}),
      },
      catalog,
    )
    return lessonName ? { type: 'lesson_name', lessonName } : null
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

function isExpectedChangeId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 200
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

const noteDraftKeys = new Set([
  'kind',
  'changeKind',
  'sourceId',
  'sharedInformationItemId',
  'expectedLatestChangeId',
  'targetScopeType',
  'schoolDate',
  'periodNumber',
  'relatedTaskItemId',
  'body',
])

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
