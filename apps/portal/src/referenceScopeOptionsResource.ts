import { useCallback, useState } from 'react'
import type {
  ReferenceScopeOption,
  ReferenceScopeOptions,
} from '../shared/referenceDailyPlan'
import {
  useAsyncResource,
  type AsyncResourceResult,
} from './asyncResource'

export type ReferenceScopeOptionsResourceResult =
  AsyncResourceResult<ReferenceScopeOptions>

export function useReferenceScopeOptionsResource({
  studentAccountSessionKey,
  requested,
}: {
  studentAccountSessionKey: string | null
  requested: boolean
}): ReferenceScopeOptionsResourceResult {
  const [ownership, setOwnership] = useState({
    sessionKey: studentAccountSessionKey,
    loadRequested: requested && studentAccountSessionKey !== null,
  })
  if (ownership.sessionKey !== studentAccountSessionKey) {
    setOwnership({
      sessionKey: studentAccountSessionKey,
      loadRequested: requested && studentAccountSessionKey !== null,
    })
  } else if (requested && !ownership.loadRequested) {
    setOwnership({
      sessionKey: studentAccountSessionKey,
      loadRequested: true,
    })
  }
  const identityKey =
    ownership.loadRequested && ownership.sessionKey !== null
      ? ownership.sessionKey
      : null
  const load = useCallback(async (signal: AbortSignal) => {
    const response = await fetch('/api/daily-plans/reference/options', {
      signal,
    })
    if (!response.ok) {
      throw new Error('Reference Scope options unavailable')
    }
    const value = await response.json() as unknown
    if (!isReferenceScopeOptions(value)) {
      throw new Error('Invalid Reference Scope options response')
    }
    return value
  }, [])
  return useAsyncResource({ identityKey, load })
}

function isReferenceScopeOptions(
  value: unknown,
): value is ReferenceScopeOptions {
  return (
    isRecord(value) &&
    value.status === 'ready' &&
    Array.isArray(value.options) &&
    value.options.every(isReferenceScopeOption)
  )
}

function isReferenceScopeOption(
  value: unknown,
): value is ReferenceScopeOption {
  return (
    isRecord(value) &&
    (value.type === 'grade' ||
      value.type === 'class' ||
      value.type === 'track') &&
    typeof value.value === 'string' &&
    typeof value.label === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
