// @vitest-environment jsdom

import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  useReferenceScopeOptionsResource,
  type ReferenceScopeOptionsResourceResult,
} from './referenceScopeOptionsResource'

function ResourceProbe({
  sessionKey,
  requested,
  children,
}: {
  sessionKey: string | null
  requested: boolean
  children(result: ReferenceScopeOptionsResourceResult): ReactNode
}) {
  return children(useReferenceScopeOptionsResource({
    cacheOwnerKey: sessionKey,
    requested,
  }))
}

describe('Reference Scope options resource', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('discards a pending response when its cache owner changes', async () => {
    const requests: Array<(response: Response) => void> = []
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      requests.push(resolve)
    }))
    vi.stubGlobal('fetch', fetchMock)
    const observed: ReferenceScopeOptionsResourceResult[] = []
    const container = document.createElement('div')
    const root = createRoot(container)
    const render = async (sessionKey: string | null, requested: boolean) => {
      await act(async () => {
        root.render(
          <ResourceProbe sessionKey={sessionKey} requested={requested}>
            {(result) => {
              observed.push(result)
              return null
            }}
          </ResourceProbe>,
        )
      })
    }

    try {
      await render('student-session-a', true)
      expect(observed.at(-1)?.state).toEqual({ status: 'loading' })

      await render(null, false)
      expect(observed.at(-1)?.state).toEqual({ status: 'idle' })
      await act(async () => {
        requests[0]?.({
          ok: true,
          json: async () => ({
            status: 'ready',
            options: [{ type: 'class', value: 'class-a', label: 'A組' }],
          }),
        } as Response)
        await Promise.resolve()
      })
      expect(observed.at(-1)?.state).toEqual({ status: 'idle' })

      await render('student-session-b', true)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      await act(async () => {
        requests[1]?.({
          ok: true,
          json: async () => ({
            status: 'ready',
            options: [{ type: 'class', value: 'class-b', label: 'B組' }],
          }),
        } as Response)
        await Promise.resolve()
      })
      expect(observed.at(-1)?.state).toEqual({
        status: 'ready',
        value: {
          status: 'ready',
          options: [{ type: 'class', value: 'class-b', label: 'B組' }],
        },
      })
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })

  it('retains loaded options when the picker closes for the same owner', async () => {
    const options = {
      status: 'ready' as const,
      options: [{ type: 'class' as const, value: 'class-a', label: 'A組' }],
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => options,
    } as Response)
    vi.stubGlobal('fetch', fetchMock)
    const observed: ReferenceScopeOptionsResourceResult[] = []
    const container = document.createElement('div')
    const root = createRoot(container)
    const render = async (requested: boolean) => {
      await act(async () => {
        root.render(
          <ResourceProbe sessionKey="student-session-a" requested={requested}>
            {(result) => {
              observed.push(result)
              return null
            }}
          </ResourceProbe>,
        )
        await Promise.resolve()
      })
    }

    try {
      await render(true)
      expect(observed.at(-1)?.state).toEqual({
        status: 'ready',
        value: options,
      })

      await render(false)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(observed.at(-1)?.state).toEqual({
        status: 'ready',
        value: options,
      })
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })

  it('continues the first load when the picker closes for the same owner', async () => {
    const requests: Array<(response: Response) => void> = []
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      requests.push(resolve)
    }))
    vi.stubGlobal('fetch', fetchMock)
    const observed: ReferenceScopeOptionsResourceResult[] = []
    const container = document.createElement('div')
    const root = createRoot(container)
    const render = async (requested: boolean) => {
      await act(async () => {
        root.render(
          <ResourceProbe sessionKey="student-session-a" requested={requested}>
            {(result) => {
              observed.push(result)
              return null
            }}
          </ResourceProbe>,
        )
      })
    }

    try {
      await render(true)
      expect(observed.at(-1)?.state).toEqual({ status: 'loading' })

      await render(false)
      expect(observed.at(-1)?.state).toEqual({ status: 'loading' })
      await act(async () => {
        requests[0]?.({
          ok: true,
          json: async () => ({
            status: 'ready',
            options: [{ type: 'class', value: 'stale', label: '古い組' }],
          }),
        } as Response)
        await Promise.resolve()
      })
      expect(observed.at(-1)?.state).toEqual({
        status: 'ready',
        value: {
          status: 'ready',
          options: [{ type: 'class', value: 'stale', label: '古い組' }],
        },
      })

      await render(true)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })
})
