import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DraftCancellationRow } from './draftCancellationRow'

describe('Draft cancellation row', () => {
  it('exposes the canonical cancellation action without adding a menu by default', () => {
    const markup = renderToStaticMarkup(
      <DraftCancellationRow
        draftId="draft-1"
        open={false}
        anotherRowOpen={false}
        disabled
        onInteractionStart={() => undefined}
        onOpenChange={() => undefined}
        onCancel={() => undefined}
      >
        <button type="button">下書きを編集</button>
      </DraftCancellationRow>,
    )

    expect(markup).toContain('aria-label="下書きを取り消す"')
    expect(markup).not.toContain('aria-label="下書きの操作メニュー"')
    expect(markup).toContain('disabled=""')
  })

  it('adds the touch operation menu only when explicitly requested', () => {
    const markup = renderToStaticMarkup(
      <DraftCancellationRow
        draftId="draft-1"
        open={false}
        anotherRowOpen={false}
        showMenuButton
        onInteractionStart={() => undefined}
        onOpenChange={() => undefined}
        onCancel={() => undefined}
      >
        <button type="button">下書きを編集</button>
      </DraftCancellationRow>,
    )

    expect(markup).toContain('aria-label="下書きの操作メニュー"')
    expect(markup).toContain('aria-expanded="false"')
  })
})
