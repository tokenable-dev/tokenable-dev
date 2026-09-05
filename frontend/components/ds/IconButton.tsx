import { cn } from "@/lib/ds/cn";

export type TkIconButtonVariant = "primary" | "neutral" | "subtle";
export type TkIconButtonSize = "md" | "sm";

const variantClass: Record<TkIconButtonVariant, string> = {
  primary: "tk-iconbtn--primary",
  neutral: "tk-iconbtn--neutral",
  subtle: "tk-iconbtn--subtle",
};

const sizeClass: Record<TkIconButtonSize, string> = {
  md: "tk-iconbtn--md",
  sm: "tk-iconbtn--sm",
};

export type TkIconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: TkIconButtonVariant;
  size?: TkIconButtonSize;
  className?: string;
  children: React.ReactNode;
};

export function TkIconButton({
  label,
  variant = "neutral",
  size = "md",
  className,
  children,
  type = "button",
  ...rest
}: TkIconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn("tk-iconbtn", variantClass[variant], sizeClass[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
}
