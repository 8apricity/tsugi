import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NoteEditHistoryDialog } from './sharedInformationChangeView'
import { dialogHeader } from './testMarkup'

describe('Note Edit History dialog', () => {
  it('renders task-cascade summary differences as interactive rows', () => {
    const markup = renderToStaticMarkup(
      <NoteEditHistoryDialog
        active
        state={{
          status: 'ready',
          value: {
            status: 'ready',
            noteId: 'note-1',
            targetScope: { type: 'track', value: 'track-1' },
            entries: [{
              sharedInformationChangeId: 'change-2',
              changeKind: 'remove',
              sourceType: 'direct',
              primaryActorDisplayName: 'Sora',
              changedAt: Date.parse('2026-07-09T01:02:03.000Z'),
              before: {
                body: '1行目\n2行目\n3行目\n4行目\n5行目\n6行目\n7行目',
              },
              after: null,
              removalReason: 'task_cascade',
            }],
          },
        }}
        onBack={() => undefined}
        onClose={() => undefined}
        onRetry={() => undefined}
        onOpenChange={() => undefined}
      />,
    )

    const header = dialogHeader(markup)
    expect(header).toContain('aria-label="ノートの詳細に戻る"')
    expect(header).toContain('>ノートの編集履歴</h2>')
    expect(markup).toContain('data-change-id="change-2"')
    expect(markup).toContain('関連タスクの削除に伴う削除')
    expect(markup).toContain('ほか1行の変更')
    expect(markup).not.toContain(
      '関連するタスクが削除されたため、このノートも削除されました。',
    )
  })
})
