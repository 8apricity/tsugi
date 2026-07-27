import { useCallback } from 'react'
import type {
  NoteEditHistoryResponse,
} from '../shared/noteEditHistory'
import type {
  TaskEditHistoryResponse,
} from '../shared/taskEditHistory'
import type { TargetScopeType } from '../shared/targetScope'
import type {
  SharedInformationChangeDetail,
  TimetableChangeDetail,
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

export type { SharedInformationChangeDetail, TimetableChangeDetail }

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
    if (
      !isRecord(value) ||
      value.status !== 'ready' ||
      value.sharedInformationChangeId !== sharedInformationChangeId ||
      !['timetable_change', 'task', 'note'].includes(String(value.kind)) ||
      !isRecord(value.targetScope) ||
      !isRecord(value.source)
    ) {
      throw new Error(
        'Shared Information Change Detail response did not match selection',
      )
    }
    return value as SharedInformationChangeDetail
  }, [sharedInformationChangeId])
  return useAsyncResource({ identityKey, load })
}
