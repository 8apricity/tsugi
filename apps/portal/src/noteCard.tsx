import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { Ref } from 'react'
import { isNoteBodyOverflowing } from './noteCardLayout'
import { lifecycleLabel } from './editorLifecycle'
import { LifecycleIcon } from './editorLifecycleView'

export function NoteBodyView({
  body,
  bodyId,
  expanded,
  overflowing,
  onExpand,
  bodyRef,
}: {
  body: string
  bodyId: string
  expanded: boolean
  overflowing: boolean
  onExpand(): void
  bodyRef?: Ref<HTMLParagraphElement>
}) {
  return (
    <>
      <p
        id={bodyId}
        ref={bodyRef}
        className={expanded ? 'note-body-expanded' : 'note-body-clamped'}
      >
        {body}
      </p>
      {!expanded && overflowing ? (
        <button
          className="note-expand-button"
          type="button"
          aria-expanded={false}
          aria-controls={bodyId}
          aria-label="ノートの続きを読む"
          onClick={onExpand}
        >
          続きを読む
        </button>
      ) : null}
    </>
  )
}

export function NoteCard({
  noteId,
  body,
  targetScopeLabel,
  draft = false,
  changeKind = 'add',
  conflicted = false,
  removalReason,
  onCancelDraft,
  onEdit,
  onRemove,
  onOpenHistory,
  onOpenDetail,
  wholeCardDetailTarget = false,
}: {
  noteId: string
  body: string
  targetScopeLabel?: string
  draft?: boolean
  changeKind?: 'add' | 'update' | 'remove'
  conflicted?: boolean
  removalReason?: 'task-cascade'
  onCancelDraft?: () => void
  onEdit?: () => void
  onRemove?: () => void
  onOpenHistory?: () => void
  onOpenDetail?: () => void
  wholeCardDetailTarget?: boolean
}) {
  const generatedId = useId()
  const bodyId = `note-body-${generatedId.replace(/:/g, '')}`
  const bodyRef = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)

  useLayoutEffect(() => {
    const element = bodyRef.current
    if (!element || expanded) return
    const measure = () => setOverflowing(isNoteBodyOverflowing(element))
    measure()
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(measure)
    observer?.observe(element)
    return () => observer?.disconnect()
  }, [body, expanded])

  const removalSurface = draft && changeKind === 'remove' &&
    removalReason !== 'task-cascade'

  const canUseWholeCardDetailTarget = wholeCardDetailTarget && onOpenDetail &&
    !onCancelDraft && !onEdit && !onRemove && !onOpenHistory

  if (canUseWholeCardDetailTarget && !onCancelDraft && !onEdit && !onRemove && !onOpenHistory) {
    return (
      <button
        className="note-item note-detail-card note-detail-card-whole"
        type="button"
        aria-label="ノートの詳細を開く"
        data-note-id={noteId}
        onClick={onOpenDetail}
      >
        <span className="note-detail-card-body">{body}</span>
      </button>
    )
  }

  return (
    <article
      className={`note-item${draft ? ' note-draft' : ''}${removalSurface ? ' note-removal-draft' : ''}`}
      data-note-id={noteId}
    >
      {onOpenDetail ? (
        <button
          className="note-detail-card"
          type="button"
          aria-label="ノートの詳細を開く"
          onClick={onOpenDetail}
        >
          <span className="note-detail-card-body">{body}</span>
        </button>
      ) : (
        <NoteBodyView
          body={body}
          bodyId={bodyId}
          expanded={expanded}
          overflowing={overflowing}
          onExpand={() => setExpanded(true)}
          bodyRef={bodyRef}
        />
      )}
      {removalSurface ? <NoteRemovalGlyph /> : null}
      <div className="note-meta">
        {targetScopeLabel ? (
          <span className="task-scope-badge">{targetScopeLabel}</span>
        ) : null}
        {draft && !removalSurface ? (
          <span className="lifecycle-summary">
            <LifecycleIcon kind={changeKind} conflicted={conflicted} />
            <small>{lifecycleLabel(changeKind, conflicted)}</small>
          </span>
        ) : null}
        {removalReason === 'task-cascade' ? (
          <small className="note-cascade-removal">
            タスクの削除に伴い削除予定
          </small>
        ) : null}
        {draft && onCancelDraft ? (
          <button
            className="button-link"
            type="button"
            aria-label={changeKind === 'remove'
              ? 'ノートの削除を取り消す'
              : 'ノートの下書きを取り消す'}
            onClick={onCancelDraft}
          >
            {changeKind === 'remove' ? '削除を取り消す' : '取り消す'}
          </button>
        ) : null}
        {onEdit ? (
          <button className="button-link" type="button" onClick={onEdit}>
            編集
          </button>
        ) : null}
        {!draft && onRemove ? (
          <button className="button-link" type="button" onClick={onRemove}>
            削除予定にする
          </button>
        ) : null}
        {onOpenHistory ? (
          <button
            className="button-link"
            type="button"
            onClick={onOpenHistory}
          >
            編集履歴
          </button>
        ) : null}
      </div>
    </article>
  )
}

function NoteRemovalGlyph() {
  return (
    <span
      className="note-removal-glyph"
      role="img"
      aria-label="削除対象のノート"
    >
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7" />
      </svg>
    </span>
  )
}
