import { VaultShell } from "@/components/vault/VaultShell";
import { VaultSubmitDesignView } from "@/components/vault/submit/VaultSubmitDesignView";

export default function VaultSubmitPage() {
  return (
    <VaultShell wide className="vault-page--submit">
      <VaultSubmitDesignView />
    </VaultShell>
  );
}
