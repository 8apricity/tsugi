import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NoteDetailDialog } from './noteDetailView'

describe('Note detail flow', () => {
  it('renders a read-only Note detail with ordinary context values', () => {
    const html = renderToStaticMarkup(
      <NoteDetailDialog
        mode="view"
        body={'当日の連絡\n全文'}
        targetScopeLabel="2年全体"
        relatedContextLabel="7月10日"
        onBack={() => undefined}
        onOpenHistory={() => undefined}
      />,
    )

    expect(html).toContain('ノートの詳細')
    expect(html).toContain('当日の連絡\n全文')
    expect(html).toContain('2年全体')
    expect(html).toContain('7月10日')
    expect(html).toContain('編集履歴')
    expect(html).not.toContain('<textarea')
    expect(html).not.toContain('disabled')
  })

  it('edits the Body directly and exposes removal only for a reflected Note', () => {
    const html = renderToStaticMarkup(
      <NoteDetailDialog
        mode="edit"
        body="編集できる本文"
        targetScopeLabel="文科"
        relatedContextLabel="タスク: 提出物"
        removalPlanned
        onBack={() => undefined}
        onBodyChange={() => undefined}
        onRemovalChange={() => undefined}
        onOpenHistory={() => undefined}
        onSave={() => undefined}
      />,
    )

    expect(html).toContain('<textarea')
    expect(html).toContain('disabled')
    expect(html).toContain('削除予定にする')
    expect(html).toContain('変更適用範囲')
    expect(html).toContain('関連先')
    expect(html).toContain('編集履歴')
  })
})
