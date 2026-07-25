import { ConfirmationDialog } from './dialogFoundation'

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
    <ConfirmationDialog
      active
      title="下書きを削除してログアウトしますか？"
      description={`保存中の下書き${draftCount}件はこの端末から削除され、復元できません。`}
      tone="danger"
      cancelLabel="戻る"
      confirmLabel="ログアウト"
      onCancel={onBack}
      onConfirm={onLogout}
    />
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
    <ConfirmationDialog
      active
      title="下書きを削除して編集を終了しますか？"
      description={`保存中の下書き${draftCount}件はこの端末から削除され、復元できません。`}
      tone="danger"
      cancelLabel="編集を続ける"
      confirmLabel="下書きを削除して終了"
      onCancel={onContinue}
      onConfirm={onExit}
    />
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
