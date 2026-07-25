import type { FormEvent } from 'react'
import { EditorDialog, ReadOnlyDialog } from './dialogFoundation'

export type NoteDetailValue = {
  label: string
  value: string
}

type NoteDetailDialogProps = {
  body: string
  details: readonly NoteDetailValue[]
  editing: boolean
  removalPlanned: boolean
  onBodyChange(body: string): void
  onRemovalPlannedChange(removalPlanned: boolean): void
  onBack?: () => void
  backLabel?: string
  active: boolean
  onClose(): void
  onSave(): void
  onOpenHistory?: () => void
}

export function NoteDetailDialog(props: NoteDetailDialogProps) {
  if (props.editing) {
    return (
      <EditorDialog
        active={props.active}
        title="ノートの詳細"
        size="compact"
        formId="note-detail-form"
        onBack={props.onBack ?? props.onClose}
      >
        <form
          id="note-detail-form"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            props.onSave()
          }}
        >
          <label>
            <span>本文</span>
            <textarea
              required
              maxLength={1000}
              rows={8}
              disabled={props.removalPlanned}
              value={props.body}
              onChange={(event) => props.onBodyChange(event.target.value)}
            />
            <small className="note-character-count">
              {props.body.length} / 1000
            </small>
          </label>
          <NoteDetailSupplement
            details={props.details}
            onOpenHistory={props.onOpenHistory}
          />
          <label className="note-removal-checkbox">
            <input
              type="checkbox"
              checked={props.removalPlanned}
              onChange={(event) =>
                props.onRemovalPlannedChange(event.target.checked)}
            />
            <span>削除予定にする</span>
          </label>
        </form>
      </EditorDialog>
    )
  }

  return (
    <ReadOnlyDialog
      active={props.active}
      title="ノートの詳細"
      size="compact"
      backLabel={props.backLabel}
      onBack={props.onBack}
      onClose={props.onClose}
    >
      <section className="note-detail-body" aria-labelledby="note-body-title">
        <h3 id="note-body-title">本文</h3>
        <p>{props.body}</p>
      </section>
      <NoteDetailSupplement
        details={props.details}
        onOpenHistory={props.onOpenHistory}
      />
    </ReadOnlyDialog>
  )
}

function NoteDetailValues({ details }: { details: readonly NoteDetailValue[] }) {
  return (
    <dl className="detail-list note-detail-values">
      {details.map((detail) => (
        <div key={detail.label}>
          <dt>{detail.label}</dt>
          <dd>{detail.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function NoteDetailSupplement({
  details,
  onOpenHistory,
}: {
  details: readonly NoteDetailValue[]
  onOpenHistory?: () => void
}) {
  return (
    <>
      <NoteDetailValues details={details} />
      {onOpenHistory ? (
        <div className="editor-dialog-actions note-detail-actions">
          <button
            className="button-secondary"
            type="button"
            onClick={onOpenHistory}
          >
            編集履歴
          </button>
        </div>
      ) : null}
    </>
  )
}
