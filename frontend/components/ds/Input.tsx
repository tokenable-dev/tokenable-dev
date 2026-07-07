import { cn } from "@/lib/ds/cn";

export type TkInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  hasError?: boolean;
  className?: string;
};

export function TkInput({ hasError, className, ...rest }: TkInputProps) {
  return (
    <input
      className={cn("tk-input", hasError && "tk-input--error", className)}
      {...rest}
    />
  );
}

export type TkTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  hasError?: boolean;
  className?: string;
};

export function TkTextarea({ hasError, className, ...rest }: TkTextareaProps) {
  return (
    <textarea
      className={cn("tk-input", hasError && "tk-input--error", className)}
      {...rest}
    />
  );
}
