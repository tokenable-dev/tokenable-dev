import { cn } from "@/lib/ds/cn";

export type TkButtonVariant = "primary" | "primaryInv" | "neutral" | "subtle" | "danger";
export type TkButtonSize = "md" | "sm";

const variantClass: Record<TkButtonVariant, string> = {
  primary: "tk-btn--primary",
  primaryInv: "tk-btn--primary-inv",
  neutral: "tk-btn--neutral",
  subtle: "tk-btn--subtle",
  danger: "tk-btn--danger",
};

const sizeClass: Record<TkButtonSize, string> = {
  md: "tk-btn--md",
  sm: "tk-btn--sm",
};

export type TkButtonProps = {
  variant?: TkButtonVariant;
  size?: TkButtonSize;
  href?: string;
  className?: string;
  children: React.ReactNode;
} & (
  | (React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string })
  | React.ButtonHTMLAttributes<HTMLButtonElement>
);

export function TkButton({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: TkButtonProps) {
  const classes = cn("tk-btn", variantClass[variant], sizeClass[size], className);

  if ("href" in rest && rest.href) {
    const { href, ...anchorRest } = rest as React.AnchorHTMLAttributes<HTMLAnchorElement> & {
      href: string;
    };
    return (
      <a href={href} className={classes} {...anchorRest}>
        {children}
      </a>
    );
  }

  const buttonRest = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type="button" className={classes} {...buttonRest}>
      {children}
    </button>
  );
}
