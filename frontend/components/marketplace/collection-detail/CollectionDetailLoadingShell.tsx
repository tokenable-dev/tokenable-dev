import { COLLECTION_DETAIL_SHELL_CLASS } from "@/constants/layout";
import { CollectionDetailMobileNav } from "./CollectionDetailMobileNav";

export function CollectionDetailLoadingShell() {
  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-[rgba(11,13,16,1)] text-white">
      <div
        className={`${COLLECTION_DETAIL_SHELL_CLASS} py-4 sm:py-8 pb-[max(5.5rem,env(safe-area-inset-bottom,0px)+4.5rem)] sm:pb-20`}
      >
        <CollectionDetailMobileNav />
        <div className="h-4 w-40 bg-gray-800/80 rounded animate-pulse mb-6" />
        <div className="rounded-2xl border border-gray-800/90 bg-[#0b0e11] overflow-hidden animate-pulse mb-10">
          <div className="border-b border-gray-800/80 px-4 py-4 sm:px-6">
            <div className="h-10 w-48 rounded-md bg-gray-800/50" />
          </div>
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(260px,min(307px,40vw))_minmax(0,1fr)_minmax(300px,420px)]">
            <div className="flex justify-center">
              <div className="aspect-[3/4] w-full max-w-[253px] sm:max-w-[280px] lg:max-w-[307px] rounded-2xl bg-gray-800/60" />
            </div>
            <div className="space-y-4 min-w-0">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(260px,304px)] gap-3">
                <div className="h-52 min-h-[186px] lg:h-[17rem] lg:min-h-[210px] rounded-xl bg-gray-800/40" />
                <div className="h-52 min-h-[186px] lg:h-[17rem] lg:min-h-[210px] rounded-xl bg-gray-800/35 border border-gray-800/80" />
              </div>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 min-h-[260px]" />
          </div>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-52 w-[200px] shrink-0 rounded-2xl bg-gray-800/40 border border-gray-800/80"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
