import type { KeyboardEventHandler, ReactNode } from "react";

type DialogSurfaceProps = {
  children: ReactNode;
  className?: string;
  role?: "dialog" | "alertdialog";
  labelledBy: string;
  describedBy?: string;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
};

export function DialogSurface({
  children,
  className = "",
  role = "dialog",
  labelledBy,
  describedBy,
  onKeyDown,
}: DialogSurfaceProps) {
  return (
    <div className="editor-dialog-backdrop" role="presentation">
      <section
        className={`timetable-editor-dialog${className ? ` ${className}` : ""}`}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        onKeyDown={onKeyDown}
      >
        {children}
      </section>
    </div>
  );
}

export function DialogHeader({
  title,
  titleId,
  onBack,
  actionLabel,
  actionDisabled = false,
  actionType = "submit",
  onAction,
}: {
  title: ReactNode;
  titleId: string;
  onBack: () => void;
  actionLabel: string;
  actionDisabled?: boolean;
  actionType?: "button" | "submit";
  onAction?: () => void;
}) {
  return (
    <header className="editor-dialog-header">
      <button
        className="icon-button dialog-back-button"
        type="button"
        aria-label="戻る"
        onClick={onBack}
      >
        ‹
      </button>
      <h2 id={titleId}>{title}</h2>
      <button
        className="button-primary dialog-save-button"
        type={actionType}
        disabled={actionDisabled}
        onClick={onAction}
      >
        {actionLabel}
      </button>
    </header>
  );
}

export function DialogBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`editor-dialog-scroll-body${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}
