import { forwardRef } from "react";
import { cn } from "@/lib/ds/cn";

export type TkInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
  className?: string;
};

export const TkInput = forwardRef<HTMLInputElement, TkInputProps>(
  function TkInput({ hasError, className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn("tk-input", hasError && "tk-input--error", className)}
        {...rest}
      />
    );
  },
);

export type TkTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  hasError?: boolean;
  className?: string;
};

export const TkTextarea = forwardRef<HTMLTextAreaElement, TkTextareaProps>(
  function TkTextarea({ hasError, className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn("tk-input", hasError && "tk-input--error", className)}
        {...rest}
      />
    );
  },
);

export type TkSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  hasError?: boolean;
  className?: string;
  wrapClassName?: string;
};

export const TkSelect = forwardRef<HTMLSelectElement, TkSelectProps>(
  function TkSelect({ hasError, className, wrapClassName, children, ...rest }, ref) {
    return (
      <div className={cn("tk-select-wrap", wrapClassName)}>
        <select
          ref={ref}
          className={cn("tk-input", hasError && "tk-input--error", className)}
          {...rest}
        >
          {children}
        </select>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    );
  },
);
