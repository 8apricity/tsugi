import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NoteDetailDialog } from './noteDetailView'
import { dialogHeader } from './testMarkup'

const details = [
  { label: '変更適用範囲', value: '3組' },
  { label: '関連先', value: '2026年7月10日' },
]

describe('Note detail view', () => {
  it('shows the title at the left and close button at the right when read-only', () => {
    const markup = renderToStaticMarkup(
      <NoteDetailDialog
        active
        body={'連絡事項\n全文'}
        details={details}
        editing={false}
        removalPlanned={false}
        onBodyChange={() => undefined}
        onRemovalPlannedChange={() => undefined}
        onClose={() => undefined}
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
    const header = dialogHeader(markup)
    expect(header).toContain('>ノートの詳細</h2>')
    expect(header).toContain('aria-label="閉じる"')
    expect(header).not.toContain('aria-label="戻る"')
    expect(header.indexOf('<h2')).toBeLessThan(
      header.indexOf('aria-label="閉じる"'),
    )
    expect(markup).toContain('編集履歴')
    expect(markup).not.toContain('<textarea')
    expect(markup).not.toContain('削除予定にする')
    expect(markup).not.toContain('disabled')
  })

  it('separates returning to a parent detail from closing the dialog stack', () => {
    const markup = renderToStaticMarkup(
      <NoteDetailDialog
        active
        body="親から開いたノート"
        details={details}
        editing={false}
        removalPlanned={false}
        onBodyChange={() => undefined}
        onRemovalPlannedChange={() => undefined}
        onBack={() => undefined}
        backLabel="タスクの詳細に戻る"
        onClose={() => undefined}
        onSave={() => undefined}
      />,
    )

    const header = dialogHeader(markup)
    expect(header).toContain('aria-label="タスクの詳細に戻る"')
    expect(header).toContain('>ノートの詳細</h2>')
    expect(header).toContain('aria-label="閉じる"')
    expect(header.indexOf('aria-label="タスクの詳細に戻る"')).toBeLessThan(
      header.indexOf('<h2'),
    )
    expect(header.indexOf('<h2')).toBeLessThan(
      header.indexOf('aria-label="閉じる"'),
    )
  })

  it('directly edits Body and disables only Body while removal is checked', () => {
    const markup = renderToStaticMarkup(
      <NoteDetailDialog
        active
        body="削除前の本文"
        details={details}
        editing
        removalPlanned
        onBodyChange={() => undefined}
        onRemovalPlannedChange={() => undefined}
        onBack={() => undefined}
        onClose={() => undefined}
        onSave={() => undefined}
        onOpenHistory={() => undefined}
        onCancelDraft={() => undefined}
        cancelDraftDisabled
      />,
    )

    const header = dialogHeader(markup)
    expect(header).toContain('aria-label="戻る"')
    expect(header).toContain('>ノートの詳細</h2>')
    expect(header).toContain('aria-label="下書きを保存"')
    expect(header).not.toContain('aria-label="閉じる"')
    expect(header.indexOf('aria-label="戻る"')).toBeLessThan(
      header.indexOf('<h2'),
    )
    expect(header.indexOf('<h2')).toBeLessThan(
      header.indexOf('aria-label="下書きを保存"'),
    )
    expect(markup).toContain('<textarea')
    expect(markup).toContain('disabled')
    expect(markup).toContain('削除予定にする')
    expect(markup).toContain('checked')
    expect(markup).toContain('aria-label="下書きを保存"')
    expect(markup).toContain('編集履歴')
    expect(markup).not.toContain('<select')
    expect(markup).toContain(
      'class="button-danger" type="button" disabled="">下書きを取り消す</button>',
    )
  })
})
