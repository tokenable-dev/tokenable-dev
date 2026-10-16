/** Card.html tablet — collection detail mobile/pad layout through 1140px (not Tailwind lg 1024). */
export const COLLECTION_DETAIL_MOBILE_MEDIA = "(max-width: 1140px)" as const;

/** Tailwind arbitrary min-width for collection detail desktop shell (matches Card.html). */
export const COLLECTION_DETAIL_DESKTOP_MIN_TW = "1141px" as const;

/** Same fill can appear from session overlay + DB poll with timestamps minutes apart */
export const COLLECTION_SESSION_FILL_DEDUP_SEC = 300;
