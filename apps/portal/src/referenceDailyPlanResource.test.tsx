// @vitest-environment jsdom

import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReferenceDailyPlanContent } from '../shared/referenceDailyPlan'
import {
  useReferenceDailyPlanResource,
  type ReferenceDailyPlanResourceResult,
} from './referenceDailyPlanResource'

function ResourceProbe({
  children,
  selection = {
    schoolDate: '2026-07-27',
    referenceScope: {
      type: 'class',
      value: 'class-2-4',
      label: '2年4組',
    },
  },
}: {
  children(result: ReferenceDailyPlanResourceResult): ReactNode
  selection?: Parameters<typeof useReferenceDailyPlanResource>[0]
}) {
  return children(useReferenceDailyPlanResource(selection))
}

describe('Reference Daily Plan resource', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the selected School Date and exact Reference Scope', async () => {
    const dailyPlan: ReferenceDailyPlanContent = {
      schoolDate: '2026-07-27',
      tasks: [],
      periods: [],
      notes: [],
    }
    let resolveRequest: ((response: Response) => void) | undefined
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolveRequest = resolve
    }))
    vi.stubGlobal('fetch', fetchMock)
    const observed: ReferenceDailyPlanResourceResult[] = []
    const container = document.createElement('div')
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <ResourceProbe>
            {(result) => {
              observed.push(result)
              return null
            }}
          </ResourceProbe>,
        )
      })

      expect(observed.at(-1)?.state).toEqual({ status: 'loading' })
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/daily-plans/reference?date=2026-07-27&scope=class&value=class-2-4',
        { signal: expect.any(AbortSignal) },
      )

      await act(async () => {
        resolveRequest?.({
          ok: true,
          json: async () => ({
            status: 'ready',
            referenceScope: { type: 'class', value: 'class-2-4' },
            ...dailyPlan,
          }),
        } as Response)
        await Promise.resolve()
      })

      expect(observed.at(-1)?.state).toEqual({
        status: 'ready',
        value: dailyPlan,
      })
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })

  it('retries the same selection after an error', async () => {
    const dailyPlan: ReferenceDailyPlanContent = {
      schoolDate: '2026-07-27',
      tasks: [],
      periods: [],
      notes: [],
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'ready',
          referenceScope: { type: 'class', value: 'class-2-4' },
          ...dailyPlan,
        }),
      } as Response)
    vi.stubGlobal('fetch', fetchMock)
    const observed: ReferenceDailyPlanResourceResult[] = []
    const container = document.createElement('div')
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <ResourceProbe>
            {(result) => {
              observed.push(result)
              return null
            }}
          </ResourceProbe>,
        )
        await Promise.resolve()
      })
      expect(observed.at(-1)?.state).toEqual({ status: 'error' })

      await act(async () => {
        observed.at(-1)?.retry()
        await Promise.resolve()
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(observed.at(-1)?.state).toEqual({
        status: 'ready',
        value: dailyPlan,
      })
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })

  it('reloads the same selection after leaving Reference mode', async () => {
    const dailyPlan: ReferenceDailyPlanContent = {
      schoolDate: '2026-07-27',
      tasks: [],
      periods: [],
      notes: [],
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ready',
        referenceScope: { type: 'class', value: 'class-2-4' },
        ...dailyPlan,
      }),
    } as Response)
    vi.stubGlobal('fetch', fetchMock)
    const observed: ReferenceDailyPlanResourceResult[] = []
    const container = document.createElement('div')
    const root = createRoot(container)
    const observe = (result: ReferenceDailyPlanResourceResult) => {
      observed.push(result)
      return null
    }

    try {
      await act(async () => {
        root.render(<ResourceProbe>{observe}</ResourceProbe>)
        await Promise.resolve()
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await act(async () => {
        root.render(
          <ResourceProbe selection={null}>{observe}</ResourceProbe>,
        )
        await Promise.resolve()
      })
      expect(observed.at(-1)?.state).toEqual({ status: 'idle' })

      await act(async () => {
        root.render(<ResourceProbe>{observe}</ResourceProbe>)
        await Promise.resolve()
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(observed.at(-1)?.state).toEqual({
        status: 'ready',
        value: dailyPlan,
      })
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })

  it('does not reuse an old ready value when returning to an identity', async () => {
    const requests: Array<(response: Response) => void> = []
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => {
      requests.push(resolve)
    })))
    const observed: ReferenceDailyPlanResourceResult[] = []
    const container = document.createElement('div')
    const root = createRoot(container)
    const observe = (result: ReferenceDailyPlanResourceResult) => {
      observed.push(result)
      return null
    }
    const selectionA = {
      schoolDate: '2026-07-27',
      referenceScope: {
        type: 'class' as const,
        value: 'class-2-4',
        label: '2年4組',
      },
    }
    const selectionB = {
      schoolDate: '2026-07-28',
      referenceScope: selectionA.referenceScope,
    }
    const responseFor = (schoolDate: string) => ({
      ok: true,
      json: async () => ({
        status: 'ready',
        referenceScope: { type: 'class', value: 'class-2-4' },
        schoolDate,
        tasks: [],
        periods: [],
        notes: [],
      }),
    } as Response)

    try {
      await act(async () => {
        root.render(
          <ResourceProbe selection={selectionA}>{observe}</ResourceProbe>,
        )
      })
      await act(async () => {
        requests[0]?.(responseFor(selectionA.schoolDate))
        await Promise.resolve()
      })
      expect(observed.at(-1)?.state.status).toBe('ready')

      await act(async () => {
        root.render(
          <ResourceProbe selection={selectionB}>{observe}</ResourceProbe>,
        )
      })
      expect(observed.at(-1)?.state).toEqual({ status: 'loading' })

      await act(async () => {
        root.render(
          <ResourceProbe selection={selectionA}>{observe}</ResourceProbe>,
        )
      })
      expect(observed.at(-1)?.state).toEqual({ status: 'loading' })
      expect(requests).toHaveLength(3)
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })
})
