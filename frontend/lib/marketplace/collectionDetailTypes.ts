/** KV row for collection hero / metadata grids (markets and collection detail). */
export interface CollectionDetailCard {
  id: string;
  label: string;
  value: string;
  /**
   * Optional Markets facet token when `value` is display-only (e.g. Set shows
   * expansion while `set=` still uses the year-stripped set line).
   */
  filterValue?: string;
  /** Card.html attr-link → `/markets?…` when this facet is filterable. */
  href?: string | null;
}
