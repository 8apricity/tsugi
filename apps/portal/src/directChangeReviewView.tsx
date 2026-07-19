import type { DirectChangeReviewSummary } from './directChangeReview'

export function DirectChangeReviewDialog({
  summary,
  submitting,
  conflictCount,
  onBack,
  onApply,
}: {
  summary: DirectChangeReviewSummary
  submitting: boolean
  conflictCount: number
  onBack: () => void
  onApply: () => void
}) {
  return (
    <section
      className="timetable-editor-dialog direct-change-review-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="direct-change-review-title"
    >
      <header className="editor-dialog-header">
        <div>
          <h2 id="direct-change-review-title">最終確認</h2>
          <p className="change-content-subtitle">
            {summary.total}件の変更を反映します。
          </p>
        </div>
      </header>
      <dl className="direct-change-review-counts">
        <div><dt>時間割</dt><dd>{summary.timetable}件</dd></div>
        <div><dt>タスク</dt><dd>{summary.task}件</dd></div>
        <div><dt>ノート</dt><dd>{summary.note}件</dd></div>
      </dl>
      {conflictCount > 0 ? (
        <p className="direct-change-review-warning" role="alert">
          ほかの変更と重なっている下書きがあります。変更内容に戻って確認してください。
        </p>
      ) : null}
      <footer className="editor-dialog-actions direct-change-review-actions">
        <button className="button-secondary" type="button" disabled={submitting} onClick={onBack}>
          戻る
        </button>
        <button
          className="button-primary"
          type="button"
          disabled={submitting || summary.total === 0 || conflictCount > 0}
          onClick={onApply}
        >
          {submitting ? "変更を反映しています…" : "変更を反映"}
        </button>
      </footer>
    </section>
  )
}

export function DraftLogoutConfirmationDialog({
  draftCount,
  onBack,
  onLogout,
}: {
  draftCount: number
  onBack: () => void
  onLogout: () => void
}) {
  return (
    <section
      className="timetable-editor-dialog draft-logout-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="draft-logout-title"
      aria-describedby="draft-logout-description"
    >
      <header className="editor-dialog-header">
        <h2 id="draft-logout-title">下書きを削除してログアウトしますか？</h2>
      </header>
      <p id="draft-logout-description">
        保存中の下書き{draftCount}件はこの端末から削除され、復元できません。
      </p>
      <footer className="editor-dialog-actions">
        <button className="button-secondary" type="button" onClick={onBack}>
          戻る
        </button>
        <button className="button-danger" type="button" onClick={onLogout}>
          ログアウト
        </button>
      </footer>
    </section>
  )
}

export function DraftExitConfirmationDialog({
  draftCount,
  onContinue,
  onExit,
}: {
  draftCount: number
  onContinue: () => void
  onExit: () => void
}) {
  return (
    <section
      className="timetable-editor-dialog draft-exit-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="draft-exit-title"
      aria-describedby="draft-exit-description"
    >
      <header className="editor-dialog-header">
        <h2 id="draft-exit-title">下書きを削除して編集を終了しますか？</h2>
      </header>
      <p id="draft-exit-description">
        保存中の下書き{draftCount}件はこの端末から削除され、復元できません。
      </p>
      <footer className="editor-dialog-actions">
        <button className="button-secondary" type="button" onClick={onContinue}>
          編集を続ける
        </button>
        <button className="button-danger" type="button" onClick={onExit}>
          下書きを削除して終了
        </button>
      </footer>
    </section>
  )
}

export function StaleDirectChangeRefreshAction({
  onReload,
}: {
  onReload: () => void
}) {
  return (
    <button
      className="button-link timetable-editor-toast-action"
      type="button"
      onClick={onReload}
    >
      再読み込み
    </button>
  )
}
