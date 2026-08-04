import type {
  ActiveNoteState,
  ActiveTaskState,
  ActiveTimetableChangeState,
  MaterializedSharedInformationChange,
  StudentAffiliationState,
} from './materializedChange'
import {
  sourceId,
  type StudentAffiliationAssertion,
} from './atomicProgram'
import { targetScopesEqual, targetScopeValue } from '../targetScopePolicy'
import { hasSameIdempotencySemantics } from './semanticFingerprint'

export type AtomicExecutionSnapshot = {
  existingBySource: ReadonlyMap<string, MaterializedSharedInformationChange>
  activeTimetableByItem: ReadonlyMap<string, ActiveTimetableChangeState>
  activeTaskByItem: ReadonlyMap<string, ActiveTaskState>
  activeNoteByItem: ReadonlyMap<string, ActiveNoteState>
  occupiedItemIds: ReadonlySet<string>
  occupiedTimetableSlots: ReadonlySet<string>
  invalidReferenceSourceKeys: ReadonlySet<string>
  affiliationMatches: boolean
}

export type AtomicExecutionDecision =
  | { status: 'applied' }
  | { status: 'ready'; pending: MaterializedSharedInformationChange[] }
  | { status: 'invalid-change'; sourceIds: string[] }
  | { status: 'conflict'; sourceIds: string[] }
  | { status: 'idempotency-conflict'; sourceIds: string[] }

export function evaluateAtomicExecution(
  changes: readonly MaterializedSharedInformationChange[],
  snapshot: AtomicExecutionSnapshot,
): AtomicExecutionDecision {
  const idempotencyConflicts = changes
    .filter((change) => {
      const existing = snapshot.existingBySource.get(changeSourceKey(change))
      return existing && !hasSameIdempotencySemantics(existing, change)
    })
    .map((change) => sourceId(change.source))
  if (idempotencyConflicts.length > 0) {
    return {
      status: 'idempotency-conflict',
      sourceIds: idempotencyConflicts,
    }
  }

  const pending = changes.filter(
    (change) => !snapshot.existingBySource.has(changeSourceKey(change)),
  )
  if (pending.length === 0) return { status: 'applied' }

  const invalidReferenceSourceIds = pending
    .filter((change) =>
      snapshot.invalidReferenceSourceKeys.has(changeSourceKey(change)))
    .map((change) => sourceId(change.source))
  if (invalidReferenceSourceIds.length > 0) {
    return {
      status: 'invalid-change',
      sourceIds: invalidReferenceSourceIds,
    }
  }

  const pendingTasks = pending.filter(
    (change): change is Extract<MaterializedSharedInformationChange, { kind: 'task' }> =>
      change.kind === 'task',
  )
  const pendingTaskAdds = new Map(
    pendingTasks
      .filter((change) => change.changeKind === 'add')
      .map((change) => [change.sharedInformationItemId, change]),
  )
  const pendingTaskRemovalIds = new Set(
    pendingTasks
      .filter((change) => change.changeKind === 'remove')
      .map((change) => change.sharedInformationItemId),
  )
  const invalidTaskNoteSourceIds = pending
    .filter(
      (change): change is Extract<MaterializedSharedInformationChange, { kind: 'note' }> =>
        change.kind === 'note',
    )
    .filter((change) => {
      if (change.changeKind !== 'add') {
        const activeNote = snapshot.activeNoteByItem.get(
          change.sharedInformationItemId,
        )
        return !!activeNote?.relatedTaskItemId &&
          pendingTaskRemovalIds.has(activeNote.relatedTaskItemId)
      }
      if (!change.relatedTaskItemId) return false
      if (pendingTaskRemovalIds.has(change.relatedTaskItemId)) return true
      const task = pendingTaskAdds.get(change.relatedTaskItemId) ??
        snapshot.activeTaskByItem.get(change.relatedTaskItemId)
      return !task || !targetScopesEqual(task.targetScope, change.targetScope)
    })
    .map((change) => sourceId(change.source))
  if (invalidTaskNoteSourceIds.length > 0) {
    return {
      status: 'invalid-change',
      sourceIds: invalidTaskNoteSourceIds,
    }
  }

  if (!snapshot.affiliationMatches) {
    return {
      status: 'conflict',
      sourceIds: pending.map((change) => sourceId(change.source)),
    }
  }

  const conflicts = pending.filter((change) => {
    if (change.kind === 'timetable_change') {
      if (change.changeKind === 'add') {
        return snapshot.occupiedItemIds.has(change.sharedInformationItemId) ||
          snapshot.occupiedTimetableSlots.has(timetableChangeSlotKey(change))
      }
      const active = snapshot.activeTimetableByItem.get(
        change.sharedInformationItemId,
      )
      return !active ||
        active.latestChangeId !== change.expectedLatestChangeId ||
        timetableChangeSlotKey(active) !== timetableChangeSlotKey(change)
    }
    if (change.kind === 'task') {
      if (change.changeKind === 'add') {
        return snapshot.occupiedItemIds.has(change.sharedInformationItemId)
      }
      const active = snapshot.activeTaskByItem.get(
        change.sharedInformationItemId,
      )
      return !active ||
        active.latestChangeId !== change.expectedLatestChangeId ||
        !targetScopesEqual(active.targetScope, change.targetScope)
    }
    if (change.changeKind === 'add') {
      return snapshot.occupiedItemIds.has(change.sharedInformationItemId)
    }
    const active = snapshot.activeNoteByItem.get(
      change.sharedInformationItemId,
    )
    return !active ||
      active.latestChangeId !== change.expectedLatestChangeId ||
      !targetScopesEqual(active.targetScope, change.targetScope)
  }).map((change) => sourceId(change.source))

  return conflicts.length > 0
    ? { status: 'conflict', sourceIds: conflicts }
    : { status: 'ready', pending }
}

export function timetableChangeSlotKey(change: Pick<
  ActiveTimetableChangeState,
  'targetScope' | 'changeDate' | 'periodNumber'
>) {
  return [
    change.targetScope.schoolYear,
    change.targetScope.type,
    targetScopeValue(change.targetScope),
    change.changeDate,
    change.periodNumber,
  ].join(':')
}

export function changeSourceKey(
  change: Pick<MaterializedSharedInformationChange, 'source'>,
) {
  return `${change.source.type}:${sourceId(change.source)}`
}

export function studentAffiliationSatisfiesAssertion(
  current: StudentAffiliationState,
  expected: StudentAffiliationAssertion,
) {
  return current.studentAffiliationId === expected.studentAffiliationId &&
    current.studentAccountId === expected.studentAccountId &&
    current.schoolYear === expected.schoolYear &&
    current.grade === expected.grade &&
    current.classId === expected.classId &&
    current.trackId === expected.trackId &&
    current.selectedAt === expected.selectedAt &&
    current.endedAt === null
}
