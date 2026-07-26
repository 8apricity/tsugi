import { useCallback, useState } from 'react'
import type {
  ReferenceScopeOption,
  ReferenceScopeOptions,
} from '../shared/referenceDailyPlan'
import {
  useAsyncResource,
  type AsyncResourceResult,
} from './asyncResource'
import { isRecord } from './resourceResponse'

export type ReferenceScopeOptionsResourceResult =
  AsyncResourceResult<ReferenceScopeOptions>

export function useReferenceScopeOptionsResource({
  cacheOwnerKey,
  requested,
}: {
  cacheOwnerKey: string | null
  requested: boolean
}): ReferenceScopeOptionsResourceResult {
  const [cacheRequest, setCacheRequest] = useState<{
    ownerKey: string | null
    loadRequested: boolean
  }>({
    ownerKey: cacheOwnerKey,
    loadRequested: requested && cacheOwnerKey !== null,
  })
  if (cacheRequest.ownerKey !== cacheOwnerKey) {
    setCacheRequest({
      ownerKey: cacheOwnerKey,
      loadRequested: requested && cacheOwnerKey !== null,
    })
  } else if (requested && !cacheRequest.loadRequested) {
    setCacheRequest({
      ownerKey: cacheOwnerKey,
      loadRequested: true,
    })
  }
  const identityKey =
    cacheRequest.loadRequested && cacheRequest.ownerKey !== null
      ? cacheRequest.ownerKey
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
