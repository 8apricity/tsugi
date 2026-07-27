import { useCallback } from 'react'
import type {
  NoteEditHistoryResponse,
} from '../shared/noteEditHistory'
import type {
  TaskEditHistoryResponse,
} from '../shared/taskEditHistory'
import {
  isTargetScopeType,
  type TargetScopeType,
} from '../shared/targetScope'
import type {
  SharedInformationChangeDetail,
  TimetableSharedInformationChangeDetail,
  TimetableHistorySnapshot,
} from '../shared/editHistory'
import {
  useAsyncResource,
  type AsyncResourceResult,
} from './asyncResource'
import { isRecord } from './resourceResponse'

type RouteResourceSelection = {
  routeInstanceId: string
}

export type TimetableChangeHistoryEntry = {
  sharedInformationChangeId: string
  sharedInformationItemId: string
  changeKind: 'add' | 'update' | 'remove'
  sourceType: 'direct' | 'proposal'
  primaryActorDisplayName: string
  changedAt: number
  before: TimetableHistorySnapshot | null
  after: TimetableHistorySnapshot | null
}

export type TimetableChangeHistoryResponse = {
  status: 'ready'
  targetScope: { type: TargetScopeType; value: string }
  changeDate: string
  periodNumber: number
  entries: TimetableChangeHistoryEntry[]
}

export type TaskEditHistoryResourceResult =
  AsyncResourceResult<TaskEditHistoryResponse>
export type NoteEditHistoryResourceResult =
  AsyncResourceResult<NoteEditHistoryResponse>
export type TimetableEditHistoryResourceResult =
  AsyncResourceResult<TimetableChangeHistoryResponse>
export type SharedInformationChangeDetailResourceResult =
  AsyncResourceResult<SharedInformationChangeDetail>

export type {
  SharedInformationChangeDetail,
  TimetableSharedInformationChangeDetail,
}

export function useTaskEditHistoryResource(
  selection: (RouteResourceSelection & { taskId: string }) | null,
): TaskEditHistoryResourceResult {
  return useEntityEditHistoryResource(
    selection
      ? {
          routeInstanceId: selection.routeInstanceId,
          entityId: selection.taskId,
        }
      : null,
    'task',
  )
}

export function useNoteEditHistoryResource(
  selection: (RouteResourceSelection & { noteId: string }) | null,
): NoteEditHistoryResourceResult {
  return useEntityEditHistoryResource(
    selection
      ? {
          routeInstanceId: selection.routeInstanceId,
          entityId: selection.noteId,
        }
      : null,
    'note',
  )
}

type EntityEditHistoryKind = 'task' | 'note'

type EntityEditHistoryResponseByKind = {
  task: TaskEditHistoryResponse
  note: NoteEditHistoryResponse
}

const entityEditHistoryResponseIdKey = {
  task: 'taskId',
  note: 'noteId',
} as const satisfies Record<EntityEditHistoryKind, 'taskId' | 'noteId'>

function useEntityEditHistoryResource<K extends EntityEditHistoryKind>(
  selection: (RouteResourceSelection & { entityId: string }) | null,
  entityKind: K,
): AsyncResourceResult<EntityEditHistoryResponseByKind[K]> {
  const routeInstanceId = selection?.routeInstanceId
  const entityId = selection?.entityId
  const identityKey = routeInstanceId && entityId
    ? `${routeInstanceId}:${entityKind}:${entityId}`
    : null
  const load = useCallback(async (signal: AbortSignal) => {
    if (!entityId) throw new Error('Edit History selection is missing')
    const response = await fetch(
      `/api/${entityKind}s/${encodeURIComponent(entityId)}/history`,
      { signal },
    )
    if (!response.ok) throw new Error('Edit History unavailable')
    const value = await response.json() as unknown
    const responseIdKey = entityEditHistoryResponseIdKey[entityKind]
    if (
      !isRecord(value) ||
      value.status !== 'ready' ||
      value[responseIdKey] !== entityId ||
      !Array.isArray(value.entries)
    ) {
      throw new Error('Edit History response did not match selection')
    }
    return value as EntityEditHistoryResponseByKind[K]
  }, [entityId, entityKind])
  return useAsyncResource({ identityKey, load })
}

export function useTimetableEditHistoryResource(
  selection: (RouteResourceSelection & {
    targetScopeType: TargetScopeType
    changeDate: string
    periodNumber: number
  }) | null,
): TimetableEditHistoryResourceResult {
  const routeInstanceId = selection?.routeInstanceId
  const targetScopeType = selection?.targetScopeType
  const changeDate = selection?.changeDate
  const periodNumber = selection?.periodNumber
  const identityKey =
    routeInstanceId && targetScopeType && changeDate && periodNumber !== undefined
      ? `${routeInstanceId}:${targetScopeType}:${changeDate}:${periodNumber}`
      : null
  const load = useCallback(async (signal: AbortSignal) => {
    if (!targetScopeType || !changeDate || periodNumber === undefined) {
      throw new Error('Timetable Edit History selection is missing')
    }
    const query = new URLSearchParams({
      scope: targetScopeType,
      date: changeDate,
      period: String(periodNumber),
    })
    const response = await fetch(
      `/api/timetable-changes/history?${query}`,
      { signal },
    )
    if (!response.ok) throw new Error('Timetable Edit History unavailable')
    const value = await response.json() as unknown
    if (
      !isRecord(value) ||
      value.status !== 'ready' ||
      value.changeDate !== changeDate ||
      value.periodNumber !== periodNumber ||
      !isRecord(value.targetScope) ||
      value.targetScope.type !== targetScopeType ||
      !Array.isArray(value.entries)
    ) {
      throw new Error('Timetable Edit History response did not match selection')
    }
    return value as TimetableChangeHistoryResponse
  }, [changeDate, periodNumber, targetScopeType])
  return useAsyncResource({ identityKey, load })
}

export function useSharedInformationChangeDetailResource(
  selection: (RouteResourceSelection & {
    sharedInformationChangeId: string
  }) | null,
): SharedInformationChangeDetailResourceResult {
  const routeInstanceId = selection?.routeInstanceId
  const sharedInformationChangeId = selection?.sharedInformationChangeId
  const identityKey = routeInstanceId && sharedInformationChangeId
    ? `${routeInstanceId}:${sharedInformationChangeId}`
    : null
  const load = useCallback(async (signal: AbortSignal) => {
    if (!sharedInformationChangeId) {
      throw new Error('Shared Information Change Detail selection is missing')
    }
    const response = await fetch(
      `/api/shared-information-changes/${
        encodeURIComponent(sharedInformationChangeId)
      }`,
      { signal },
    )
    if (!response.ok) {
      throw new Error('Shared Information Change Detail unavailable')
    }
    const value = await response.json() as unknown
    if (!isSharedInformationChangeDetail(value, sharedInformationChangeId)) {
      throw new Error(
        'Shared Information Change Detail response did not match selection',
      )
    }
    return value as SharedInformationChangeDetail
  }, [sharedInformationChangeId])
  return useAsyncResource({ identityKey, load })
}

function isSharedInformationChangeDetail(
  value: unknown,
  expectedChangeId: string,
): value is SharedInformationChangeDetail {
  if (
    !isRecord(value) ||
    value.status !== 'ready' ||
    value.sharedInformationChangeId !== expectedChangeId ||
    typeof value.sharedInformationItemId !== 'string' ||
    !['add', 'update', 'remove'].includes(String(value.changeKind)) ||
    typeof value.changedAt !== 'number' ||
    !isTargetScope(value.targetScope) ||
    !isChangeSource(value.source) ||
    !isNullableRecord(value.before) ||
    !isNullableRecord(value.after)
  ) return false

  if (value.kind === 'timetable_change') {
    return typeof value.changeDate === 'string' &&
      Number.isInteger(value.periodNumber) &&
      isTimetableSnapshot(value.before) &&
      isTimetableSnapshot(value.after)
  }
  if (value.kind === 'task') {
    return isTaskSnapshot(value.before) && isTaskSnapshot(value.after)
  }
  if (value.kind === 'note') {
    return isNoteSnapshot(value.before) &&
      isNoteSnapshot(value.after) &&
      (
        value.removalReason === undefined ||
        value.removalReason === 'student' ||
        value.removalReason === 'task_cascade'
      )
  }
  return false
}

function isTargetScope(value: unknown) {
  return isRecord(value) &&
    isTargetScopeType(value.type) &&
    typeof value.value === 'string'
}

function isChangeSource(value: unknown) {
  return isRecord(value) && (
    value.type === 'proposal' ||
    (
      value.type === 'direct' &&
      typeof value.primaryActorDisplayName === 'string'
    )
  )
}

function isNullableRecord(value: unknown) {
  return value === null || isRecord(value)
}

function isTaskSnapshot(value: unknown) {
  return value === null || (
    isRecord(value) &&
    typeof value.title === 'string' &&
    (value.dueDate === null || typeof value.dueDate === 'string') &&
    (
      value.relatedLessonName === null ||
      typeof value.relatedLessonName === 'string'
    )
  )
}

function isNoteSnapshot(value: unknown) {
  return value === null ||
    (isRecord(value) && typeof value.body === 'string')
}

function isTimetableSnapshot(value: unknown) {
  if (value === null) return true
  if (!isRecord(value)) return false
  if (value.type === 'cancelled') return true
  if (value.type === 'lesson_name') {
    return typeof value.lessonName === 'string'
  }
  if (value.type === 'period_reference') {
    return Number.isInteger(value.weekday) &&
      Number.isInteger(value.periodNumber)
  }
  return value.type === 'floating_lesson_reference' &&
    typeof value.floatingLessonReferenceLabelId === 'string' &&
    typeof value.referenceLabel === 'string'
}
