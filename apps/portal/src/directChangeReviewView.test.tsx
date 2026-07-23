import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  DraftExitConfirmationDialog,
  DraftLogoutConfirmationDialog,
  StaleDirectChangeRefreshAction,
} from './directChangeReviewView'

describe('Direct Change review', () => {
  it('asks before clearing drafts on logout', () => {
    const logout = renderToStaticMarkup(
      <DraftLogoutConfirmationDialog
        draftCount={3}
        onBack={() => undefined}
        onLogout={() => undefined}
      />,
    )

    expect(logout).toContain('role="alertdialog"')
    expect(logout).toContain('下書き3件はこの端末から削除され、復元できません。')
    expect(logout).toContain('戻る')
    expect(logout).toContain('ログアウト')
  })

  it('asks before deleting the whole draft workspace on explicit exit', () => {
    const html = renderToStaticMarkup(
      <DraftExitConfirmationDialog
        draftCount={4}
        onContinue={() => undefined}
        onExit={() => undefined}
      />,
    )

    expect(html).toContain('role="alertdialog"')
    expect(html).toContain('editor-dialog-backdrop')
    expect(html).toContain('destructive-confirmation-dialog')
    expect(html).toContain('下書きを削除して編集を終了しますか？')
    expect(html).toContain('保存中の下書き4件はこの端末から削除され、復元できません。')
    expect(html).toContain('編集を続ける')
    expect(html).toContain('autofocus=""')
    expect(html).toContain('下書きを削除して終了')
    expect(html).toContain('button-danger')
  })

  it('offers a reload action when an accepted batch cannot refresh its display', () => {
    const html = renderToStaticMarkup(
      <StaleDirectChangeRefreshAction onReload={() => undefined} />,
    )

    expect(html).toContain('再読み込み')
  })
})
