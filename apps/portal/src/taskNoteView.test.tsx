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
    expect(html).toContain('note-related')
    expect(html).toContain('追加予定・要確認')
    expect(html).not.toContain('task-scope-badge')
  })

  it('reuses the independent Note card in Task detail without Target Scope', () => {
    const html = renderToStaticMarkup(
      <TaskNoteList
        presentation="detail"
        notes={[{
          noteId: 'detail-note',
          body: '詳細内のノート',
          onOpen: () => undefined,
        }]}
      />,
    )

    expect(html).toContain('task-note-detail-list')
    expect(html).toContain('note-detail-target')
    expect(html).toContain('note-detail-chevron')
    expect(html).not.toContain('note-related')
    expect(html).not.toContain('task-scope-badge')
    expect(html).not.toContain('>編集</button>')
    expect(html).not.toContain('削除予定にする</button>')
    expect(html).not.toContain('編集履歴</button>')
  })

  it('makes the whole related Note target open its parent Task', () => {
    const html = renderToStaticMarkup(
      <TaskNoteList
        notes={[{ noteId: 'related-note', body: '親へ移動するノート' }]}
        onOpenRelatedNote={() => undefined}
      />,
    )

    expect(html).toContain('note-related')
    expect(html).toContain('role="button"')
    expect(html).not.toContain('note-detail-chevron')
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

  it('keeps Task cascade Notes inside the parent removal unit', () => {
    const html = renderToStaticMarkup(<TaskNoteList notes={[
      {
        noteId: 'cascade-note',
        body: '関連ノート',
        draft: true,
        changeKind: 'remove',
        removalReason: 'task-cascade',
      },
    ]} />)

    expect(html).not.toContain('note-removal-draft')
    expect(html).not.toContain('note-removal-mark')
    expect(html).not.toContain('タスクの削除に伴い削除予定')
    expect(html).not.toContain('ノートの削除を取り消す')
    expect(html).not.toContain('削除予定にする</button>')
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
