import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NoteEditHistoryDialog } from './noteEditHistoryView'
import { dialogHeader } from './testMarkup'

describe('Note Edit History view', () => {
  it('shows back at the left and close at the right of the header', () => {
    const markup = renderToStaticMarkup(
      <NoteEditHistoryDialog
        state={{
          status: 'ready',
          noteId: 'note-1',
          targetScope: { type: 'track', value: 'track-1' },
          entries: [{
            sharedInformationChangeId: 'change-2',
            changeKind: 'remove',
            sourceType: 'direct',
            primaryActorDisplayName: 'Sora',
            changedAt: Date.parse('2026-07-09T01:02:03.000Z'),
            before: { body: '1行目\n2行目\n3行目\n4行目\n5行目\n6行目' },
            after: null,
            removalReason: 'task_cascade',
          }],
        }}
        onBack={() => undefined}
        onClose={() => undefined}
        onRetry={() => undefined}
      />,
    )
    const header = dialogHeader(markup)
    expect(header).toContain('aria-label="ノートの詳細に戻る"')
    expect(header).toContain('<h2 id="note-history-title">ノートの編集履歴</h2>')
    expect(header).toContain('aria-label="閉じる"')
    expect(header.indexOf('aria-label="ノートの詳細に戻る"')).toBeLessThan(
      header.indexOf('<h2'),
    )
    expect(header.indexOf('<h2')).toBeLessThan(
      header.indexOf('aria-label="閉じる"'),
    )
    expect(markup).toContain('ノートの編集履歴')
    expect(markup).toContain('Sora')
    expect(markup).toContain('Task削除に伴う削除')
    expect(markup).toContain('1行目\n2行目\n3行目\n4行目\n5行目\n6行目')
    expect(markup).not.toContain('note-body-clamped')
  })
})
