import { useEffect, useRef, type FormEvent, type ReactNode } from 'react'
import type { VisibleTask } from './taskListView'
import { formatDueDate } from './uiCopy'
import { lifecycleLabel, type LifecycleKind } from './editorLifecycle'
import { LifecycleIcon } from './editorLifecycleView'
import { EditorDialog, ReadOnlyDialog } from './dialogFoundation'

export function TaskDetailDialog({
  task,
  taskScopeLabel,
  referenceSchoolDate,
  mode = 'view',
  editForm,
  editorFields,
  draftLifecycle,
  notes,
  addNoteDisabled = false,
  removalCheckboxAutoFocus = false,
  active,
  onClose,
  onSave,
  onNoteBodyChange,
  onRemovalPlannedChange,
  onRemovalCheckboxFocus,
  onOpenHistory,
  onAddNote,
  onEdit,
  onCancelDraft,
  cancelDraftDisabled = false,
  onRemove,
}: {
  task: VisibleTask
  taskScopeLabel: string
  referenceSchoolDate: string
  mode?: 'view' | 'edit'
  editForm?: {
    noteBodies: string[]
    removalPlanned: boolean
  }
  editorFields?: ReactNode
  draftLifecycle?: { kind: LifecycleKind; conflicted: boolean }
  notes: ReactNode
  addNoteDisabled?: boolean
  removalCheckboxAutoFocus?: boolean
  active: boolean
  onClose: () => void
  onSave?: (event: FormEvent<HTMLFormElement>) => void
  onNoteBodyChange?: (index: number, body: string) => void
  onRemovalPlannedChange?: (removalPlanned: boolean) => void
  onRemovalCheckboxFocus?: () => void
  onOpenHistory?: () => void
  onAddNote?: () => void
  onEdit?: () => void
  onCancelDraft?: () => void
  cancelDraftDisabled?: boolean
  onRemove?: () => void
}) {
  const removalCheckboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!removalCheckboxAutoFocus) return
    removalCheckboxRef.current?.focus()
  }, [removalCheckboxAutoFocus])

  if (mode === 'edit' && editForm && onSave) {
    return (
      <EditorDialog
        active={active}
        title="タスクを編集"
        size="compact"
        formId="task-detail-form"
        onBack={onClose}
      >
        <form id="task-detail-form" onSubmit={onSave}>
          {editorFields}
          {notes}
          <NoteBodyFields
            noteBodies={editForm.noteBodies}
            onBodyChange={onNoteBodyChange}
            onAddNote={onAddNote}
            disabled={editForm.removalPlanned}
            addDisabled={addNoteDisabled}
          />
          {onOpenHistory ? (
            <div className="editor-dialog-actions task-edit-actions">
              <button
                className="button-secondary"
                type="button"
                onClick={onOpenHistory}
              >
                編集履歴
              </button>
            </div>
          ) : null}
          {onCancelDraft ? (
            <div className="editor-dialog-actions">
              <button
                className="button-danger"
                type="button"
                disabled={cancelDraftDisabled}
                onClick={onCancelDraft}
              >
                下書きを取り消す
              </button>
            </div>
          ) : null}
          <label className="task-removal-checkbox">
            <input
              ref={removalCheckboxRef}
              autoFocus={removalCheckboxAutoFocus}
              type="checkbox"
              checked={editForm.removalPlanned}
              onFocus={onRemovalCheckboxFocus}
              onChange={(event) =>
                onRemovalPlannedChange?.(event.target.checked)}
            />
            <span>削除予定にする</span>
          </label>
        </form>
      </EditorDialog>
    )
  }

  return (
    <ReadOnlyDialog
      active={active}
      title="タスクの詳細"
      size="compact"
      onClose={onClose}
    >
      <dl className="detail-list">
        <div><dt>タイトル</dt><dd>{task.title}</dd></div>
        <div><dt>期限</dt><dd>{task.dueDate ? formatDueDate(task.dueDate, referenceSchoolDate) : "期限なし"}</dd></div>
        <div><dt>関連する授業</dt><dd>{task.relatedLessonName ?? "なし"}</dd></div>
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
          <button
            className="button-danger"
            type="button"
            disabled={cancelDraftDisabled}
            onClick={onCancelDraft}
          >
            下書きを取り消す
          </button>
        ) : null}
        {onRemove ? (
          <button className="button-danger" type="button" onClick={onRemove}>
            削除予定にする
          </button>
        ) : null}
      </div>
    </ReadOnlyDialog>
  )
}

export function NoteBodyFields({
  noteBodies,
  onBodyChange,
  onAddNote,
  disabled = false,
  addDisabled = false,
}: {
  noteBodies: string[]
  onBodyChange?: (index: number, body: string) => void
  onAddNote?: () => void
  disabled?: boolean
  addDisabled?: boolean
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
            disabled={disabled}
            onChange={(event) => onBodyChange?.(index, event.target.value)}
          />
        </label>
      ))}
      {onAddNote ? (
        <button
          className="button-secondary task-note-add-button"
          type="button"
          disabled={disabled || addDisabled}
          onClick={onAddNote}
        >
          ＋ノートを追加
        </button>
      ) : null}
    </div>
  )
}
