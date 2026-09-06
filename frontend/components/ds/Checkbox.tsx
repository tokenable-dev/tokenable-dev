import { cn } from "@/lib/ds/cn";

export type TkCheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label: string;
  className?: string;
};

export function TkCheckbox({ label, className, id, ...rest }: TkCheckboxProps) {
  const inputId = id ?? rest.name;
  return (
    <label className={cn("tk-check", className)}>
      <input type="checkbox" id={inputId} {...rest} />
      <span className="tk-check__box" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12l5 5L19 7"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {label}
    </label>
  );
}
