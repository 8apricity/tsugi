import { useCallback, useEffect, useRef, useState } from 'react'

export type AsyncResourceState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; value: T }

export type AsyncResourceResult<T> = {
  state: AsyncResourceState<T>
  retry(): void
}

type StoredResourceState<T> = {
  identityKey: string | null
  state: AsyncResourceState<T>
}

export function useAsyncResource<T>({
  identityKey,
  load,
}: {
  identityKey: string | null
  load(signal: AbortSignal): Promise<T>
}): AsyncResourceResult<T> {
  const attemptRef = useRef(0)
  const [retryAttempt, setRetryAttempt] = useState(0)
  const [stored, setStored] = useState<StoredResourceState<T>>({
    identityKey: null,
    state: { status: 'idle' },
  })

  useEffect(() => {
    if (identityKey === null) {
      const attempt = ++attemptRef.current
      queueMicrotask(() => {
        if (attempt !== attemptRef.current) return
        setStored({
          identityKey: null,
          state: { status: 'idle' },
        })
      })
      return
    }

    const attempt = ++attemptRef.current
    const controller = new AbortController()
    void load(controller.signal)
      .then((value) => {
        if (controller.signal.aborted || attempt !== attemptRef.current) return
        setStored({
          identityKey,
          state: { status: 'ready', value },
        })
      })
      .catch(() => {
        if (controller.signal.aborted || attempt !== attemptRef.current) return
        setStored({
          identityKey,
          state: { status: 'error' },
        })
      })

    return () => {
      controller.abort()
    }
  }, [identityKey, load, retryAttempt])

  const retry = useCallback(() => {
    if (identityKey === null) return
    setStored({
      identityKey,
      state: { status: 'loading' },
    })
    setRetryAttempt((current) => current + 1)
  }, [identityKey])

  const state: AsyncResourceState<T> = identityKey === null
    ? { status: 'idle' }
    : stored.identityKey === identityKey
      ? stored.state
      : { status: 'loading' }

  return { state, retry }
}
