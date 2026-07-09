import Link from "next/link";
import { cn } from "@/lib/ds/cn";

export function VaultBreadcrumb({
  items,
  variant = "default",
}: {
  items: { label: string; href?: string }[];
  variant?: "default" | "flow";
}) {
  return (
    <nav className={cn("vault-breadcrumb", variant === "flow" && "vault-breadcrumb--flow")} aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={item.label} className="vault-breadcrumb__segment">
          {i > 0 ? <span className="vault-breadcrumb__sep">›</span> : null}
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span className="vault-breadcrumb__current">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
