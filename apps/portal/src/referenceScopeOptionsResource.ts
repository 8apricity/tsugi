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
  cacheOwnerKey,
  requested,
}: {
  cacheOwnerKey: string | null
  requested: boolean
}): ReferenceScopeOptionsResourceResult {
  const [cacheState, setCacheState] = useState<{
    ownerKey: string | null
    generation: number
    value: ReferenceScopeOptions | null
  }>({
    ownerKey: cacheOwnerKey,
    generation: 0,
    value: null,
  })
  const cacheMatchesOwner = cacheState.ownerKey === cacheOwnerKey
  if (!cacheMatchesOwner) {
    setCacheState({
      ownerKey: cacheOwnerKey,
      generation: 0,
      value: null,
    })
  }
  const cachedValue = cacheMatchesOwner ? cacheState.value : null
  const generation = cacheMatchesOwner ? cacheState.generation : 0
  const identityKey =
    requested && cacheOwnerKey !== null && cachedValue === null
      ? `${cacheOwnerKey}:${generation}`
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
  const resource = useAsyncResource({ identityKey, load })
  if (
    requested &&
    cacheOwnerKey !== null &&
    resource.state.status === 'ready' &&
    cachedValue !== resource.state.value
  ) {
    setCacheState({
      ownerKey: cacheOwnerKey,
      generation,
      value: resource.state.value,
    })
  }

  const retry = useCallback(() => {
    if (!requested || cacheOwnerKey === null) return
    setCacheState((current) => ({
      ownerKey: cacheOwnerKey,
      generation:
        current.ownerKey === cacheOwnerKey ? current.generation + 1 : 0,
      value: null,
    }))
  }, [cacheOwnerKey, requested])

  if (cacheOwnerKey === null) {
    return { state: { status: 'idle' }, retry }
  }
  if (cachedValue !== null) {
    return { state: { status: 'ready', value: cachedValue }, retry }
  }
  if (!requested) {
    return { state: { status: 'idle' }, retry }
  }
  return { state: resource.state, retry }
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
