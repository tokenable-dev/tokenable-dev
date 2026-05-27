/** Shown while /markets navigates (before the client bundle hydrates). */
export default function MarketsLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-black px-4 text-sm text-zinc-500">
      Loading markets…
    </div>
  );
}
