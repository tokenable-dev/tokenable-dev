"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { TkButton, TkField, TkInput, TkTextarea } from "@/components/ds";
import {
  createCatalogListing,
  formatLoosePrice,
  matchCatalogProduct,
  searchCatalogProducts,
  searchCatalogUpc,
  submitCatalogListing,
  uploadCatalogListingPhoto,
  type CatalogListing,
  type CatalogProductHit,
} from "@/lib/core/api/pricecharting-listings";

type Step = "search" | "details" | "offer" | "photos" | "review" | "done";
type SearchMode = "text" | "upc" | "id";

const STEPS: { id: Step; n: string; label: string }[] = [
  { id: "search", n: "1", label: "Find the product" },
  { id: "details", n: "2", label: "Review the loose price" },
  { id: "offer", n: "3", label: "Set your asking price" },
  { id: "photos", n: "4", label: "Upload photos of your item" },
  { id: "review", n: "5", label: "Review and submit" },
];

function explain(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : fallback;
  if (message === "Unauthorized") return "Sign in to search the catalog.";
  return message;
}

function dollarsToCents(raw: string): number | null {
  const n = Number(raw.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}

function ProductSummary({ product }: { product: CatalogProductHit }) {
  return (
    <div className="sell-catalog-summary">
      <h2 className="sell-flow-choice__h2">{product.productName}</h2>
      <p>{product.consoleName}</p>
      <p>Released {product.releaseDate ?? "unknown"}</p>
      <p>{formatLoosePrice(product.loosePriceCents)}</p>
      <p>The loose price is a reference. It is not your asking price.</p>
    </div>
  );
}

export function CatalogListingFlow() {
  const [step, setStep] = useState<Step>("search");
  const [mode, setMode] = useState<SearchMode>("text");
  const [text, setText] = useState("");
  const [upc, setUpc] = useState("");
  const [productId, setProductId] = useState("");
  const [results, setResults] = useState<CatalogProductHit[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [product, setProduct] = useState<CatalogProductHit | null>(null);
  const [listing, setListing] = useState<CatalogListing | null>(null);
  const [askDollars, setAskDollars] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [sealedStatus, setSealedStatus] = useState("Factory sealed");
  const [conditionNote, setConditionNote] = useState("");
  const choosing = useRef(false);

  const stepIndex = STEPS.findIndex((item) => item.id === step);

  async function runSearch() {
    setBusy(true);
    setError(null);
    setNotice(null);
    setResults([]);
    try {
      if (mode === "text") {
        const rows = await searchCatalogProducts(text);
        setResults(rows);
        if (!rows.length) setNotice("No catalog products matched that text.");
      } else if (mode === "upc") {
        const rows = await searchCatalogUpc(upc);
        setResults(rows);
        if (!rows.length) setNotice("No catalog product has that UPC.");
      } else {
        const found = await matchCatalogProduct({ id: productId });
        if (found.ambiguous) setNotice("More than one product matched. Use text search and pick one.");
        else if (found.match) setResults([found.match]);
        else setNotice("No catalog product has that id.");
      }
    } catch (err) {
      setError(explain(err, "Search failed"));
    } finally {
      setBusy(false);
    }
  }

  async function choose(hit: CatalogProductHit) {
    if (choosing.current) return;
    if (listing && product?.id === hit.id) {
      setProduct(hit);
      setStep("details");
      return;
    }
    choosing.current = true;
    setBusy(true);
    setError(null);
    try {
      const draft = await createCatalogListing({
        pricechartingProductId: hit.id,
        clientRequestId: crypto.randomUUID(),
      });
      setProduct(hit);
      setListing(draft);
      setStep("details");
    } catch (err) {
      setError(explain(err, "Could not start the listing"));
    } finally {
      choosing.current = false;
      setBusy(false);
    }
  }

  async function onPhotos(files: FileList | null) {
    if (!listing || !files?.length) return;
    setBusy(true);
    setError(null);
    try {
      let current = listing;
      for (const file of Array.from(files)) {
        current = await uploadCatalogListingPhoto(current.id, file);
      }
      setListing(current);
    } catch (err) {
      setError(explain(err, "Photo upload failed"));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    if (!listing) return;
    const askPriceCents = dollarsToCents(askDollars);
    const qty = Number(quantity);
    if (askPriceCents == null || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      setError("Enter an asking price and a quantity from 1 to 99.");
      return;
    }
    if (!sealedStatus.trim()) {
      setError("Enter whether the item is sealed.");
      return;
    }
    if (!listing.photos.length) {
      setError("Upload a photo of the physical item.");
      setStep("photos");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const submitted = await submitCatalogListing(listing.id, {
        askPriceCents,
        quantity: qty,
        sealedStatus: sealedStatus.trim(),
        conditionNote: conditionNote.trim() || undefined,
      });
      setListing(submitted);
      setStep("done");
    } catch (err) {
      setError(explain(err, "Submit failed"));
    } finally {
      setBusy(false);
    }
  }

  const searchReady =
    (mode === "text" && text.trim().length > 0) ||
    (mode === "upc" && upc.trim().length > 0) ||
    (mode === "id" && productId.trim().length > 0);

  return (
    <section className="sell-flow-screen sell-flow-choice">
      <div className="sell-flow-col sell-flow-col--choice">
        <p>
          <Link href="/vault" className="sell-flow-link">
            Back to Sell
          </Link>
        </p>
        <h1 className="sell-flow-choice__title">List a catalog item</h1>
        <ol className="sell-flow-choice__steps" aria-label="Listing steps">
          {STEPS.map((item, index) => (
            <li key={item.id}>
              <span
                className={`sell-flow-choice__step-n ${
                  index < stepIndex || step === "done"
                    ? "sell-flow-choice__step-n--green"
                    : "sell-flow-choice__step-n--blue"
                }`}
              >
                {item.n}
              </span>
              <span>{item.label}</span>
            </li>
          ))}
        </ol>

        {step === "search" ? (
          <div className="sell-ship-return__fields">
            <div className="sell-catalog-modes" role="group" aria-label="Search method">
              {(
                [
                  ["text", "Name"],
                  ["upc", "UPC"],
                  ["id", "Product id"],
                ] as const
              ).map(([value, label]) => (
                <TkButton
                  key={value}
                  type="button"
                  variant={mode === value ? "primary" : "subtle"}
                  onClick={() => {
                    setMode(value);
                    setResults([]);
                    setNotice(null);
                  }}
                >
                  {label}
                </TkButton>
              ))}
            </div>
            {mode === "text" ? (
              <TkField label="Name or set" htmlFor="catalog-q" hint="Up to 20 matches. Pick the one you own.">
                <TkInput
                  id="catalog-q"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                />
              </TkField>
            ) : null}
            {mode === "upc" ? (
              <TkField label="UPC" htmlFor="catalog-upc" hint="Exact barcode, including leading zeros.">
                <TkInput
                  id="catalog-upc"
                  value={upc}
                  inputMode="text"
                  onChange={(event) => setUpc(event.target.value)}
                />
              </TkField>
            ) : null}
            {mode === "id" ? (
              <TkField label="PriceCharting product id" htmlFor="catalog-id">
                <TkInput
                  id="catalog-id"
                  value={productId}
                  onChange={(event) => setProductId(event.target.value)}
                />
              </TkField>
            ) : null}
            <TkButton type="button" variant="primary" disabled={busy || !searchReady} onClick={() => void runSearch()}>
              {busy ? "Searching…" : "Search"}
            </TkButton>
            {error ? (
              <p className="sell-catalog-alert" role="alert">
                {error}
              </p>
            ) : null}
            {notice ? <p className="sell-catalog-notice">{notice}</p> : null}
            <ul className="sell-catalog-results">
              {results.map((hit) => (
                <li key={hit.id}>
                  <button
                    type="button"
                    className="sell-flow-vault-opt"
                    disabled={busy}
                    onClick={() => void choose(hit)}
                  >
                    <strong>{hit.productName}</strong>
                    <span>{hit.consoleName}</span>
                    <span>{formatLoosePrice(hit.loosePriceCents)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {product && step !== "search" && step !== "done" ? <ProductSummary product={product} /> : null}

        {step === "details" ? (
          <div className="sell-catalog-actions">
            <TkButton type="button" variant="subtle" onClick={() => setStep("search")}>
              Back
            </TkButton>
            <TkButton type="button" variant="primary" onClick={() => setStep("offer")}>
              Continue
            </TkButton>
          </div>
        ) : null}

        {step === "offer" ? (
          <div className="sell-ship-return__fields">
            <TkField label="Your asking price (USD)" htmlFor="catalog-ask">
              <TkInput
                id="catalog-ask"
                value={askDollars}
                inputMode="decimal"
                onChange={(event) => setAskDollars(event.target.value)}
              />
            </TkField>
            <TkField label="Quantity" htmlFor="catalog-qty">
              <TkInput
                id="catalog-qty"
                value={quantity}
                inputMode="numeric"
                onChange={(event) => setQuantity(event.target.value)}
              />
            </TkField>
            <TkField label="Sealed status" htmlFor="catalog-sealed">
              <TkInput
                id="catalog-sealed"
                value={sealedStatus}
                onChange={(event) => setSealedStatus(event.target.value)}
              />
            </TkField>
            <TkField label="Condition note" htmlFor="catalog-note">
              <TkTextarea
                id="catalog-note"
                value={conditionNote}
                onChange={(event) => setConditionNote(event.target.value)}
              />
            </TkField>
            {error ? (
              <p className="sell-catalog-alert" role="alert">
                {error}
              </p>
            ) : null}
            <div className="sell-catalog-actions">
              <TkButton type="button" variant="subtle" onClick={() => setStep("details")}>
                Back
              </TkButton>
              <TkButton type="button" variant="primary" disabled={busy} onClick={() => setStep("photos")}>
                Add photos
              </TkButton>
            </div>
          </div>
        ) : null}

        {step === "photos" ? (
          <div className="sell-ship-return__fields">
            <TkField
              label="Photos of your physical item"
              htmlFor="catalog-photos"
              hint="JPEG, PNG, or WebP. These are photos of the item you are selling."
            >
              <input
                id="catalog-photos"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(event) => void onPhotos(event.target.files)}
              />
            </TkField>
            {listing?.photos.length ? (
              <ul className="sell-catalog-photos">
                {listing.photos.map((photo) => (
                  <li key={photo.id}>
                    <img src={photo.publicUrl} alt="Photo of your item" width={160} />
                  </li>
                ))}
              </ul>
            ) : (
              <p>No photo yet.</p>
            )}
            {error ? (
              <p className="sell-catalog-alert" role="alert">
                {error}
              </p>
            ) : null}
            <div className="sell-catalog-actions">
              <TkButton type="button" variant="subtle" onClick={() => setStep("offer")}>
                Back
              </TkButton>
              <TkButton
                type="button"
                variant="primary"
                disabled={busy || !listing?.photos.length}
                onClick={() => setStep("review")}
              >
                Review
              </TkButton>
            </div>
          </div>
        ) : null}

        {step === "review" && product ? (
          <div>
            <p>
              Asking price ${askDollars || "—"} · quantity {quantity}
            </p>
            <p>{sealedStatus}</p>
            {conditionNote ? <p>{conditionNote}</p> : null}
            <p>{listing?.photos.length ?? 0} photo{(listing?.photos.length ?? 0) === 1 ? "" : "s"}</p>
            {error ? (
              <p className="sell-catalog-alert" role="alert">
                {error}
              </p>
            ) : null}
            <div className="sell-catalog-actions">
              <TkButton type="button" variant="subtle" onClick={() => setStep("photos")}>
                Back
              </TkButton>
              <TkButton type="button" variant="primary" disabled={busy} onClick={() => void onSubmit()}>
                {busy ? "Submitting…" : "Submit listing"}
              </TkButton>
            </div>
          </div>
        ) : null}

        {step === "done" && listing ? (
          <div>
            <p>Listing submitted. Checkout is not part of this step.</p>
            <p>
              <Link href={`/marketplace/catalog-listings/${listing.id}`} className="sell-flow-link">
                View listing
              </Link>
            </p>
            <p>
              <Link href="/sell/listings" className="sell-flow-link">
                Your catalog listings
              </Link>
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
