import { useCallback } from 'react'
import type {
  NoteEditHistoryResponse,
} from '../shared/noteEditHistory'
import type {
  TaskEditHistoryResponse,
} from '../shared/taskEditHistory'
import type { TargetScopeType } from '../shared/targetScope'
import type { TimetableReplacement } from './sharedInformationEditorClient'
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
  before: TimetableReplacement | null
  after: TimetableReplacement | null
}

export type TimetableChangeHistoryResponse = {
  status: 'ready'
  targetScope: { type: TargetScopeType; value: string }
  changeDate: string
  periodNumber: number
  entries: TimetableChangeHistoryEntry[]
}

export type DirectTimetableChangeDetail = TimetableChangeHistoryEntry & {
  status: 'ready'
  targetScope: { type: TargetScopeType; value: string }
  changeDate: string
  periodNumber: number
}

export type TaskEditHistoryResourceResult =
  AsyncResourceResult<TaskEditHistoryResponse>
export type NoteEditHistoryResourceResult =
  AsyncResourceResult<NoteEditHistoryResponse>
export type TimetableEditHistoryResourceResult =
  AsyncResourceResult<TimetableChangeHistoryResponse>
export type TimetableChangeDetailResourceResult =
  AsyncResourceResult<DirectTimetableChangeDetail>

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

export function useTimetableChangeDetailResource(
  selection: (RouteResourceSelection & {
    sharedInformationChangeId: string
  }) | null,
): TimetableChangeDetailResourceResult {
  const routeInstanceId = selection?.routeInstanceId
  const sharedInformationChangeId = selection?.sharedInformationChangeId
  const identityKey = routeInstanceId && sharedInformationChangeId
    ? `${routeInstanceId}:${sharedInformationChangeId}`
    : null
  const load = useCallback(async (signal: AbortSignal) => {
    if (!sharedInformationChangeId) {
      throw new Error('Timetable Change detail selection is missing')
    }
    const response = await fetch(
      `/api/timetable-changes/direct/${
        encodeURIComponent(sharedInformationChangeId)
      }`,
      { signal },
    )
    if (!response.ok) throw new Error('Timetable Change detail unavailable')
    const value = await response.json() as unknown
    if (
      !isRecord(value) ||
      value.status !== 'ready' ||
      value.sharedInformationChangeId !== sharedInformationChangeId ||
      !isRecord(value.targetScope) ||
      typeof value.changeDate !== 'string' ||
      typeof value.periodNumber !== 'number'
    ) {
      throw new Error('Timetable Change detail response did not match selection')
    }
    return value as DirectTimetableChangeDetail
  }, [sharedInformationChangeId])
  return useAsyncResource({ identityKey, load })
}
