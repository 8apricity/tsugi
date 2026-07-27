import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  SharedInformationChangeDetailDialog,
  TimetableEditHistoryDialog,
} from './sharedInformationChangeView'

describe('Timetable Edit History dialog', () => {
  it('renders an atomic difference in an interactive summary row', () => {
    const markup = renderToStaticMarkup(
      <TimetableEditHistoryDialog
        active
        state={{
          status: 'ready',
          value: {
            status: 'ready',
            targetScope: { type: 'class', value: 'class-1' },
            changeDate: '2026-07-27',
            periodNumber: 2,
            entries: [{
              sharedInformationChangeId: 'change-1',
              sharedInformationItemId: 'item-1',
              changeKind: 'update',
              sourceType: 'direct',
              primaryActorDisplayName: 'Sora',
              changedAt: Date.parse('2026-07-27T01:00:00.000Z'),
              before: {
                type: 'period_reference',
                weekday: 1,
                periodNumber: 1,
              },
              after: { type: 'lesson_name', lessonName: '英語' },
            }],
          },
        }}
        subtitle="7月27日・2限・3組"
        onBack={() => undefined}
        onClose={() => undefined}
        onRetry={() => undefined}
        onOpenChange={() => undefined}
      />,
    )

    expect(markup).toContain('data-change-id="change-1"')
    expect(markup).toContain('月1')
    expect(markup).toContain('英語')
    expect(markup).toContain('保存時の時間割参照')
    expect(markup).toContain('直接反映')
    expect(markup).toContain('Sora')
    const buttonContent = markup.match(
      /<button class="shared-history-row"[^>]*>(.*?)<\/button>/,
    )?.[1]
    expect(buttonContent).toContain('visually-hidden')
    expect(buttonContent).not.toMatch(/<(?:div|section|header|h3|p)\b/)
  })
})

describe('Shared Information Change Detail dialog', () => {
  it('renders common metadata and a complete Task difference', () => {
    const markup = renderToStaticMarkup(
      <SharedInformationChangeDetailDialog
        active
        targetScopeContext={{ grade: 2, classNumber: 3, trackName: '文科' }}
        state={{
          status: 'ready',
          value: {
            status: 'ready',
            kind: 'task',
            sharedInformationChangeId: 'change-1',
            sharedInformationItemId: 'task-1',
            changeKind: 'update',
            source: {
              type: 'direct',
              primaryActorDisplayName: 'Sora',
            },
            changedAt: Date.parse('2026-07-27T01:02:03.000Z'),
            targetScope: { type: 'track', value: 'track-1' },
            before: {
              title: '地理ワーク',
              dueDate: '2026-07-27',
              relatedLessonName: '地理',
            },
            after: {
              title: '地理ワーク',
              dueDate: '2026-07-28',
              relatedLessonName: '地理',
            },
          },
        }}
        onBack={() => undefined}
        onClose={() => undefined}
        onRetry={() => undefined}
      />,
    )

    expect(markup).toContain('変更の詳細')
    expect(markup).toContain('タスク')
    expect(markup).toContain('直接反映')
    expect(markup).toContain('Sora')
    expect(markup).toContain('2026/07/27 10:02:03')
    expect(markup).toContain('文科')
    expect(markup).toContain('関連する授業')
    expect(markup).toContain('変更なし')
  })

  it('renders Proposal source without inventing attribution', () => {
    const markup = renderToStaticMarkup(
      <SharedInformationChangeDetailDialog
        active
        state={{
          status: 'ready',
          value: {
            status: 'ready',
            kind: 'note',
            sharedInformationChangeId: 'change-2',
            sharedInformationItemId: 'note-1',
            changeKind: 'update',
            source: { type: 'proposal' },
            changedAt: Date.parse('2026-07-27T01:02:03.000Z'),
            targetScope: { type: 'class', value: 'class-1' },
            before: { body: '変更前' },
            after: { body: '変更後' },
          },
        }}
        onBack={() => undefined}
        onClose={() => undefined}
        onRetry={() => undefined}
      />,
    )

    expect(markup).toContain('提案による変更')
    expect(markup).not.toContain('<dt>変更者</dt>')
  })
})
