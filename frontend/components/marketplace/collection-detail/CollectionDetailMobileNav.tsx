import Link from "next/link";

export function CollectionDetailMobileNav() {
  return (
    <nav
      className="mb-1.5 flex min-h-[28px] shrink-0 items-center lg:hidden"
      aria-label="Back to markets"
    >
      <Link
        href="/markets"
        className="inline-flex items-center gap-1 rounded-md py-0.5 pr-2 text-[12px] font-medium text-zinc-400 transition-colors hover:text-white active:bg-white/[0.04]"
      >
        <svg
          className="h-4 w-4 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Markets
      </Link>
    </nav>
  );
}
