import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  TaskEditHistoryDialog,
} from './taskEditHistoryView'
import type { TaskEditHistoryResponse } from '../shared/taskEditHistory'

describe('Task Edit History dialog', () => {
  it('renders an accessible causal comparison for add, update, and remove changes', () => {
    const history: TaskEditHistoryResponse = {
      status: 'ready',
      taskId: 'task-1',
      targetScope: { type: 'track', value: 'track-1' },
      entries: [
        {
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
        },
        {
          sharedInformationChangeId: 'remove-change',
          changeKind: 'remove',
          sourceType: 'direct',
          primaryActorDisplayName: 'Sora',
          changedAt: Date.parse('2026-07-10T03:00:00.000Z'),
          before: {
            title: '地理ワークを提出',
            dueDate: '2026-07-11',
            relatedLessonName: '地理',
          },
          after: null,
        },
        {
          sharedInformationChangeId: 'update-change',
          changeKind: 'update',
          sourceType: 'direct',
          primaryActorDisplayName: 'Haru',
          changedAt: Date.parse('2026-07-10T02:00:00.000Z'),
          before: {
            title: '地理の準備',
            dueDate: null,
            relatedLessonName: null,
          },
          after: {
            title: '地理ワークを提出',
            dueDate: '2026-07-11',
            relatedLessonName: '地理',
          },
        },
        {
          sharedInformationChangeId: 'add-change',
          changeKind: 'add',
          sourceType: 'direct',
          primaryActorDisplayName: 'Sora',
          changedAt: Date.parse('2026-07-10T01:00:00.000Z'),
          before: null,
          after: {
            title: '地理の準備',
            dueDate: null,
            relatedLessonName: null,
          },
        },
      ],
    }

    const markup = renderToStaticMarkup(
      <TaskEditHistoryDialog
        taskTitle="地理ワークを提出"
        state={history}
        onClose={() => undefined}
        onRetry={() => undefined}
      />,
    )

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('aria-labelledby="task-history-title"')
    expect(markup).toContain('aria-label="閉じる"')
    expect(markup.toLowerCase()).toContain('autofocus')
    expect(markup).toContain('aria-label="Task Edit History entries"')
    expect(markup).toContain('Task Edit History')
    expect(markup).toContain('Direct Change・Display Name')
    expect(markup).toContain('Change Proposal')
    expect(markup).toContain('Sora')
    expect(markup).toContain('Haru')
    expect(markup).toContain('追加前')
    expect(markup).toContain('値なし')
    expect(markup).toContain('追加後')
    expect(markup).toContain('変更前')
    expect(markup).toContain('変更後')
    expect(markup).toContain('削除前')
    expect(markup).toContain('削除')
    expect(markup).toContain('Title')
    expect(markup).toContain('Due Date')
    expect(markup).toContain('Related Lesson Name')
    expect(markup).toContain('地理ワークを提出')
    expect(markup).toContain('2026-07-11')
    expect(markup).toContain('地理')
  })
})
