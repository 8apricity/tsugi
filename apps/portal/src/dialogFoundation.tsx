import type { ReactNode } from 'react'

export function EditorDialogShell({
  title,
  titleId,
  formId,
  className = '',
  saveDisabled = false,
  hidden = false,
  onBack,
  children,
}: {
  title: string
  titleId: string
  formId: string
  className?: string
  saveDisabled?: boolean
  hidden?: boolean
  onBack: () => void
  children: ReactNode
}) {
  return (
    <div
      className="editor-dialog-backdrop"
      role="presentation"
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
    >
      <section
        className={`timetable-editor-dialog editor-dialog-shell${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || event.defaultPrevented) return
          event.preventDefault()
          onBack()
        }}
      >
        <header className="editor-dialog-header editor-dialog-shell-header">
          <button
            className="icon-button"
            type="button"
            aria-label="戻る"
            onClick={onBack}
          >
            ‹
          </button>
          <h2 id={titleId}>{title}</h2>
          <button
            className="button-primary editor-dialog-save"
            type="submit"
            form={formId}
            disabled={saveDisabled}
            aria-label="下書きを保存"
          >
            保存
          </button>
        </header>
        <div className="editor-dialog-body">{children}</div>
      </section>
    </div>
  )
}

export function ReadOnlyDialogShell({
  title,
  titleId,
  className = '',
  backLabel = '戻る',
  hidden = false,
  onBack,
  onClose,
  children,
}: {
  title: string
  titleId: string
  className?: string
  backLabel?: string
  hidden?: boolean
  onBack?: () => void
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div
      className="editor-dialog-backdrop"
      role="presentation"
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
    >
      <section
        className={`timetable-editor-dialog${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key !== 'Escape' || event.defaultPrevented) return
          event.preventDefault()
          if (onBack) onBack()
          else onClose()
        }}
      >
        <header className="editor-dialog-header">
          {onBack ? (
            <button
              className="icon-button"
              type="button"
              aria-label={backLabel}
              onClick={onBack}
            >
              ‹
            </button>
          ) : null}
          <h2 id={titleId}>{title}</h2>
          <button
            className="icon-button"
            type="button"
            aria-label="閉じる"
            autoFocus
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="editor-dialog-body">{children}</div>
      </section>
    </div>
  )
}
