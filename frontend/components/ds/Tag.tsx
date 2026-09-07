import { cn } from "@/lib/ds/cn";

export type TkTagTone = "neutral" | "brand" | "positive" | "warning" | "danger";
export type TkTagAppearance = "soft" | "solid";

const toneClass: Record<TkTagTone, string> = {
  neutral: "tk-tag--neutral",
  brand: "tk-tag--brand",
  positive: "tk-tag--positive",
  warning: "tk-tag--warning",
  danger: "tk-tag--danger",
};

export type TkTagProps = {
  tone?: TkTagTone;
  appearance?: TkTagAppearance;
  className?: string;
  children: React.ReactNode;
};

export function TkTag({
  tone = "neutral",
  appearance = "soft",
  className,
  children,
}: TkTagProps) {
  return (
    <span
      className={cn(
        "tk-tag",
        toneClass[tone],
        appearance === "solid" ? "tk-tag--solid" : "tk-tag--soft",
        className,
      )}
    >
      {children}
    </span>
  );
}

export type TkBadgeProps = {
  className?: string;
  children: React.ReactNode;
};

export function TkBadge({ className, children }: TkBadgeProps) {
  return <span className={cn("tk-badge", className)}>{children}</span>;
}
