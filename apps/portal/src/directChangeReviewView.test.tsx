import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  DirectChangeReviewDialog,
  DraftExitConfirmationDialog,
  DraftLogoutConfirmationDialog,
  StaleDirectChangeRefreshAction,
} from './directChangeReviewView'
import { buildDirectChangeReviewSummary } from './directChangeReview'

describe('Direct Change review', () => {
  it('reviews one mixed batch with kind counts and explicit final actions', () => {
    const summary = buildDirectChangeReviewSummary({
      timetableDraftCount: 1,
      taskDraftCount: 2,
      noteDraftCount: 3,
    })
    const html = renderToStaticMarkup(
      <DirectChangeReviewDialog
        summary={summary}
        submitting={false}
        conflictCount={0}
        onBack={() => undefined}
        onApply={() => undefined}
      />,
    )

    expect(summary).toEqual({ timetable: 1, task: 2, note: 3, total: 6 })
    expect(html).toContain('最終確認')
    expect(html).toContain('<dt>時間割</dt><dd>1件</dd>')
    expect(html).toContain('<dt>タスク</dt><dd>2件</dd>')
    expect(html).toContain('<dt>ノート</dt><dd>3件</dd>')
    expect(html).toContain('戻る')
    expect(html).toContain('変更を反映')
  })

  it('blocks a conflicted batch and asks before clearing drafts on logout', () => {
    const summary = buildDirectChangeReviewSummary({
      timetableDraftCount: 1,
      taskDraftCount: 0,
      noteDraftCount: 0,
    })
    const review = renderToStaticMarkup(
      <DirectChangeReviewDialog
        summary={summary}
        submitting={false}
        conflictCount={1}
        onBack={() => undefined}
        onApply={() => undefined}
      />,
    )
    const logout = renderToStaticMarkup(
      <DraftLogoutConfirmationDialog
        draftCount={3}
        onBack={() => undefined}
        onLogout={() => undefined}
      />,
    )

    expect(review).toContain('ほかの変更と重なっている下書きがあります。')
    expect(review).toContain('disabled=""')
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
    expect(html).toContain('下書きを削除して編集を終了しますか？')
    expect(html).toContain('保存中の下書き4件はこの端末から削除され、復元できません。')
    expect(html).toContain('編集を続ける')
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
