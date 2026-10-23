"use client";

import { TkButton } from "@/components/ds";
import { cn } from "@/lib/ds/cn";
import {
  getPageStateDefinition,
  type AppPageStateAction,
  type AppPageStateIcon,
  type AppPageStateKind,
} from "@/lib/ui/page-state-catalog";

function PageStateIcon({ icon }: { icon: AppPageStateIcon }) {
  switch (icon) {
    case "hourglass":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case "offline":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      );
    case "warning":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      );
    case "lock":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      );
    case "crash":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m0 3.75h.008M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case "search":
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      );
  }
}

function PageStateActionButton({ action }: { action: AppPageStateAction }) {
  const variant = action.variant ?? "primary";
  if (action.href) {
    return (
      <TkButton variant={variant} href={action.href}>
        {action.label}
      </TkButton>
    );
  }
  return (
    <TkButton variant={variant} type="button" onClick={action.onClick}>
      {action.label}
    </TkButton>
  );
}

export type AppPageStateProps = {
  kind: AppPageStateKind;
  title?: string;
  message?: string;
  primaryAction?: AppPageStateAction | null;
  secondaryAction?: AppPageStateAction | null;
  details?: string | null;
  layout?: "page" | "inline";
  className?: string;
  children?: React.ReactNode;
};

export function AppPageState({
  kind,
  title,
  message,
  primaryAction,
  secondaryAction,
  details,
  layout = "page",
  className,
  children,
}: AppPageStateProps) {
  const defaults = getPageStateDefinition(kind);
  const resolvedTitle = title ?? defaults.title;
  const resolvedMessage = message ?? defaults.message;
  const resolvedPrimary = primaryAction === null ? undefined : (primaryAction ?? defaults.primaryAction);
  const resolvedSecondary =
    secondaryAction === null ? undefined : (secondaryAction ?? defaults.secondaryAction);

  return (
    <div
      className={cn(
        "app-page-state",
        layout === "inline" && "app-page-state--inline",
        className,
      )}
      role="status"
    >
      {layout === "page" ? (
        <div className="app-page-state__icon-wrap">
          <PageStateIcon icon={defaults.icon} />
        </div>
      ) : null}
      <h1 className="app-page-state__title">{resolvedTitle}</h1>
      <p className="app-page-state__message">{resolvedMessage}</p>
      {children}
      {resolvedPrimary || resolvedSecondary ? (
        <div className="app-page-state__actions">
          {resolvedPrimary ? <PageStateActionButton action={resolvedPrimary} /> : null}
          {resolvedSecondary ? <PageStateActionButton action={resolvedSecondary} /> : null}
        </div>
      ) : null}
      {details ? (
        <div className="app-page-state__details">
          <span className="app-page-state__details-label">Technical details</span>
          {details}
        </div>
      ) : null}
    </div>
  );
}
