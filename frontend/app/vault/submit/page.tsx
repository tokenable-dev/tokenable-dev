import { VaultShell } from "@/components/vault/VaultShell";
import { VaultSubmitDesignView } from "@/components/vault/submit/VaultSubmitDesignView";

export default function VaultSubmitPage() {
  return (
    <VaultShell className="vault-page--submit">
      <div className="vault-page__shell vault-page__shell--submit">
        <VaultSubmitDesignView />
      </div>
    </VaultShell>
  );
}
