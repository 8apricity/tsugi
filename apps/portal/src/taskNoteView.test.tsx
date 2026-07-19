import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TaskRemovalConfirmationDialog, TaskNoteList } from './taskNoteView'

describe('Task Note view', () => {
  it('renders bodies directly without scope badges and keeps draft conflict state', () => {
    const html = renderToStaticMarkup(<TaskNoteList notes={[
      { noteId: 'new', body: '新しいノート' },
      {
        noteId: 'draft', body: '下書きノート', draft: true,
        changeKind: 'add', conflicted: true,
      },
    ]} />)

    expect(html.indexOf('新しいノート')).toBeLessThan(html.indexOf('下書きノート'))
    expect(html).toContain('note-body-clamped')
    expect(html).toContain('追加予定・要確認')
    expect(html).not.toContain('task-scope-badge')
  })

  it('renders Task removal as an in-app cascade confirmation', () => {
    const longFirstLine = 'あ'.repeat(81)
    const html = renderToStaticMarkup(
      <TaskRemovalConfirmationDialog
        taskTitle="数学ワーク"
        notes={[
          { body: `${longFirstLine}\n二行目` },
          { body: '短いノート\n続き' },
        ]}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    )

    expect(html).toContain('タスクを削除予定にしますか？')
    expect(html).toContain('関連するノート2件も削除予定になります。')
    expect(html).toContain('あ'.repeat(80))
    expect(html).toContain('短いノート')
    expect(html).toContain('キャンセル')
    expect(html).toContain('削除予定にする')
  })

  it('shows Task cascade Notes as removal projections without Note actions', () => {
    const html = renderToStaticMarkup(<TaskNoteList notes={[
      {
        noteId: 'cascade-note',
        body: '関連ノート',
        draft: true,
        changeKind: 'remove',
        removalReason: 'task-cascade',
      },
    ]} />)

    expect(html).toContain('削除予定')
    expect(html).toContain('タスクの削除に伴い削除予定')
    expect(html).toContain('note-cascade-removal sr-only')
    expect(html).not.toContain('ノートの削除を取り消す')
    expect(html).not.toContain('削除予定にする</button>')
  })

  it('does not render a zero-note cascade confirmation', () => {
    const html = renderToStaticMarkup(
      <TaskRemovalConfirmationDialog
        taskTitle="ノートなしのタスク"
        notes={[]}
        onCancel={() => undefined}
        onConfirm={() => undefined}
      />,
    )

    expect(html).not.toContain('このタスクだけが削除予定になります。')
    expect(html).not.toContain('関連するノート')
  })

  it('restores Task Note actions when the parent removal is cancelled', () => {
    const html = renderToStaticMarkup(<TaskNoteList notes={[
      {
        noteId: 'restored-note',
        body: '関連ノート',
        onEdit: () => undefined,
        onRemove: () => undefined,
      },
    ]} />)

    expect(html).toContain('編集</button>')
    expect(html).toContain('削除予定にする</button>')
  })
})
