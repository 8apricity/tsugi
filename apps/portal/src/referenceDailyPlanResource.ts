import { useCallback } from 'react'
import type {
  ReferenceDailyPlanContent,
  ReferenceScopeOption,
} from '../shared/referenceDailyPlan'
import {
  useAsyncResource,
  type AsyncResourceResult,
} from './asyncResource'
import { isRecord } from './resourceResponse'

export type ReferenceDailyPlanSelection = {
  schoolDate: string
  referenceScope: ReferenceScopeOption
}

export type ReferenceDailyPlanResourceResult =
  AsyncResourceResult<ReferenceDailyPlanContent>

export function useReferenceDailyPlanResource(
  selection: ReferenceDailyPlanSelection | null,
): ReferenceDailyPlanResourceResult {
  const schoolDate = selection?.schoolDate
  const scopeType = selection?.referenceScope.type
  const scopeValue = selection?.referenceScope.value
  const identityKey = schoolDate && scopeType && scopeValue
    ? `${schoolDate}:${scopeType}:${scopeValue}`
    : null
  const load = useCallback(async (signal: AbortSignal) => {
    if (!schoolDate || !scopeType || !scopeValue) {
      throw new Error('Reference Daily Plan selection is missing')
    }
    const query = new URLSearchParams({
      date: schoolDate,
      scope: scopeType,
      value: scopeValue,
    })
    const response = await fetch(
      `/api/daily-plans/reference?${query}`,
      { signal },
    )
    if (!response.ok) {
      throw new Error('Reference Daily Plan unavailable')
    }
    const value = await response.json() as unknown
    if (!referenceDailyPlanMatchesSelection(value, {
      schoolDate,
      scopeType,
      scopeValue,
    })) {
      throw new Error('Reference Daily Plan response did not match selection')
    }
    return {
      schoolDate: value.schoolDate,
      tasks: value.tasks,
      periods: value.periods,
      notes: value.notes,
    }
  }, [schoolDate, scopeType, scopeValue])

  return useAsyncResource({ identityKey, load })
}

function referenceDailyPlanMatchesSelection(
  value: unknown,
  selection: {
    schoolDate: string
    scopeType: ReferenceScopeOption['type']
    scopeValue: string
  },
): value is ReferenceDailyPlanContent & {
  status: 'ready'
  referenceScope: { type: ReferenceScopeOption['type']; value: string }
} {
  if (!isRecord(value) || value.status !== 'ready') return false
  if (
    value.schoolDate !== selection.schoolDate ||
    !isRecord(value.referenceScope) ||
    value.referenceScope.type !== selection.scopeType ||
    value.referenceScope.value !== selection.scopeValue
  ) {
    return false
  }
  return (
    Array.isArray(value.tasks) &&
    Array.isArray(value.periods) &&
    Array.isArray(value.notes)
  )
}
