/** Marketplace brand keys for trades tape Source column logos. */
export type TapeSourceBrandId =
  | "ebay"
  | "fanatics"
  | "comc"
  | "pwcc"
  | "goldin"
  | "heritage"
  | "myslabs"
  | "alt"
  | "starstock"
  | "tokenable";

export function brandIdFromPlatformLabel(
  platform: string | null | undefined,
): TapeSourceBrandId | null {
  const raw = platform?.trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("ebay")) return "ebay";
  if (raw.includes("fanatics")) return "fanatics";
  if (raw === "comc" || raw.includes("comc")) return "comc";
  if (raw.includes("pwcc")) return "pwcc";
  if (raw.includes("goldin")) return "goldin";
  if (raw.includes("heritage")) return "heritage";
  if (raw.includes("myslabs") || raw.includes("myslab")) return "myslabs";
  if (raw === "alt" || raw.includes("onlyalt")) return "alt";
  if (raw.includes("starstock") || raw.includes("star stock")) return "starstock";
  return null;
}
