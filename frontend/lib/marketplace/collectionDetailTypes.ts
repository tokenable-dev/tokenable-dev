/** KV row for collection hero / metadata grids (markets & collection detail). */
export interface CollectionDetailCard {
  id: string;
  label: string;
  value: string;
  /** Card.html attr-link → `/markets?…` when this facet is filterable. */
  href?: string | null;
}
