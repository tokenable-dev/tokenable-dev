/** Shown while /search navigates (before the client bundle hydrates). */
export default function SearchLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-black px-4 text-sm text-zinc-500">
      Searching…
    </div>
  );
}
