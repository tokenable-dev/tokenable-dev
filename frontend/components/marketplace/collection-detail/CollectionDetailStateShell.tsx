import { COLLECTION_DETAIL_SHELL_CLASS } from "@/constants/layout";

export function CollectionDetailStateShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="collection-detail-page min-h-screen min-w-0 overflow-x-clip text-white">
      <div
        className={`collection-detail-page__shell ${COLLECTION_DETAIL_SHELL_CLASS}`}
      >
        {children}
      </div>
    </div>
  );
}
