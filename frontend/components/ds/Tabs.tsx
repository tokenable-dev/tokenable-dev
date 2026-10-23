import { cn } from "@/lib/ds/cn";

export type TkTabsProps = {
  className?: string;
  children: React.ReactNode;
};

export function TkTabs({ className, children }: TkTabsProps) {
  return <div className={cn("tk-tabs", className)} role="tablist">{children}</div>;
}

export type TkTabProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function TkTab({
  active,
  className,
  children,
  type = "button",
  role = "tab",
  "aria-selected": ariaSelected,
  ...rest
}: TkTabProps) {
  return (
    <button
      type={type}
      role={role}
      aria-selected={ariaSelected ?? active}
      className={cn("tk-tab", active && "tk-tab--active", className)}
      {...rest}
    >
      {children}
    </button>
  );
}
