import { DestructiveConfirmationDialog } from './editorLifecycleView'

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
    <DestructiveConfirmationDialog
      title="下書きを削除して編集を終了しますか？"
      titleId="draft-exit-title"
      descriptionId="draft-exit-description"
      role="alertdialog"
      className="draft-exit-dialog"
      cancelLabel="編集を続ける"
      confirmLabel="下書きを削除して終了"
      onCancel={onContinue}
      onConfirm={onExit}
    >
      <p id="draft-exit-description">
        保存中の下書き{draftCount}件はこの端末から削除され、復元できません。
      </p>
    </DestructiveConfirmationDialog>
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
