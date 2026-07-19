import type { ReactNode } from 'react'

export function EditorDialogShell({
  title,
  titleId,
  formId,
  className = '',
  saveDisabled = false,
  onBack,
  children,
}: {
  title: string
  titleId: string
  formId: string
  className?: string
  saveDisabled?: boolean
  onBack: () => void
  children: ReactNode
}) {
  return (
    <div className="editor-dialog-backdrop" role="presentation">
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
          >
            下書きを保存
          </button>
        </header>
        <div className="editor-dialog-body">{children}</div>
      </section>
    </div>
  )
}
