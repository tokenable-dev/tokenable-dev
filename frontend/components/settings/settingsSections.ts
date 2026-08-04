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

export function parseSettingsSection(
  raw: string | null | undefined,
): SettingsSectionId {
  if (raw && (SETTINGS_SECTIONS as readonly string[]).includes(raw)) {
    return raw as SettingsSectionId;
  }
  return "profile";
}
