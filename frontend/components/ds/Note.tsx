import { cn } from "@/lib/ds/cn";

export type TkNoteTone = "brand" | "positive" | "warning" | "danger";

const toneClass: Record<TkNoteTone, string> = {
  brand: "tk-note--brand",
  positive: "tk-note--positive",
  warning: "tk-note--warning",
  danger: "tk-note--danger",
};

export type TkNoteAction = {
  label: string;
  onClick?: () => void;
  variant?: "ghost" | TkNoteTone;
};

export type TkNoteProps = {
  tone?: TkNoteTone;
  title?: string;
  /** Empty string allowed for title-only notes (Feedback-States “Success”). */
  message?: string;
  className?: string;
  icon?: React.ReactNode;
  actions?: TkNoteAction[];
  onClose?: () => void;
  /** Whole note activates (toast → same as notification navigate). */
  onActivate?: () => void;
};

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function TkNote({
  tone = "brand",
  title,
  message,
  className,
  icon,
  actions,
  onClose,
  onActivate,
}: TkNoteProps) {
  return (
    <div
      className={cn(
        "tk-note",
        toneClass[tone],
        onActivate && "tk-note--clickable",
        className,
      )}
      role={onActivate ? "button" : "status"}
      tabIndex={onActivate ? 0 : undefined}
      onClick={onActivate}
      onKeyDown={
        onActivate
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onActivate();
              }
            }
          : undefined
      }
    >
      {icon ? <span className="tk-note__icon">{icon}</span> : null}
      <div className="tk-note__body">
        {title ? <p className="tk-note__title">{title}</p> : null}
        {message ? <p className="tk-note__msg">{message}</p> : null}
        {actions && actions.length > 0 ? (
          <div className="tk-note__actions">
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                className={cn(
                  "tk-note__action",
                  `tk-note__action--${a.variant ?? tone}`,
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  a.onClick?.();
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {onClose ? (
        <button
          type="button"
          className="tk-note__close"
          aria-label="Dismiss"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <CloseGlyph />
        </button>
      ) : null}
    </div>
  );
}
