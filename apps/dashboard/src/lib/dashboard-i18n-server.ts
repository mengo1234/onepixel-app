import "server-only";

import { cookies } from "next/headers";
import { translateDashboard, type DashboardLanguageCode } from "./dashboard-i18n";

export const dashboardLocaleCookie = "onepixel_dashboard_locale";

export async function getDashboardLanguage(): Promise<DashboardLanguageCode> {
  return (await cookies()).get(dashboardLocaleCookie)?.value === "en" ? "en" : "it";
}

export async function getDashboardI18n() {
  const language = await getDashboardLanguage();
  return {
    language,
    t: (value: string) => translateDashboard(value, language),
  };
}
