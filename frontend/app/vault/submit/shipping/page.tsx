import { VaultShell } from "@/components/vault/VaultShell";
import { VaultShippingDesignView } from "@/components/vault/shipping/VaultShippingDesignView";

export default function VaultShippingPage() {
  return (
    <VaultShell wide className="vault-page--shipping">
      <VaultShippingDesignView />
    </VaultShell>
  );
}
