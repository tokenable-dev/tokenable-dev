import { cn } from "@/lib/ds/cn";

export type VaultBadgeTone =
  | "grade"
  | "vaulted"
  | "minting"
  | "transit"
  | "action"
  | "rejected"
  | "user"
  | "system"
  | "webhook"
  | "blockchain"
  | "admin"
  | "neutral"
  | "pos";

export function VaultBadge({
  tone,
  children,
  className,
  pulse,
  style,
}: {
  tone: VaultBadgeTone;
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cn(
        "vault-badge",
        `vault-badge--${tone}`,
        pulse && "vault-badge--pulse",
        className,
      )}
      style={style}
    >
      {children}
    </span>
  );
}
