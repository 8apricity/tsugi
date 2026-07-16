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
        targetScopeContext={{ grade: 2, classNumber: 3, trackName: '文科' }}
        referenceSchoolDate="2026-07-10"
        state={history}
        onBack={() => undefined}
        onClose={() => undefined}
        onRetry={() => undefined}
      />,
    )

    expect(markup).toContain('role="dialog"')
    expect(markup).toContain('aria-modal="true"')
    expect(markup).toContain('aria-labelledby="task-history-title"')
    expect(markup).toContain('aria-label="タスクの詳細に戻る"')
    expect(markup).toContain('‹')
    expect(markup).toContain('aria-label="閉じる"')
    expect(markup.toLowerCase()).toContain('autofocus')
    expect(markup).toContain('aria-label="タスクの編集履歴"')
    expect(markup).toContain('タスクの編集履歴')
    expect(markup).toContain('変更適用範囲: 文科')
    expect(markup).not.toContain('track-1')
    expect(markup).toContain('強制変更・変更者')
    expect(markup).toContain('提案による変更')
    expect(markup).toContain('Sora')
    expect(markup).toContain('Haru')
    expect(markup).toContain('追加前')
    expect(markup).toContain('なし')
    expect(markup).toContain('追加後')
    expect(markup).toContain('変更前')
    expect(markup).toContain('変更後')
    expect(markup).toContain('削除前')
    expect(markup).toContain('削除')
    expect(markup).toContain('タイトル')
    expect(markup).toContain('期限')
    expect(markup).toContain('関連する授業')
    expect(markup).toContain('地理ワークを提出')
    expect(markup).toContain('7月11日まで')
    expect(markup).toContain('地理')
  })
})
