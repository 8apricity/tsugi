import type { ReactNode } from 'react'
import type { VisibleTask } from './taskListView'
import { formatDueDate } from './uiCopy'

export function TaskDetailDialog({
  task,
  taskScopeLabel,
  referenceSchoolDate,
  draftStatus,
  notes,
  addNoteDisabled = false,
  onClose,
  onOpenHistory,
  onAddNote,
  onEdit,
  onCancelDraft,
  onRemove,
}: {
  task: VisibleTask
  taskScopeLabel: string
  referenceSchoolDate: string
  draftStatus?: string
  notes: ReactNode
  addNoteDisabled?: boolean
  onClose: () => void
  onOpenHistory?: () => void
  onAddNote?: () => void
  onEdit?: () => void
  onCancelDraft?: () => void
  onRemove?: () => void
}) {
  return (
    <div className="editor-dialog-backdrop" role="presentation">
      <section
        className="timetable-editor-dialog task-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
      >
        <header className="editor-dialog-header">
          <h2 id="task-detail-title">タスクの詳細</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="閉じる"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <dl className="detail-list">
          <div><dt>タイトル</dt><dd>{task.title}</dd></div>
          <div><dt>期限</dt><dd>{task.dueDate ? formatDueDate(task.dueDate, referenceSchoolDate) : "期限なし"}</dd></div>
          <div><dt>関連する授業</dt><dd>{task.relatedLessonName ?? "なし"}</dd></div>
          <div><dt>変更適用範囲</dt><dd>{taskScopeLabel}</dd></div>
          {draftStatus ? <div><dt>状態</dt><dd>{draftStatus}</dd></div> : null}
        </dl>
        {notes}
        <div className="editor-dialog-actions">
          {onOpenHistory ? (
            <button className="button-secondary" type="button" onClick={onOpenHistory}>
              編集履歴
            </button>
          ) : null}
          {onAddNote ? (
            <button
              className="button-secondary"
              type="button"
              disabled={addNoteDisabled}
              onClick={onAddNote}
            >
              ノートを書く
            </button>
          ) : null}
          {onEdit ? (
            <button className="button-secondary" type="button" onClick={onEdit}>
              編集
            </button>
          ) : null}
          {onCancelDraft ? (
            <button className="button-secondary" type="button" onClick={onCancelDraft}>
              下書きを取り消す
            </button>
          ) : null}
          {onRemove ? (
            <button className="button-danger" type="button" onClick={onRemove}>
              削除
            </button>
          ) : null}
        </div>
      </section>
    </div>
  )
}
