import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NoteDetailDialog } from './noteDetailView'

const details = [
  { label: '変更適用範囲', value: '3組' },
  { label: '関連先', value: '2026年7月10日' },
]

describe('Note detail view', () => {
  it('uses one read-only detail flow with text context and history navigation', () => {
    const markup = renderToStaticMarkup(
      <NoteDetailDialog
        body={'連絡事項\n全文'}
        details={details}
        editing={false}
        removalPlanned={false}
        onBodyChange={() => undefined}
        onRemovalPlannedChange={() => undefined}
        onBack={() => undefined}
        onSave={() => undefined}
        onOpenHistory={() => undefined}
      />,
    )

    expect(markup).toContain('ノートの詳細')
    expect(markup).toContain('連絡事項\n全文')
    expect(markup).toContain('変更適用範囲')
    expect(markup).toContain('3組')
    expect(markup).toContain('関連先')
    expect(markup).toContain('2026年7月10日')
    expect(markup).toContain('aria-label="閉じる"')
    expect(markup).not.toContain('aria-label="戻る"')
    expect(markup.indexOf('ノートの詳細')).toBeLessThan(
      markup.indexOf('aria-label="閉じる"'),
    )
    expect(markup).toContain('編集履歴')
    expect(markup).not.toContain('<textarea')
    expect(markup).not.toContain('削除予定にする')
    expect(markup).not.toContain('disabled')
  })

  it('directly edits Body and disables only Body while removal is checked', () => {
    const markup = renderToStaticMarkup(
      <NoteDetailDialog
        body="削除前の本文"
        details={details}
        editing
        removalPlanned
        onBodyChange={() => undefined}
        onRemovalPlannedChange={() => undefined}
        onBack={() => undefined}
        onSave={() => undefined}
        onOpenHistory={() => undefined}
      />,
    )

    expect(markup).toContain('<textarea')
    expect(markup).toContain('disabled')
    expect(markup).toContain('削除予定にする')
    expect(markup).toContain('checked')
    expect(markup).toContain('aria-label="下書きを保存"')
    expect(markup).toContain('編集履歴')
    expect(markup).not.toContain('<select')
  })
})
