// @vitest-environment jsdom

import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  useTaskEditHistoryResource,
  useTimetableChangeDetailResource,
  type TaskEditHistoryResourceResult,
  type TimetableChangeDetailResourceResult,
} from './editHistoryResource'

function DetailResourceProbe({
  children,
}: {
  children(result: TimetableChangeDetailResourceResult): ReactNode
}) {
  return children(useTimetableChangeDetailResource({
    routeInstanceId: 'detail-route-1',
    sharedInformationChangeId: 'change-1',
  }))
}

function TaskHistoryResourceProbe({
  children,
}: {
  children(result: TaskEditHistoryResourceResult): ReactNode
}) {
  return children(useTaskEditHistoryResource({
    routeInstanceId: 'task-history-route-1',
    taskId: 'task-1',
  }))
}

describe('Timetable Change detail resource', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps a newer retry result when the older attempt fails late', async () => {
    const requests: Array<(response: Response) => void> = []
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      requests.push(resolve)
    }))
    vi.stubGlobal('fetch', fetchMock)
    const observed: TimetableChangeDetailResourceResult[] = []
    const container = document.createElement('div')
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <DetailResourceProbe>
            {(result) => {
              observed.push(result)
              return null
            }}
          </DetailResourceProbe>,
        )
      })
      expect(observed.at(-1)?.state).toEqual({ status: 'loading' })

      await act(async () => {
        observed.at(-1)?.retry()
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)

      const detail = {
        status: 'ready' as const,
        sharedInformationChangeId: 'change-1',
        sharedInformationItemId: 'item-1',
        changeKind: 'update' as const,
        sourceType: 'direct' as const,
        primaryActorDisplayName: 'テスト生徒',
        changedAt: 1_774_569_600_000,
        before: null,
        after: { type: 'lesson_name' as const, lessonName: '数学' },
        targetScope: { type: 'class' as const, value: 'class-2-3' },
        changeDate: '2026-07-27',
        periodNumber: 1,
      }
      await act(async () => {
        requests[1]?.({
          ok: true,
          json: async () => detail,
        } as Response)
        await Promise.resolve()
      })
      expect(observed.at(-1)?.state).toEqual({
        status: 'ready',
        value: detail,
      })

      await act(async () => {
        requests[0]?.({
          ok: false,
          json: async () => ({ status: 'unavailable' }),
        } as Response)
        await Promise.resolve()
      })
      expect(observed.at(-1)?.state).toEqual({
        status: 'ready',
        value: detail,
      })
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })
})

describe('Task Edit History resource', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects a response for a different Task', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ready',
        taskId: 'task-2',
        targetScope: { type: 'class', value: 'class-2-3' },
        entries: [],
      }),
    } as Response))
    const observed: TaskEditHistoryResourceResult[] = []
    const container = document.createElement('div')
    const root = createRoot(container)

    try {
      await act(async () => {
        root.render(
          <TaskHistoryResourceProbe>
            {(result) => {
              observed.push(result)
              return null
            }}
          </TaskHistoryResourceProbe>,
        )
        await Promise.resolve()
      })
      expect(observed.at(-1)?.state).toEqual({ status: 'error' })
    } finally {
      await act(async () => root.unmount())
      container.remove()
    }
  })
})
