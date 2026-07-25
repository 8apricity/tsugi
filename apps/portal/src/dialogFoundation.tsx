import {
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

export type DialogSize = 'compact' | 'standard' | 'wide'

type DialogFrameProps = {
  active: boolean
  size: DialogSize
  role?: 'dialog' | 'alertdialog'
  description?: ReactNode
  initialFocus: 'close-or-back' | 'first-field' | 'cancel'
  onDismiss(): void
  header: (titleId: string) => ReactNode
  footer?: ReactNode
  children?: ReactNode
}

const EDITABLE_FIELD_SELECTOR = [
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
].join(',')

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function containTabFocus(
  dialog: HTMLDialogElement,
  event: KeyboardEvent<HTMLDialogElement>,
) {
  if (event.key !== 'Tab' || event.defaultPrevented) return
  const focusable = Array.from(
    dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((element) =>
    !element.hidden &&
    element.getAttribute('aria-hidden') !== 'true' &&
    !element.closest('[inert]'))
  const first = focusable[0]
  const last = focusable.at(-1)
  if (!first || !last) {
    event.preventDefault()
    dialog.focus()
    return
  }
  const current = document.activeElement
  if (event.shiftKey && (current === first || !dialog.contains(current))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (current === last || !dialog.contains(current))) {
    event.preventDefault()
    first.focus()
  }
}

function DialogFrame({
  active,
  size,
  role = 'dialog',
  description,
  initialFocus,
  onDismiss,
  header,
  footer,
  children,
}: DialogFrameProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const activatedRef = useRef(false)
  const titleId = useId()
  const descriptionId = useId()

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!active || !dialog?.open || activatedRef.current) return
    activatedRef.current = true
    const frameId = window.requestAnimationFrame(() => {
      const target = initialFocus === 'first-field'
        ? dialog.querySelector<HTMLElement>(EDITABLE_FIELD_SELECTOR) ??
          dialog.querySelector<HTMLElement>('[data-dialog-back]')
        : initialFocus === 'cancel'
          ? dialog.querySelector<HTMLElement>('[data-dialog-cancel]')
          : dialog.querySelector<HTMLElement>(
              '[data-dialog-back], [data-dialog-close]',
            )
      ;(target ?? dialog).focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [active, initialFocus])

  return (
    <dialog
      ref={dialogRef}
      className={`timetable-editor-dialog dialog-foundation dialog-size-${size}`}
      role={role}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description === undefined ? undefined : descriptionId}
      aria-hidden={active ? undefined : true}
      inert={active ? undefined : true}
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault()
        if (active) onDismiss()
      }}
      onKeyDown={(event) => {
        if (active) containTabFocus(event.currentTarget, event)
      }}
    >
      {header(titleId)}
      {description === undefined ? null : (
        <div
          id={descriptionId}
          className="dialog-confirmation-description"
        >
          {description}
        </div>
      )}
      {children === undefined ? null : (
        <div className="editor-dialog-body">{children}</div>
      )}
      {footer}
    </dialog>
  )
}

function DialogHeading({
  title,
  titleId,
  subtitle,
}: {
  title: string
  titleId: string
  subtitle?: ReactNode
}) {
  return (
    <div className="dialog-heading">
      <h2 id={titleId}>{title}</h2>
      {subtitle === undefined ? null : (
        <div className="dialog-subtitle">{subtitle}</div>
      )}
    </div>
  )
}

export function ReadOnlyDialog({
  active,
  title,
  subtitle,
  size,
  backLabel = '戻る',
  onBack,
  onClose,
  children,
}: {
  active: boolean
  title: string
  subtitle?: ReactNode
  size: DialogSize
  backLabel?: string
  onBack?: () => void
  onClose: () => void
  children: ReactNode
}) {
  return (
    <DialogFrame
      active={active}
      size={size}
      initialFocus="close-or-back"
      onDismiss={onBack ?? onClose}
      header={(titleId) => (
        <header className="editor-dialog-header editor-dialog-shell-header">
          {onBack ? (
            <button
              className="icon-button"
              type="button"
              aria-label={backLabel}
              data-dialog-back
              onClick={onBack}
            >
              ‹
            </button>
          ) : null}
          <DialogHeading
            title={title}
            titleId={titleId}
            subtitle={subtitle}
          />
          <button
            className="icon-button"
            type="button"
            aria-label="閉じる"
            data-dialog-close
            onClick={onClose}
          >
            ×
          </button>
        </header>
      )}
    >
      {children}
    </DialogFrame>
  )
}

export function EditorDialog({
  active,
  title,
  subtitle,
  size,
  formId,
  submitLabel = '保存',
  submitAriaLabel = '下書きを保存',
  submitDisabled = false,
  onBack,
  children,
}: {
  active: boolean
  title: string
  subtitle?: ReactNode
  size: DialogSize
  formId: string
  submitLabel?: string
  submitAriaLabel?: string
  submitDisabled?: boolean
  onBack: () => void
  children: ReactNode
}) {
  return (
    <DialogFrame
      active={active}
      size={size}
      initialFocus="first-field"
      onDismiss={onBack}
      header={(titleId) => (
        <header className="editor-dialog-header editor-dialog-shell-header">
          <button
            className="icon-button"
            type="button"
            aria-label="戻る"
            data-dialog-back
            onClick={onBack}
          >
            ‹
          </button>
          <DialogHeading
            title={title}
            titleId={titleId}
            subtitle={subtitle}
          />
          <button
            className="button-primary editor-dialog-save"
            type="submit"
            form={formId}
            disabled={submitDisabled}
            aria-label={submitAriaLabel}
          >
            {submitLabel}
          </button>
        </header>
      )}
    >
      {children}
    </DialogFrame>
  )
}

export function ConfirmationDialog({
  active,
  title,
  description,
  size = 'compact',
  tone,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  active: boolean
  title: string
  description: ReactNode
  size?: DialogSize
  tone: 'neutral' | 'danger'
  cancelLabel: string
  confirmLabel: string
  onCancel(): void
  onConfirm(): void
}) {
  return (
    <DialogFrame
      active={active}
      size={size}
      role="alertdialog"
      description={description}
      initialFocus="cancel"
      onDismiss={onCancel}
      header={(titleId) => (
        <header className="editor-dialog-header editor-dialog-shell-header">
          <DialogHeading title={title} titleId={titleId} />
        </header>
      )}
      footer={(
        <footer className="editor-dialog-actions dialog-confirmation-actions">
          <button
            className="button-secondary"
            type="button"
            data-dialog-cancel
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={tone === 'danger' ? 'button-danger' : 'button-primary'}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </footer>
      )}
    />
  )
}
