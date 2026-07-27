import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SharedInformationDifference } from './sharedInformationDifference'

function plainText(markup: string) {
  return markup.replace(/<[^>]+>/g, '')
}

describe('Shared Information Difference', () => {
  it('shows only changed Task fields in summary mode', () => {
    const markup = renderToStaticMarkup(
      <SharedInformationDifference
        mode="summary"
        comparison={{
          kind: 'task',
          changeKind: 'update',
          before: {
            title: '地理ワークを提出',
            dueDate: '2026-07-11',
            relatedLessonName: '地理',
          },
          after: {
            title: '歴史ワーク1〜10ページを提出',
            dueDate: '2026-07-12',
            relatedLessonName: '地理',
          },
        }}
      />,
    )

    expect(markup).toContain('タイトル')
    expect(plainText(markup)).toContain('地理ワークを提出')
    expect(plainText(markup)).toContain('歴史ワーク1〜10ページを提出')
    expect(markup).toContain('期限')
    expect(markup).toContain('7月11日まで')
    expect(markup).toContain('7月12日まで')
    expect(markup).not.toContain('関連する授業')
    expect(markup).not.toContain('変更なし')
    expect(markup).toContain('diff-text-removed')
    expect(markup).toContain('diff-text-added')
  })

  it('shows unchanged Task fields once in complete mode', () => {
    const markup = renderToStaticMarkup(
      <SharedInformationDifference
        mode="complete"
        comparison={{
          kind: 'task',
          changeKind: 'update',
          before: {
            title: '地理ワークを提出',
            dueDate: '2026-07-11',
            relatedLessonName: '地理',
          },
          after: {
            title: '歴史ワーク1〜10ページを提出',
            dueDate: '2026-07-12',
            relatedLessonName: '地理',
          },
        }}
      />,
    )

    expect(markup).toContain('関連する授業')
    expect(markup.match(/<p>地理<\/p>/g)).toHaveLength(1)
    expect(markup).toContain('変更なし')
    expect(markup).not.toContain('変更あり')
  })

  it('renders a Note as a unified line and character difference', () => {
    const markup = renderToStaticMarkup(
      <SharedInformationDifference
        mode="complete"
        comparison={{
          kind: 'note',
          changeKind: 'update',
          before: { body: '提出先は職員室です。\n締切は7月11日です。\n忘れずに提出してください。' },
          after: { body: '提出先は職員室です。\n締切は7月12日です。\n忘れずに提出してください。' },
        }}
      />,
    )

    expect(markup).toContain('提出先は職員室です。')
    expect(markup).toContain('忘れずに提出してください。')
    expect(markup).toContain(
      '<span class="visually-hidden">削除された行: </span>',
    )
    expect(markup).toContain(
      '<span class="visually-hidden">追加された行: </span>',
    )
    expect(markup).not.toContain('aria-label="削除された行"')
    expect(markup).toContain('diff-text-removed')
    expect(markup).toContain('diff-text-added')
  })

  it('limits a Note summary to six changed lines', () => {
    const before = Array.from(
      { length: 8 },
      (_, index) => `変更前${index + 1}`,
    ).join('\n')
    const after = Array.from(
      { length: 8 },
      (_, index) => `変更後${index + 1}`,
    ).join('\n')
    const markup = renderToStaticMarkup(
      <SharedInformationDifference
        mode="summary"
        comparison={{
          kind: 'note',
          changeKind: 'update',
          before: { body: before },
          after: { body: after },
        }}
      />,
    )

    expect(markup.match(/class="note-diff-line /g)).toHaveLength(6)
    expect(markup).toContain('ほか10行の変更')
    expect(markup).toContain('変更の詳細を見る')
    expect(plainText(markup)).toContain('変更前1')
    expect(plainText(markup)).toContain('変更後1')
    expect(plainText(markup)).toContain('変更前3')
    expect(plainText(markup)).toContain('変更後3')
    expect(plainText(markup)).not.toContain('変更前4')
  })

  it('treats Timetable replacements as atomic values', () => {
    const markup = renderToStaticMarkup(
      <SharedInformationDifference
        mode="complete"
        comparison={{
          kind: 'timetable_change',
          changeKind: 'update',
          before: {
            type: 'period_reference',
            weekday: 1,
            periodNumber: 1,
          },
          after: { type: 'lesson_name', lessonName: '英語' },
        }}
      />,
    )

    expect(markup).toContain('変更前')
    expect(markup).toContain('月1')
    expect(markup).toContain('保存時の時間割参照')
    expect(markup).toContain('変更後')
    expect(markup).toContain('英語')
    expect(markup).not.toContain('diff-text-added')
  })

  it('shows the compact and complete task-cascade removal copy', () => {
    const comparison = {
      kind: 'note' as const,
      changeKind: 'remove' as const,
      before: { body: '提出先は職員室です。' },
      after: null,
      removalReason: 'task_cascade' as const,
    }

    const summary = renderToStaticMarkup(
      <SharedInformationDifference mode="summary" comparison={comparison} />,
    )
    const complete = renderToStaticMarkup(
      <SharedInformationDifference mode="complete" comparison={comparison} />,
    )

    expect(summary).toContain('関連タスクの削除に伴う削除')
    expect(summary).not.toContain(
      '関連するタスクが削除されたため、このノートも削除されました。',
    )
    expect(complete).toContain(
      '関連するタスクが削除されたため、このノートも削除されました。',
    )
  })
})
