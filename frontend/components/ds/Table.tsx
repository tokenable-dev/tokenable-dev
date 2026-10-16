import { cn } from "@/lib/ds/cn";

export type TkTableProps = {
  size?: "default" | "sm";
  className?: string;
  wrapClassName?: string;
  children: React.ReactNode;
};

export function TkTable({
  size = "default",
  className,
  wrapClassName,
  children,
}: TkTableProps) {
  return (
    <div className={cn("tk-table-wrap", wrapClassName)}>
      <table
        className={cn("tk-table", size === "sm" && "tk-table--sm", className)}
      >
        {children}
      </table>
    </div>
  );
}
