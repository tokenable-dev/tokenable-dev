export const SETTINGS_SECTIONS = [
  "profile",
  "notifications",
  "wallet",
  "addresses",
  "identity",
  "legal",
  "security",
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number];

/** Legacy `?section=partner-vault` → Addresses (Partner Origin lives there). */
const SECTION_ALIASES: Record<string, SettingsSectionId> = {
  "partner-vault": "addresses",
};

export function parseSettingsSection(
  raw: string | null | undefined,
): SettingsSectionId {
  if (!raw) return "profile";
  if ((SETTINGS_SECTIONS as readonly string[]).includes(raw)) {
    return raw as SettingsSectionId;
  }
  return SECTION_ALIASES[raw] ?? "profile";
}
