import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { TaskEditHistoryDialog } from './sharedInformationChangeView'
import type { TaskEditHistoryResponse } from '../shared/taskEditHistory'

describe('Task Edit History dialog', () => {
  it('renders accessible summary differences that open generic Change Detail', () => {
    vi.useFakeTimers()
    vi.setSystemTime('2026-07-10T05:00:00.000Z')
    const history: TaskEditHistoryResponse = {
      status: 'ready',
      taskId: 'task-1',
      targetScope: { type: 'track', value: 'track-1' },
      entries: [{
        sharedInformationChangeId: 'proposal-change',
        changeKind: 'update',
        sourceType: 'proposal',
        changedAt: Date.parse('2026-07-10T04:00:00.000Z'),
        before: {
          title: '地理ワークを提出',
          dueDate: '2026-07-11',
          relatedLessonName: '地理',
        },
        after: {
          title: '地理ワークを提出',
          dueDate: '2026-07-12',
          relatedLessonName: '地理',
        },
      }],
    }

    try {
      const markup = renderToStaticMarkup(
        <TaskEditHistoryDialog
          active
          taskTitle="地理ワークを提出"
          targetScopeContext={{ grade: 2, classNumber: 3, trackName: '文科' }}
          state={{ status: 'ready', value: history }}
          onBack={() => undefined}
          onClose={() => undefined}
          onRetry={() => undefined}
          onOpenChange={() => undefined}
        />,
      )

      expect(markup).toContain('aria-label="タスクの編集履歴"')
      expect(markup).toContain('変更適用範囲: 文科')
      expect(markup).toContain('data-change-id="proposal-change"')
      expect(markup).toContain('<button')
      expect(markup).toContain('提案による変更')
      expect(markup).toContain('1時間前')
      expect(markup).toContain('期限')
      expect(markup).toContain('7月11日まで')
      expect(markup).toContain('7月12日まで')
      expect(markup).not.toContain('関連する授業')
      expect(markup).not.toContain('変更なし')
    } finally {
      vi.useRealTimers()
    }
  })

  it('renders an empty state', () => {
    const markup = renderToStaticMarkup(
      <TaskEditHistoryDialog
        active
        taskTitle="地理ワークを提出"
        state={{
          status: 'ready',
          value: {
            status: 'ready',
            taskId: 'task-1',
            targetScope: { type: 'class', value: 'class-1' },
            entries: [],
          },
        }}
        onBack={() => undefined}
        onClose={() => undefined}
        onRetry={() => undefined}
        onOpenChange={() => undefined}
      />,
    )

    expect(markup).toContain('このタスクには編集履歴がありません。')
  })
})
