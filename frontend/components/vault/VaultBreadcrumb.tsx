import Link from "next/link";
import { Fragment } from "react";
import { cn } from "@/lib/ds/cn";

/** Vault-Submit.html `.breadcrumb` — flex children are link, sep, current (gap: 8px each). */
export function VaultBreadcrumb({
  items,
  variant = "default",
}: {
  items: { label: string; href?: string }[];
  variant?: "default" | "flow";
}) {
  return (
    <nav
      className={cn("vault-breadcrumb", variant === "flow" && "vault-breadcrumb--flow")}
      aria-label="Breadcrumb"
    >
      {items.map((item, i) => (
        <Fragment key={`${item.label}-${i}`}>
          {i > 0 ? (
            <span className="vault-breadcrumb__sep" aria-hidden>
              ›
            </span>
          ) : null}
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span className="vault-breadcrumb__current">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
