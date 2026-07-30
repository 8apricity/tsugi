import type {
  MaterializedSharedInformationChange,
  MaterializedTaskLessonName,
  MaterializedTimetableChange,
} from './materializedChange'
import {
  sourceId,
  type AtomicApplicationProgram,
  type AtomicChange,
  type AtomicExecutionResult,
  type LessonNameValue,
  type StudentAffiliationAssertion,
  type TimetableReplacementValue,
} from './atomicProgram'
import { changeSourceKey } from './executionPolicy'

export type MaterializedAtomicChangeBackend = {
  apply(
    changes: MaterializedSharedInformationChange[],
    affiliation?: StudentAffiliationAssertion,
  ): Promise<
    | { status: 'applied'; changes: MaterializedSharedInformationChange[] }
    | { status: 'invalid-change' }
    | { status: 'conflict'; conflictingSourceIds: string[] }
    | { status: 'idempotency-conflict'; conflictingSourceIds: string[] }
  >
}

export async function executeAtomicProgram(
  backend: MaterializedAtomicChangeBackend,
  program: AtomicApplicationProgram,
): Promise<AtomicExecutionResult> {
  const changes: MaterializedSharedInformationChange[] = []
  for (const change of program.changes) {
    changes.push(materializeChange(change, program.appliedAt))
  }

  const result = await backend.apply(changes, program.affiliation)
  if (result.status === 'applied') {
    const bySource = new Map(
      result.changes.map((change) => [
        changeSourceKey(change),
        change.sharedInformationItemId,
      ]),
    )
    return {
      status: 'applied',
      changes: program.changes.map((change) => {
        const id = sourceId(change.source)
        return {
          sourceId: id,
          sharedInformationItemId:
            bySource.get(changeSourceKey({
              source: change.source,
            })) ?? change.sharedInformationItemId,
        }
      }),
    }
  }
  if (result.status === 'invalid-change') {
    return {
      status: 'invalid-change',
      sourceIds: program.changes.map((change) => sourceId(change.source)),
    }
  }
  return {
    status: result.status,
    sourceIds: result.conflictingSourceIds,
  }
}

function materializeChange(
  change: AtomicChange,
  appliedAt: number,
): MaterializedSharedInformationChange {
  const base = {
    source: change.source,
    sharedInformationItemId: change.sharedInformationItemId,
    latestChangeId: change.persistenceIds.sharedInformationChangeId,
    persistenceIds: change.persistenceIds,
    targetScope: change.targetScope,
    changedByStudentAccountId: change.changedByStudentAccountId,
    changedAt: appliedAt,
  }
  if (change.kind === 'task') {
    const taskBase = { ...base, kind: 'task' as const }
    if (change.changeKind === 'remove') {
      return {
        ...taskBase,
        changeKind: 'remove',
        expectedLatestChangeId: change.expectedLatestChangeId,
        cascade: change.cascade,
      }
    }
    const relatedLessonName = materializeLessonName(change.relatedLessonName)
    const snapshot = {
      title: change.title,
      dueDate: change.dueDate,
      relatedLessonName,
    }
    return change.changeKind === 'add'
      ? { ...taskBase, ...snapshot, changeKind: 'add', createdAt: appliedAt }
      : {
          ...taskBase,
          ...snapshot,
          changeKind: 'update',
          expectedLatestChangeId: change.expectedLatestChangeId,
        }
  }
  if (change.kind === 'note') {
    const noteBase = { ...base, kind: 'note' as const }
    if (change.changeKind === 'remove') {
      return {
        ...noteBase,
        changeKind: 'remove',
        expectedLatestChangeId: change.expectedLatestChangeId,
        removalReason: change.removalReason,
      }
    }
    if (change.changeKind === 'update') {
      return {
        ...noteBase,
        changeKind: 'update',
        body: change.body,
        expectedLatestChangeId: change.expectedLatestChangeId,
      }
    }
    return {
      ...noteBase,
      changeKind: 'add',
      schoolDate: change.schoolDate,
      periodNumber: change.periodNumber,
      ...(change.relatedTaskItemId
        ? { relatedTaskItemId: change.relatedTaskItemId }
        : {}),
      body: change.body,
      createdAt: appliedAt,
    }
  }
  if (change.changeKind === 'remove') {
    return {
      ...base,
      kind: 'timetable_change',
      changeDate: change.changeDate,
      periodNumber: change.periodNumber,
      changeKind: 'remove',
      expectedLatestChangeId: change.expectedLatestChangeId,
    }
  }
  const replacement = materializeReplacement(change.replacement)
  const timetable = {
    ...base,
    kind: 'timetable_change' as const,
    changeDate: change.changeDate,
    periodNumber: change.periodNumber,
    replacement,
  }
  return change.changeKind === 'add'
    ? { ...timetable, changeKind: 'add' }
    : {
        ...timetable,
        changeKind: 'update',
        expectedLatestChangeId: change.expectedLatestChangeId,
      }
}

function materializeLessonName(value: null): null
function materializeLessonName(
  value: LessonNameValue,
): MaterializedTaskLessonName
function materializeLessonName(
  value: LessonNameValue | null,
): MaterializedTaskLessonName | null
function materializeLessonName(
  value: LessonNameValue | null,
): MaterializedTaskLessonName | null {
  if (value === null) return null
  if (value.type === 'custom') return { lessonName: value.lessonName }
  return {
    registeredLessonNameId: value.registeredLessonNameId,
    // Legacy in-memory records require this field. Reads resolve the current
    // Short Lesson Name from the stable Registered identity.
    lessonName: '',
  }
}

function materializeReplacement(
  value: TimetableReplacementValue,
): Exclude<
  MaterializedTimetableChange,
  { changeKind: 'remove' }
>['replacement'] {
  if (value.type !== 'lesson_name') return value
  return {
    type: 'lesson_name',
    ...materializeLessonName(value.lessonName),
  }
}
