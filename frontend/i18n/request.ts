import { getRequestConfig } from "next-intl/server";
import { resolveLocale, type AppLocale } from "@/lib/i18n/preferences";
import { cookies } from "next/headers";

const catalogs: Record<AppLocale, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import("../messages/en.json"),
  "zh-CN": () => import("../messages/zh-CN.json"),
  ja: () => import("../messages/ja.json"),
  "zh-TW": () => import("../messages/zh-TW.json"),
};

export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = resolveLocale(store.get("tk_locale")?.value);
  return {
    locale,
    messages: (await catalogs[locale]()).default,
  };
});
