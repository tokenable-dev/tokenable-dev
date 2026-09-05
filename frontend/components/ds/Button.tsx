import { cn } from "@/lib/ds/cn";

export type TkButtonVariant =
  | "primary"
  | "primaryInv"
  | "neutral"
  | "subtle"
  | "ghost"
  | "danger";
export type TkButtonSize = "md" | "sm" | "table";

const variantClass: Record<TkButtonVariant, string> = {
  primary: "tk-btn--primary",
  primaryInv: "tk-btn--primary-inv",
  neutral: "tk-btn--neutral",
  subtle: "tk-btn--subtle",
  ghost: "tk-btn--ghost",
  danger: "tk-btn--danger",
};

const sizeClass: Record<TkButtonSize, string> = {
  md: "tk-btn--md",
  sm: "tk-btn--sm",
  table: "tk-btn--table",
};

type TkButtonCommonProps = {
  variant?: TkButtonVariant;
  size?: TkButtonSize;
  className?: string;
  children: React.ReactNode;
  /**
   * Non-interactive label (e.g. inside a card `<Link>`).
   * Renders `<span>` with `tk-btn` classes — not a focusable control.
   */
  decorative?: boolean;
};

export type TkButtonProps = TkButtonCommonProps &
  (
    | (React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; decorative?: false })
    | (React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined; decorative?: false })
    | (React.HTMLAttributes<HTMLSpanElement> & { decorative: true; href?: undefined })
  );

export function TkButton({
  variant = "primary",
  size = "md",
  className,
  decorative,
  children,
  ...rest
}: TkButtonProps) {
  const classes = cn("tk-btn", variantClass[variant], sizeClass[size], className);

  if (decorative) {
    const spanRest = rest as React.HTMLAttributes<HTMLSpanElement>;
    return (
      <span className={classes} aria-hidden {...spanRest}>
        {children}
      </span>
    );
  }

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
