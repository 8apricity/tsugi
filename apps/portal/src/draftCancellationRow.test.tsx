import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DraftCancellationRow } from './draftCancellationRow'

describe('Draft cancellation row', () => {
  it('exposes the canonical cancellation action and disables it while submitting', () => {
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
    expect(markup).toContain('aria-label="下書きの操作メニュー"')
    expect(markup).toContain('aria-expanded="false"')
    expect(markup).toContain('disabled=""')
  })
})
