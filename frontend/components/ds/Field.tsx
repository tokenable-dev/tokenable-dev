import { cn } from "@/lib/ds/cn";

export type TkFieldProps = {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
};

export function TkField({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: TkFieldProps) {
  return (
    <div className={cn("tk-field", className)}>
      {label ? (
        <label className="tk-field__label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <span className="tk-field__hint tk-field__hint--error">{error}</span>
      ) : hint ? (
        <span className="tk-field__hint">{hint}</span>
      ) : null}
    </div>
  );
}
