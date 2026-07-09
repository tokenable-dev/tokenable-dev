import { VaultShell } from "@/components/vault/VaultShell";
import { VaultListDesignView } from "@/components/vault/list/VaultListDesignView";

export default function VaultListPage() {
  return (
    <VaultShell narrow className="vault-page--list">
      <VaultListDesignView />
    </VaultShell>
  );
}
