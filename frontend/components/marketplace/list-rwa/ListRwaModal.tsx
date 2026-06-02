"use client";

import { ListRwaModalFormView } from "@/components/marketplace/list-rwa/ListRwaModalFormView";
import { ListRwaModalSuccessView } from "@/components/marketplace/list-rwa/ListRwaModalSuccessView";
import { useListRwaModal } from "@/hooks/list-rwa";
import type { ListRwaModalProps } from "@/lib/seaport/listing/listRwaModalTypes";

export type { ListRwaModalProps } from "@/lib/seaport/listing/listRwaModalTypes";

export function ListRwaModal(props: ListRwaModalProps) {
  const { tokenId, assetTitle, onClose } = props;
  const modal = useListRwaModal(props);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-5 sm:px-6 sm:py-8">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex w-full max-w-[min(100%,22rem)] flex-col rounded-2xl border border-zinc-700/90 bg-zinc-950 px-6 py-6 shadow-xl shadow-black/40 sm:py-8">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3.5 top-3.5 rounded-lg p-1 text-sm text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200 sm:right-4 sm:top-4"
        >
          ✕
        </button>

        {modal.step === "success" ? (
          <ListRwaModalSuccessView
            tokenId={tokenId}
            price={modal.price}
            isReplaceListing={modal.isReplaceListing}
            successMeta={modal.successMeta}
            onClose={onClose}
          />
        ) : (
          <ListRwaModalFormView
            tokenId={tokenId}
            assetTitle={assetTitle}
            isReplaceListing={modal.isReplaceListing}
            currentAskDisplay={modal.currentAskDisplay}
            price={modal.price}
            onPriceChange={modal.setPrice}
            crossingBidsForInstantSale={modal.crossingBidsForInstantSale}
            selectedBidHash={modal.selectedBidHash}
            onSelectBidHash={modal.setSelectedBidHash}
            step={modal.step}
            errorMsg={modal.errorMsg}
            isProcessing={modal.isProcessing}
            onSubmit={() => void modal.handleList()}
          />
        )}
      </div>
    </div>
  );
}
