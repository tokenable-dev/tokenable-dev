"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/ds/cn";

type SettingsBtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
};

/** Soft Settings.html buttons (rounded, not chunky tk-btn). */
export function SettingsBtn({
  variant = "ghost",
  size = "sm",
  className,
  type = "button",
  children,
  ...rest
}: SettingsBtnProps) {
  return (
    <button
      type={type}
      className={cn(
        "tk-settings__btn",
        variant === "primary" && "tk-settings__btn--primary",
        variant === "ghost" && "tk-settings__btn--ghost",
        variant === "danger" && "tk-settings__btn--danger",
        size === "sm" && "tk-settings__btn--sm",
        size === "md" && "tk-settings__btn--md",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
