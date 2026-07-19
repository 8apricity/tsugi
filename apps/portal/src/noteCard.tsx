import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { Ref } from 'react'
import { isNoteBodyOverflowing } from './noteCardLayout'
import { lifecycleLabel } from './editorLifecycle'
import { LifecycleIcon } from './editorLifecycleView'

export function RemovalMark({
  className,
  label,
}: {
  className: string
  label: string
}) {
  return (
    <span className={className} role="img" aria-label={label}>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M5 7h14M9 7V4h6v3m2 0-1 13H8L7 7m4 4v5m2-5v5" />
      </svg>
    </span>
  )
}

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
          onClick={(event) => {
            event.stopPropagation()
            onExpand()
          }}
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
  presentation = 'independent',
  showChevron = false,
  onOpen,
  onCancelDraft,
  onEdit,
  onRemove,
  onOpenHistory,
}: {
  noteId: string
  body: string
  targetScopeLabel?: string
  draft?: boolean
  changeKind?: 'add' | 'update' | 'remove'
  conflicted?: boolean
  removalReason?: 'task-cascade'
  presentation?: 'independent' | 'related'
  showChevron?: boolean
  onOpen?: () => void
  onCancelDraft?: () => void
  onEdit?: () => void
  onRemove?: () => void
  onOpenHistory?: () => void
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

  const individuallyRemoved = draft && changeKind === 'remove' &&
    removalReason !== 'task-cascade'
  const related = presentation === 'related'
  const hasMeta = (!related && Boolean(targetScopeLabel)) ||
    (draft && changeKind !== 'remove') || Boolean(onEdit) ||
    (!draft && Boolean(onRemove)) || Boolean(onOpenHistory)

  return (
    <article
      className={`note-item${draft ? ' note-draft' : ''}${
        individuallyRemoved ? ' note-removal-draft' : ''
      }${onOpen ? ' note-detail-target' : ''}${
        showChevron && !related ? ' note-with-chevron' : ''
      }${related ? ' note-related' : ''
      }`}
      data-note-id={noteId}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={onOpen
        ? (event) => {
            if (event.target !== event.currentTarget) return
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            onOpen()
          }
        : undefined}
    >
      {related && targetScopeLabel ? (
        <span className="task-scope-badge">{targetScopeLabel}</span>
      ) : null}
      <NoteBodyView
        body={body}
        bodyId={bodyId}
        expanded={expanded}
        overflowing={overflowing}
        onExpand={() => setExpanded(true)}
        bodyRef={bodyRef}
      />
      {hasMeta ? <div className="note-meta">
        {!related && targetScopeLabel ? (
          <span className="task-scope-badge">{targetScopeLabel}</span>
        ) : null}
        {draft && changeKind !== 'remove' ? (
          <span className="lifecycle-summary">
            <LifecycleIcon kind={changeKind} conflicted={conflicted} />
            <small>{lifecycleLabel(changeKind, conflicted)}</small>
          </span>
        ) : null}
        {draft && changeKind !== 'remove' && onCancelDraft ? (
          <button
            className="button-link"
            type="button"
            aria-label="ノートの下書きを取り消す"
            onClick={onCancelDraft}
          >
            取り消す
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
      </div> : null}
      {showChevron && !related ? (
        <span className="note-detail-chevron" aria-hidden="true">›</span>
      ) : null}
      {individuallyRemoved ? (
        <RemovalMark
          className="note-removal-mark"
          label="削除予定のノート"
        />
      ) : null}
    </article>
  )
}
