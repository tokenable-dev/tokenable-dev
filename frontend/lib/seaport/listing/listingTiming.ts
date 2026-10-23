/** Dev-only `[listing-timing]` logs for list / set-price wallet flows. */
export function createListingTimingLogger() {
  const startedAt = Date.now();
  return (step: string) => {
    if (process.env.NODE_ENV === "production") return;
    console.info(`[listing-timing] ${step} +${Date.now() - startedAt}ms`);
  };
}
