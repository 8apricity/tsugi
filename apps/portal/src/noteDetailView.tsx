import type { FormEvent, ReactNode } from 'react'
import type { LifecycleKind } from './editorLifecycle'
import { DialogBody, DialogHeader, DialogSurface } from './dialogFoundation'
import { LifecycleIcon } from './editorLifecycleView'

export type NoteDetailMode = 'view' | 'edit'

export function NoteDetailDialog({
  mode,
  body,
  targetScopeLabel,
  relatedContextLabel,
  draftLifecycle,
  removalPlanned = false,
  saveLabel = '下書きを更新',
  backLabel = '戻る',
  onBack,
  onBodyChange,
  onRemovalChange,
  onOpenHistory,
  onSave,
}: {
  mode: NoteDetailMode
  body: string
  targetScopeLabel: string
  relatedContextLabel: ReactNode
  draftLifecycle?: { kind: LifecycleKind; conflicted: boolean }
  removalPlanned?: boolean
  saveLabel?: string
  backLabel?: string
  onBack: () => void
  onBodyChange?: (body: string) => void
  onRemovalChange?: (removalPlanned: boolean) => void
  onOpenHistory?: () => void
  onSave?: (event: FormEvent<HTMLFormElement>) => void
}) {
  const isEditing = mode === 'edit'
  const canShowRemoval = isEditing && onRemovalChange !== undefined

  return (
    <DialogSurface
      className="editor-dialog-form-surface note-detail-dialog"
      labelledBy="note-detail-title"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        onBack()
      }}
    >
      {isEditing ? (
        <form className="editor-dialog-form" onSubmit={onSave}>
          <DialogHeader
            title="ノートの詳細"
            titleId="note-detail-title"
            onBack={onBack}
            actionLabel={saveLabel}
            actionType="submit"
          />
          <DialogBody>
            <label className="note-detail-body-field">
              <span>本文</span>
              <textarea
                autoFocus
                required
                maxLength={1000}
                rows={8}
                disabled={removalPlanned}
                value={body}
                onChange={(event) => onBodyChange?.(event.target.value)}
              />
              <small className="note-character-count">
                {body.length} / 1000
              </small>
            </label>
            {canShowRemoval ? (
              <label className="checkbox-field note-removal-checkbox">
                <input
                  type="checkbox"
                  checked={removalPlanned}
                  onChange={(event) => onRemovalChange(event.target.checked)}
                />
                削除予定にする
              </label>
            ) : null}
            <NoteDetailContext
              targetScopeLabel={targetScopeLabel}
              relatedContextLabel={relatedContextLabel}
              draftLifecycle={draftLifecycle}
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
          </DialogBody>
        </form>
      ) : (
        <>
          <header className="editor-dialog-header">
            <button
              className="icon-button dialog-back-button"
              type="button"
              aria-label={backLabel}
              onClick={onBack}
            >
              ‹
            </button>
            <h2 id="note-detail-title">ノートの詳細</h2>
            <button
              className="icon-button"
              type="button"
              aria-label="閉じる"
              onClick={onBack}
            >
              ×
            </button>
          </header>
          <DialogBody>
            <NoteDetailContext
              body={body}
              targetScopeLabel={targetScopeLabel}
              relatedContextLabel={relatedContextLabel}
              draftLifecycle={draftLifecycle}
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
          </DialogBody>
        </>
      )}
    </DialogSurface>
  )
}

function NoteDetailContext({
  body,
  targetScopeLabel,
  relatedContextLabel,
  draftLifecycle,
}: {
  body?: string
  targetScopeLabel: string
  relatedContextLabel: ReactNode
  draftLifecycle?: { kind: LifecycleKind; conflicted: boolean }
}) {
  return (
    <dl className="detail-list note-detail-context">
      {body !== undefined ? (
        <div>
          <dt>本文</dt>
          <dd className="note-detail-body">{body}</dd>
        </div>
      ) : null}
      <div>
        <dt>変更適用範囲</dt>
        <dd>{targetScopeLabel}</dd>
      </div>
      <div>
        <dt>関連先</dt>
        <dd>{relatedContextLabel}</dd>
      </div>
      {draftLifecycle ? (
        <div>
          <dt>状態</dt>
          <dd className="lifecycle-summary">
            <LifecycleIcon
              kind={draftLifecycle.kind}
              conflicted={draftLifecycle.conflicted}
            />
          </dd>
        </div>
      ) : null}
    </dl>
  )
}
