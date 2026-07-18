import type { FormEvent, ReactNode } from 'react'
import type { VisibleTask } from './taskListView'
import { formatDueDate } from './uiCopy'
import { lifecycleLabel, type LifecycleKind } from './editorLifecycle'
import { LifecycleIcon } from './editorLifecycleView'
import { DialogBody } from './dialogFoundation'

export function TaskDetailDialog({
  task,
  taskScopeLabel,
  referenceSchoolDate,
  dueDateMin,
  dueDateMax,
  mode = 'view',
  editForm,
  draftLifecycle,
  notes,
  addNoteDisabled = false,
  onClose,
  onSave,
  onTitleChange,
  onDueDateChange,
  onRelatedLessonNameChange,
  onNoteBodyChange,
  onAddNote,
  onOpenHistory,
  onEdit,
  onCancelDraft,
  onRemove,
}: {
  task: VisibleTask
  taskScopeLabel: string
  referenceSchoolDate: string
  dueDateMin?: string
  dueDateMax?: string
  mode?: 'view' | 'edit'
  editForm?: {
    title: string
    dueDate: string | null
    relatedLessonInput: string
    noteBodies: string[]
  }
  draftLifecycle?: { kind: LifecycleKind; conflicted: boolean }
  notes: ReactNode
  addNoteDisabled?: boolean
  onClose: () => void
  onSave?: (event: FormEvent<HTMLFormElement>) => void
  onTitleChange?: (title: string) => void
  onDueDateChange?: (dueDate: string | null) => void
  onRelatedLessonNameChange?: (lessonName: string) => void
  onNoteBodyChange?: (index: number, body: string) => void
  onAddNote?: () => void
  onOpenHistory?: () => void
  onEdit?: () => void
  onCancelDraft?: () => void
  onRemove?: () => void
}) {
  if (mode === 'edit' && editForm && onSave) {
    return (
      <div className="editor-dialog-backdrop" role="presentation">
        <section
          className="timetable-editor-dialog task-detail-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-detail-title"
        >
          <form className="editor-dialog-form" onSubmit={onSave}>
            <header className="editor-dialog-header">
              <button
                className="icon-button dialog-back-button"
                type="button"
                aria-label="戻る"
                onClick={onClose}
              >
                ‹
              </button>
              <h2 id="task-detail-title">タスクを編集</h2>
              <button
                className="button-primary dialog-save-button"
                type="submit"
              >
                下書きを更新
              </button>
            </header>
            <div className="editor-dialog-body">
              <label>
                <span>タイトル</span>
                <input
                  autoFocus
                  required
                  maxLength={120}
                  value={editForm.title}
                  onChange={(event) => onTitleChange?.(event.target.value)}
                />
              </label>
              <div className="task-form-field">
                <label htmlFor="task-detail-due-date">期限</label>
                <div className="optional-date-row">
                  <input
                    id="task-detail-due-date"
                    type="date"
                    min={dueDateMin}
                    max={dueDateMax}
                    value={editForm.dueDate ?? ''}
                    onChange={(event) =>
                      onDueDateChange?.(event.target.value || null)}
                  />
                  <button
                    className="optional-date-clear"
                    type="button"
                    aria-label="期限をクリア"
                    title="期限をクリア"
                    disabled={!editForm.dueDate}
                    onClick={() => onDueDateChange?.(null)}
                  >
                    ×
                  </button>
                </div>
              </div>
              <label>
                <span>関連する授業</span>
                <input
                  value={editForm.relatedLessonInput}
                  onChange={(event) =>
                    onRelatedLessonNameChange?.(event.target.value)}
                />
              </label>
              <dl className="detail-list task-edit-context">
                <div>
                  <dt>変更適用範囲</dt>
                  <dd>{taskScopeLabel}</dd>
                </div>
              </dl>
              {notes}
              <TaskNoteFields
                noteBodies={editForm.noteBodies}
                onBodyChange={onNoteBodyChange}
                onAddNote={onAddNote}
              />
              <div className="editor-dialog-actions">
                {onOpenHistory ? (
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={onOpenHistory}
                  >
                    編集履歴
                  </button>
                ) : null}
              </div>
            </div>
          </form>
        </section>
      </div>
    )
  }

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
        <DialogBody>
          <dl className="detail-list">
            <div><dt>タイトル</dt><dd>{task.title}</dd></div>
            <div><dt>期限</dt><dd>{task.dueDate ? formatDueDate(task.dueDate, referenceSchoolDate) : '期限なし'}</dd></div>
            <div><dt>関連する授業</dt><dd>{task.relatedLessonName ?? 'なし'}</dd></div>
            <div><dt>変更適用範囲</dt><dd>{taskScopeLabel}</dd></div>
            {draftLifecycle ? (
              <div>
                <dt>状態</dt>
                <dd className="lifecycle-summary">
                  <LifecycleIcon
                    kind={draftLifecycle.kind}
                    conflicted={draftLifecycle.conflicted}
                  />
                  <span>
                    {lifecycleLabel(
                      draftLifecycle.kind,
                      draftLifecycle.conflicted,
                    )}
                  </span>
                </dd>
              </div>
            ) : null}
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
                削除予定にする
              </button>
            ) : null}
          </div>
        </DialogBody>
      </section>
    </div>
  )
}

export function TaskNoteFields({
  noteBodies,
  onBodyChange,
  onAddNote,
}: {
  noteBodies: string[]
  onBodyChange?: (index: number, body: string) => void
  onAddNote?: () => void
}) {
  return (
    <div className="task-note-draft-fields">
      {noteBodies.map((body, index) => (
        <label key={index}>
          <span>ノート本文 {index + 1}</span>
          <textarea
            maxLength={1000}
            rows={4}
            value={body}
            onChange={(event) => onBodyChange?.(index, event.target.value)}
          />
        </label>
      ))}
      {onAddNote ? (
        <button
          className="button-secondary task-note-add-button"
          type="button"
          onClick={onAddNote}
        >
          ＋ノートを追加
        </button>
      ) : null}
    </div>
  )
}
