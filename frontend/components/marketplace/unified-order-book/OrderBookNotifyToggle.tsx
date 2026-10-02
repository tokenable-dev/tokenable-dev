"use client";

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function TurnOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/** Notify me — toggle.html: bell → Notifying; hover shows Turn off. No toast. */
export function OrderBookNotifyToggle({
  active,
  pending,
  disabled,
  onToggle,
}: {
  active: boolean;
  pending?: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`cd-ob-empty__btn cd-ob-empty__btn--notify${active ? " cd-ob-empty__btn--notify-on" : ""}`}
      aria-pressed={active}
      disabled={disabled || pending}
      onClick={onToggle}
    >
      {active ? (
        <span className="cd-ob-empty__notify-ic" aria-hidden>
          <CheckIcon />
        </span>
      ) : null}
      <span className="cd-ob-empty__notify-lbl">{active ? "Notifying" : "Notify me"}</span>
      <span className="cd-ob-empty__notify-turnoff" aria-hidden>
        <TurnOffIcon />
        Turn off
      </span>
    </button>
  );
}
