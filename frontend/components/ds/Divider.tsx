import { cn } from "@/lib/ds/cn";

export type TkDividerProps = {
  vertical?: boolean;
  className?: string;
};

export function TkDivider({ vertical, className }: TkDividerProps) {
  return (
    <hr
      className={cn("tk-divider", vertical && "tk-divider--v", className)}
      aria-hidden={vertical ? undefined : true}
    />
  );
}
