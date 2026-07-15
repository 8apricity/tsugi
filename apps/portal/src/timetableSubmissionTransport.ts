import { isTargetScopeType } from '../shared/targetScope'
import type {
  SubmitDirectTimetableChanges,
  TimetableLayerKey,
} from './timetableEditorClient'

export function createDirectTimetableChangeTransport({
  fetcher = globalThis.fetch,
}: { fetcher?: typeof fetch } = {}): SubmitDirectTimetableChanges {
  return async (payload) => {
    const response = await fetcher('/api/timetable-changes/direct', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (response.ok) return { status: 'applied' }

    const body = await response.json().catch(() => null) as
      | {
          status?: unknown
          conflictingKeys?: unknown
          conflictingSourceIds?: unknown
          schoolYear?: unknown
        }
      | null
    if (
      body?.status === 'timetable-change-conflict' ||
      body?.status === 'idempotency-conflict'
    ) {
      return {
        status: body.status === 'idempotency-conflict'
          ? 'idempotency-conflict'
          : 'remote-conflict',
        conflictingKeys: readTimetableLayerKeys(body.conflictingKeys),
        conflictingSourceIds: readStringArray(body.conflictingSourceIds),
      }
    }
    if (
      body?.status === 'affiliation-renewal-needed' &&
      typeof body.schoolYear === 'number' &&
      Number.isInteger(body.schoolYear)
    ) {
      return {
        status: body.status,
        schoolYear: body.schoolYear,
      }
    }
    return { status: 'rejected' }
  }
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function readTimetableLayerKeys(value: unknown): TimetableLayerKey[] {
  return Array.isArray(value) ? value.filter(isTimetableLayerKey) : []
}

function isTimetableLayerKey(value: unknown): value is TimetableLayerKey {
  if (!value || typeof value !== 'object') return false
  const key = value as Record<string, unknown>
  return isTargetScopeType(key.targetScopeType) &&
    typeof key.changeDate === 'string' &&
    Number.isInteger(key.periodNumber)
}
