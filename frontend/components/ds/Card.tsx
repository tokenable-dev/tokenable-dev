import { cn } from "@/lib/ds/cn";

export type TkCardProps = React.HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
};

export function TkCard({ padded, className, children, ...rest }: TkCardProps) {
  return (
    <div className={cn("tk-card", padded && "tk-card--pad", className)} {...rest}>
      {children}
    </div>
  );
}
