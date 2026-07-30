import type { ReadyStudentOperationalContext } from '../studentOperationalContext'
import type { TargetScope } from '../targetScopePolicy'

export type ChangeSource =
  | { type: 'direct'; directChangeId: string }
  | { type: 'proposal'; changeProposalId: string }

export type LessonNameValue =
  | { type: 'registered'; registeredLessonNameId: string }
  | { type: 'custom'; lessonName: string }

export type TimetableReplacementValue =
  | { type: 'cancelled' }
  | { type: 'lesson_name'; lessonName: LessonNameValue }
  | { type: 'period_reference'; weekday: number; periodNumber: number }
  | {
      type: 'floating_lesson_reference'
      floatingLessonReferenceLabelId: string
    }

type AtomicChangeBase = {
  source: ChangeSource
  sharedInformationItemId: string
  persistenceIds: PersistenceIds
  targetScope: TargetScope
  changedByStudentAccountId: string
}

export type PersistenceIds = Readonly<{
  sharedInformationChangeId: string
  snapshotId: string
  targetScopeId: string
  targetScopePartId: string
}>

export type AtomicTimetableChange = AtomicChangeBase & {
  kind: 'timetable_change'
  changeDate: string
  periodNumber: number
} & (
  | {
      changeKind: 'add'
      replacement: TimetableReplacementValue
    }
  | {
      changeKind: 'update'
      replacement: TimetableReplacementValue
      expectedLatestChangeId: string
    }
  | {
      changeKind: 'remove'
      expectedLatestChangeId: string
    }
)

export type AtomicTaskChange = AtomicChangeBase & {
  kind: 'task'
} & (
  | {
      changeKind: 'add'
      title: string
      dueDate: string | null
      relatedLessonName: LessonNameValue | null
    }
  | {
      changeKind: 'update'
      title: string
      dueDate: string | null
      relatedLessonName: LessonNameValue | null
      expectedLatestChangeId: string
    }
  | {
      changeKind: 'remove'
      expectedLatestChangeId: string
      cascade: {
        type: 'remove-active-task-notes'
        cause: {
          type: 'task-cascade'
          causedByChangeId: string
        }
      }
    }
)

export type AtomicNoteChange = AtomicChangeBase & {
  kind: 'note'
} & (
  | {
      changeKind: 'add'
      schoolDate: string | null
      periodNumber: number | null
      relatedTaskItemId?: string
      body: string
    }
  | {
      changeKind: 'update'
      body: string
      expectedLatestChangeId: string
    }
  | {
      changeKind: 'remove'
      expectedLatestChangeId: string
      removalReason: 'student'
    }
)

export type AtomicChange =
  | AtomicTimetableChange
  | AtomicTaskChange
  | AtomicNoteChange

export type StudentAffiliationAssertion = Readonly<{
  studentAffiliationId: string
  studentAccountId: string
  schoolYear: number
  grade: number
  classId: string
  trackId: string
  selectedAt: number
}>

export type AtomicApplicationProgram = Readonly<{
  affiliation: StudentAffiliationAssertion
  appliedAt: number
  changes: readonly AtomicChange[]
}>

export type AppliedChangeReceipt = {
  sourceId: string
  sharedInformationItemId: string
}

export type AtomicExecutionResult =
  | { status: 'applied'; changes: AppliedChangeReceipt[] }
  | { status: 'invalid-change'; sourceIds: string[] }
  | { status: 'conflict'; sourceIds: string[] }
  | { status: 'idempotency-conflict'; sourceIds: string[] }

export interface AtomicChangeExecutor {
  execute(program: AtomicApplicationProgram): Promise<AtomicExecutionResult>
}

export interface DirectChangeCatalog {
  findRegisteredLessonName(
    registeredLessonNameId: string,
  ): Promise<{
    registeredLessonNameId: string
    shortLessonName: string
  } | null>
  findFloatingLessonReferenceLabel(
    floatingLessonReferenceLabelId: string,
    schoolYear: number,
    grade: number,
  ): Promise<unknown | null>
}

export type DirectChangeApplicationResult = AtomicExecutionResult

export interface DirectChangeApplication {
  apply(input: {
    context: ReadyStudentOperationalContext
    drafts: unknown
  }): Promise<DirectChangeApplicationResult>
}

export function sourceId(source: ChangeSource) {
  return source.type === 'direct'
    ? source.directChangeId
    : source.changeProposalId
}

export function persistentId(source: ChangeSource, suffix: string) {
  const namespace = source.type === 'direct'
    ? source.directChangeId
    : `proposal:${source.changeProposalId}`
  return `${namespace}:${suffix}`
}

export function persistenceIds(source: ChangeSource): PersistenceIds {
  return {
    sharedInformationChangeId: persistentId(source, 'change'),
    snapshotId: persistentId(source, 'snapshot'),
    targetScopeId: persistentId(source, 'scope'),
    targetScopePartId: persistentId(source, 'part'),
  }
}

export function taskCascadeSource(
  parent: ChangeSource,
  noteItemId: string,
): ChangeSource {
  const id = `${sourceId(parent)}:task-cascade:${noteItemId}`
  return parent.type === 'direct'
    ? { type: 'direct', directChangeId: id }
    : { type: 'proposal', changeProposalId: id }
}

export function affiliationAssertion(
  context: ReadyStudentOperationalContext,
): StudentAffiliationAssertion {
  const affiliation = context.studentAffiliation
  return {
    studentAffiliationId: affiliation.studentAffiliationId,
    studentAccountId: affiliation.studentAccountId,
    schoolYear: affiliation.schoolYear,
    grade: affiliation.grade,
    classId: affiliation.classId,
    trackId: affiliation.trackId,
    selectedAt: affiliation.selectedAt,
  }
}
