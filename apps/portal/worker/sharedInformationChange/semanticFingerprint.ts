import { timetableReplacementsEqual } from '../../shared/timetableProjection'
import type {
  MaterializedSharedInformationChange,
  MaterializedTaskLessonName,
} from './materializedChange'
import {
  sourceId,
  type ChangeSource,
} from './atomicProgram'
import { targetScopesEqual } from '../targetScopePolicy'

export function hasSameIdempotencySemantics(
  left: MaterializedSharedInformationChange,
  right: MaterializedSharedInformationChange,
) {
  if (left.kind !== right.kind) return false
  if (right.kind === 'timetable_change') {
    if (left.kind !== 'timetable_change') return false
    return sameTimetablePayload(left, right)
  }
  if (right.kind === 'note') {
    if (left.kind !== 'note') return false
    const sameBase =
      left.changeKind === right.changeKind &&
      sameChangeSource(left.source, right.source) &&
      left.sharedInformationItemId === right.sharedInformationItemId &&
      targetScopesEqual(left.targetScope, right.targetScope) &&
      left.changedByStudentAccountId === right.changedByStudentAccountId
    if (!sameBase || left.changeKind !== right.changeKind) return false
    if (left.changeKind === 'add' && right.changeKind === 'add') {
      return left.schoolDate === right.schoolDate &&
        left.periodNumber === right.periodNumber &&
        left.relatedTaskItemId === right.relatedTaskItemId &&
        left.body === right.body
    }
    if (left.changeKind === 'update' && right.changeKind === 'update') {
      return left.expectedLatestChangeId === right.expectedLatestChangeId &&
        left.body === right.body
    }
    return left.changeKind === 'remove' && right.changeKind === 'remove' &&
      left.expectedLatestChangeId === right.expectedLatestChangeId &&
      left.removalReason === right.removalReason
  }
  if (left.kind !== 'task') return false
  return left.changeKind === right.changeKind &&
    sameChangeSource(left.source, right.source) &&
    left.sharedInformationItemId === right.sharedInformationItemId &&
    sameExpectedLatestChangeId(left, right) &&
    targetScopesEqual(left.targetScope, right.targetScope) &&
    left.changedByStudentAccountId === right.changedByStudentAccountId &&
    (left.changeKind === 'remove' || right.changeKind === 'remove'
      ? left.changeKind === 'remove' && right.changeKind === 'remove'
      : left.title === right.title &&
        left.dueDate === right.dueDate &&
        sameTaskLessonName(
          left.relatedLessonName,
          right.relatedLessonName,
        ))
}

function sameTimetablePayload(
  left: Extract<
    MaterializedSharedInformationChange,
    { kind: 'timetable_change' }
  >,
  right: Extract<
    MaterializedSharedInformationChange,
    { kind: 'timetable_change' }
  >,
) {
  return (
    left.changeKind === right.changeKind &&
    left.sharedInformationItemId === right.sharedInformationItemId &&
    sameExpectedLatestChangeId(left, right) &&
    sameTimetableBase(left, right) &&
    (left.changeKind === 'remove' || right.changeKind === 'remove'
      ? left.changeKind === right.changeKind
      : timetableReplacementsEqual(left.replacement, right.replacement))
  )
}

function sameTimetableBase(
  left: Extract<
    MaterializedSharedInformationChange,
    { kind: 'timetable_change' }
  >,
  right: Extract<
    MaterializedSharedInformationChange,
    { kind: 'timetable_change' }
  >,
) {
  return sameChangeSource(left.source, right.source) &&
    targetScopesEqual(left.targetScope, right.targetScope) &&
    left.changeDate === right.changeDate &&
    left.periodNumber === right.periodNumber &&
    left.changedByStudentAccountId === right.changedByStudentAccountId
}

function sameChangeSource(
  left: ChangeSource,
  right: ChangeSource,
) {
  return left.type === right.type && sourceId(left) === sourceId(right)
}

function sameTaskLessonName(
  left: MaterializedTaskLessonName | null,
  right: MaterializedTaskLessonName | null,
) {
  if (left === null || right === null) return left === right
  if (left.registeredLessonNameId || right.registeredLessonNameId) {
    return left.registeredLessonNameId === right.registeredLessonNameId
  }
  return left.lessonName === right.lessonName
}

function sameExpectedLatestChangeId(
  left:
    | { changeKind: 'add' }
    | {
        changeKind: 'update' | 'remove'
        expectedLatestChangeId: string
      },
  right:
    | { changeKind: 'add' }
    | {
        changeKind: 'update' | 'remove'
        expectedLatestChangeId: string
      },
) {
  if (left.changeKind === 'add') return right.changeKind === 'add'
  if (right.changeKind === 'add') return false
  return left.expectedLatestChangeId === right.expectedLatestChangeId
}
