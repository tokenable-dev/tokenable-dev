"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildCollectionSearchHref } from "@/lib/markets/marketsUrlFilters";

export function MarketsPageHeader({
  searchQuery,
  resultCount,
}: {
  searchQuery?: string;
  resultCount?: number;
}) {
  if (searchQuery != null) {
    const q = searchQuery.trim();
    return (
      <header className="markets-page__header tkl-wrap">
        <span className="tkl-eyebrow">Search</span>
        <p className="markets-page__search-sub">
          {q ? (
            <>
              {resultCount != null ? (
                <>
                  <b>{resultCount.toLocaleString("en-US")}</b> results
                  <span className="markets-page__search-dot"> · for </span>
                </>
              ) : (
                <span className="markets-page__search-dot">Results for </span>
              )}
              <span className="markets-page__search-q">&quot;{q}&quot;</span>
            </>
          ) : (
            "Search collections"
          )}
        </p>
        <MarketsSearchRefine initialQ={q} />
      </header>
    );
  }

  return (
    <header className="markets-page__header tkl-wrap">
      <span className="tkl-eyebrow">On-chain now</span>
      <h1 className="markets-page__title tkl-page-title">Markets</h1>
    </header>
  );
}

function MarketsSearchRefine({ initialQ }: { initialQ: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQ);

  useEffect(() => {
    setValue(initialQ);
  }, [initialQ]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = value.trim();
    router.push(next ? buildCollectionSearchHref(next) : "/search");
  }

  return (
    <form className="markets-search-refine" onSubmit={onSubmit}>
      <input
        className="markets-search-refine__input"
        type="search"
        name="q"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onCompositionEnd={(e) => setValue(e.currentTarget.value)}
        placeholder="Search cards, sets, players…"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        aria-label="Search collections"
      />
      {value.trim() ? (
        <button
          type="button"
          className="markets-search-refine__clear"
          onClick={() => {
            setValue("");
            router.push("/search");
          }}
        >
          Clear
        </button>
      ) : null}
      <button type="submit" className="markets-search-refine__go">
        Search
      </button>
      <Link href="/markets" className="markets-search-refine__all">
        All markets
      </Link>
    </form>
  );
}
