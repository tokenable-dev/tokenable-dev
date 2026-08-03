"use client";

import { PSA_RATE_LIMIT_ALERT_MESSAGE } from "@/lib/psa/psaApiErrors";
import { SHOW_VAULT_COLLAPSIBLE_SECTIONS } from "@/lib/vault/mintFormConstants";
import { useMintForm } from "@/hooks/vault";
import { GradedCardSection } from "../GradedCardSection";
import { MintPsaAnalyzeOverlay } from "../MintPsaAnalyzeOverlay";
import { MintFormAssetListingSection } from "./MintFormAssetListingSection";
import { MintFormMintImageSection } from "./MintFormMintImageSection";
import { MintFormSuccessView } from "./MintFormSuccessView";
import { MintFormMintActions } from "./MintFormMintActions";

export function MintForm() {
  const mint = useMintForm();
  const { psa } = mint;

  if (mint.step === "success" && mint.result) {
    return (
      <MintFormSuccessView
        txHash={mint.result.txHash}
        onReset={mint.resetForm}
      />
    );
  }

  return (
    <>
      <div className="vault-form-panel transition-all duration-200">
        <form
          onSubmit={mint.handleSubmit}
          className="space-y-6"
          aria-busy={mint.isProcessing}
        >
          <GradedCardSection
            gradingCompany={mint.form.gradingCompany}
            card={mint.form.card}
            onCardChange={mint.updateCard}
            grade={mint.form.grade}
            onGradeChange={mint.updateGradePartial}
            verification={mint.form.verification}
            onVerificationChange={mint.updateVerification}
            psaFieldLocks={psa.psaFieldLocks}
            psaInputMode={psa.psaInputMode}
            onPsaInputModeChange={psa.handlePsaInputModeChange}
            onCertLookup={() => void psa.executePsaCertLookup()}
            onCertLookupReset={psa.resetCertLookupToEdit}
            certLookupBusy={psa.analyzeLoading}
            certLookupHasResult={psa.certLookupHasResult}
            showCardPsaDetailsPanel={SHOW_VAULT_COLLAPSIBLE_SECTIONS}
            slotAfterHero={
              <div className="space-y-4">
                <MintFormMintActions
                  isWalletReady={mint.isWalletReady}
                  isWalletActivating={mint.isWalletActivating}
                  isWalletAwaitingPrivy={mint.isWalletAwaitingPrivy}
                  hasAccountWallet={mint.hasAccountWallet}
                  walletActivateBusy={mint.walletActivateBusy}
                  walletActivateError={mint.walletActivateError}
                  onActivateAccountWallet={() => void mint.activateAccountWallet()}
                  showMintReady={psa.showMintReady}
                  isProcessing={mint.isProcessing}
                  showPsaAnalyzeOverlay={psa.showPsaAnalyzeOverlay}
                  psaInputMode={psa.psaInputMode}
                  step={mint.step}
                  errorMsg={mint.errorMsg}
                />

                <MintFormMintImageSection
                  showCollapsible={SHOW_VAULT_COLLAPSIBLE_SECTIONS}
                  showPsaAnalyzeOverlay={psa.showPsaAnalyzeOverlay}
                  lastAnalyze={psa.lastAnalyze}
                  form={mint.form}
                  mintImageBlobUrl={mint.mintImageBlobUrl}
                  psaInputMode={psa.psaInputMode}
                  imageError={mint.errors.image}
                />

                {!SHOW_VAULT_COLLAPSIBLE_SECTIONS && mint.errors.image && (
                  <p className="text-xs text-red-400">{mint.errors.image}</p>
                )}
                {!SHOW_VAULT_COLLAPSIBLE_SECTIONS && mint.errors.name && (
                  <p className="text-xs text-red-400">{mint.errors.name}</p>
                )}
                {!SHOW_VAULT_COLLAPSIBLE_SECTIONS &&
                  psa.lastAnalyze?.psa.cardNameHint?.trim() && (
                    <p className="text-xs leading-relaxed text-gray-500">
                      Listing title uses the PSA slab label:{" "}
                      <span className="text-gray-400">
                        {psa.lastAnalyze.psa.cardNameHint.trim()}
                      </span>
                    </p>
                  )}

                {psa.psaRateLimitAlert && (
                  <div
                    role="alert"
                    className="rounded-lg border border-zinc-700/55 bg-zinc-900/45 px-4 py-3"
                  >
                    <p className="text-xs leading-relaxed text-zinc-400">
                      {PSA_RATE_LIMIT_ALERT_MESSAGE}
                    </p>
                  </div>
                )}

                {psa.analyzeError && !psa.psaRateLimitAlert && (
                  <div className="space-y-2 rounded-lg border border-gray-700/50 bg-gray-900/30 px-4 py-3">
                    <p className="text-xs text-red-400 break-words">{psa.analyzeError}</p>
                  </div>
                )}

                <MintFormAssetListingSection
                  form={mint.form}
                  errors={mint.errors}
                  psaFieldLocks={psa.psaFieldLocks}
                  onNameChange={(value) => mint.updateForm("name", value)}
                  onDescriptionChange={(value) => mint.updateForm("description", value)}
                />
              </div>
            }
          />
        </form>
      </div>

      <MintPsaAnalyzeOverlay
        open={psa.showPsaAnalyzeOverlay}
        psaRateLimitAlert={psa.psaRateLimitAlert}
        psaInputMode={psa.psaInputMode}
        onDismissRateLimit={psa.dismissPsaRateLimitOverlay}
      />
    </>
  );
}
