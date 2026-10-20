/**
 * Swagger Try-it-out examples for PriceCharting Prices API.
 * Demo token lives only in PriceCharting docs — our proxy injects
 * PRICECHARTING_API_TOKEN server-side; clients never send `t`.
 */
export const PRICECHARTING_SWAGGER_EXAMPLES = {
  productById: { id: '6910' },
  productByQuery: { q: 'charizard base set' },
  productsSearch: { q: 'pokemon charizard' },
} as const;
