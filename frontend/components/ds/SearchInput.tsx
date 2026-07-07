import { cn } from "@/lib/ds/cn";
import { TkInput } from "@/components/ds/Input";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" aria-hidden>
      <circle cx={11} cy={11} r={7} stroke="currentColor" strokeWidth={2} />
      <line
        x1={16.5}
        y1={16.5}
        x2={21}
        y2={21}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

export type TkSearchInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  className?: string;
  inputClassName?: string;
};

export function TkSearchInput({
  className,
  inputClassName,
  ...rest
}: TkSearchInputProps) {
  return (
    <div className={cn("tk-search", className)}>
      <span className="tk-search__icon">
        <SearchIcon />
      </span>
      <TkInput type="search" className={inputClassName} {...rest} />
    </div>
  );
}
