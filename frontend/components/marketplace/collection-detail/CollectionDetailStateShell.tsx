import { COLLECTION_DETAIL_SHELL_CLASS } from "@/constants/layout";
import { CollectionDetailMobileNav } from "./CollectionDetailMobileNav";

export function CollectionDetailStateShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="collection-detail-page min-h-screen min-w-0 overflow-x-clip text-white">
      <div
        className={`collection-detail-page__shell ${COLLECTION_DETAIL_SHELL_CLASS} sm:pb-20 pb-[max(5.5rem,env(safe-area-inset-bottom,0px)+4.5rem)]`}
      >
        <CollectionDetailMobileNav />
        {children}
      </div>
    </div>
  );
}
