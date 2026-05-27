"use client";

/**
 * Next.js global error boundary.
 * Keep this page free of wagmi/client contexts so `next build` prerender does not crash.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-white">
      <h1 className="text-lg font-semibold text-red-400">Something went wrong</h1>
      <p className="mt-2 text-sm text-zinc-400">{error.message}</p>
      <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-zinc-700 bg-zinc-900/80 p-4 text-xs text-zinc-200">
        {error.stack ? error.stack : ""}
      </pre>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
      >
        Try again
      </button>
    </div>
  );
}

