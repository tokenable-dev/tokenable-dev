"use client";

import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/ds/cn";
import { TkInput, type TkInputProps } from "./Input";

export type TkSearchFieldSize = "default" | "compact";

export type TkSearchFieldProps = Omit<TkInputProps, "type"> & {
  /** `default` = 60px hero; `compact` = 44px GNB. */
  fieldSize?: TkSearchFieldSize;
  icon?: ReactNode;
  trailing?: ReactNode;
  wrapperClassName?: string;
};

/** Pixel search input shell — hero (60px) and GNB (compact). */
export const TkSearchField = forwardRef<HTMLInputElement, TkSearchFieldProps>(
  function TkSearchField(
    {
      fieldSize = "default",
      icon,
      trailing,
      wrapperClassName,
      className,
      ...rest
    },
    ref,
  ) {
    return (
      <div
        className={cn(
          "tk-search-field",
          fieldSize === "compact" && "tk-search-field--compact",
          trailing != null && "tk-search-field--has-trailing",
          wrapperClassName,
        )}
      >
        {icon ? (
          <span className="tk-search-field__icon" aria-hidden>{icon}</span>
        ) : null}
        <TkInput
          ref={ref}
          type="search"
          className={cn("tk-search-field__input", className)}
          {...rest}
        />
        {trailing ? (
          <span className="tk-search-field__trailing">{trailing}</span>
        ) : null}
      </div>
    );
  },
);
