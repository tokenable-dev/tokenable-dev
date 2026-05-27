"use client";

/**
 * Surfaces client/runtime errors on /portfolio (My Assets).
 */
export default function PortfolioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[/portfolio]", error);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-white">
      <h1 className="text-lg font-semibold text-red-400">My Assets failed to render</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Copy the message below and share it for debugging.
      </p>
      <pre className="mt-4 max-h-96 overflow-auto rounded-lg border border-zinc-700 bg-zinc-900/80 p-4 text-xs text-zinc-200 whitespace-pre-wrap">
        {error.message}
        {error.stack ? `\n\n${error.stack}` : ""}
        {error.digest ? `\n\ndigest: ${error.digest}` : ""}
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
