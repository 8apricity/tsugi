import type { KeyboardEvent, ReactNode } from 'react'
import {
  immutableFieldMessage,
  lifecycleLabel,
  lifecycleTitle,
  type EditorKind,
  type LifecycleKind,
  type NotePlacementKind,
} from './editorLifecycle'
import { ConfirmationDialog } from './dialogFoundation'

function LifecycleGlyph({
  kind,
  conflicted,
}: {
  kind: LifecycleKind
  conflicted: boolean
}) {
  if (conflicted) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" data-glyph="警告">
        <path d="M12 3 2.8 20h18.4L12 3Z" />
        <path d="M12 8v6M12 17.2v.1" />
      </svg>
    )
  }
  if (kind === 'add') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" data-glyph="+">
        <path d="M12 5v14M5 12h14" />
      </svg>
    )
  }
  if (kind === 'update') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" data-glyph="鉛筆">
        <path d="m5 16-.8 3.8L8 19l10-10-3-3L5 16ZM13.8 7.2l3 3" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" data-glyph="ごみ箱">
      <path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7" />
    </svg>
  )
}

export function LifecycleIcon({
  kind,
  conflicted = false,
  className = '',
  showTitle = true,
}: {
  kind: LifecycleKind
  conflicted?: boolean
  className?: string
  showTitle?: boolean
}) {
  const label = lifecycleLabel(kind, conflicted)
  return (
    <span
      className={`lifecycle-icon lifecycle-${conflicted ? 'conflict' : kind}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={label}
      {...(showTitle ? { title: lifecycleTitle(kind, conflicted) } : {})}
    >
      <LifecycleGlyph kind={kind} conflicted={conflicted} />
    </span>
  )
}

export function DiscardConfirmationDialog({
  onContinue,
  onDiscard,
}: {
  onContinue(): void
  onDiscard(): void
}) {
  return (
    <ConfirmationDialog
      active
      title="入力内容を破棄しますか？"
      description="まだ保存していない入力内容は失われます。保存済みの下書きは変更されません。"
      tone="danger"
      cancelLabel="編集を続ける"
      confirmLabel="入力内容を破棄"
      onCancel={onContinue}
      onConfirm={onDiscard}
    />
  )
}

export function ImmutableFieldNotice({
  kind,
  onNotify,
  children,
  className = '',
  active = true,
  notePlacement,
}: {
  kind: EditorKind
  onNotify(message: string): void
  children: ReactNode
  className?: string
  active?: boolean
  notePlacement?: NotePlacementKind
}) {
  const message = immutableFieldMessage(kind, notePlacement)
  const notify = () => onNotify(message)
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    notify()
  }
  if (!active) {
    return <div className={className || undefined}>{children}</div>
  }
  return (
    <div
      className={`immutable-field-notice${className ? ` ${className}` : ''}`}
      role="button"
      tabIndex={0}
      aria-label={message}
      title={message}
      onClick={notify}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  )
}
