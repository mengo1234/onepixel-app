"use client";

import { GlobeHemisphereWestIcon } from "@phosphor-icons/react";
import { Children, cloneElement, createContext, isValidElement, useCallback, useContext, useMemo, type ReactElement, type ReactNode } from "react";
import { translateDashboard, type DashboardLanguageCode } from "@/lib/dashboard-i18n";

type DashboardLanguageContextValue = {
  language: DashboardLanguageCode;
  t: (value: string) => string;
  localize: (node: ReactNode) => ReactNode;
};

const DashboardLanguageContext = createContext<DashboardLanguageContextValue | null>(null);

const translatedAttributes = ["placeholder", "aria-label", "title", "alt"] as const;

function translateNode(node: ReactNode, t: (value: string) => string): ReactNode {
  if (typeof node === "string") return t(node);
  if (Array.isArray(node)) return node.map((child) => translateNode(child, t));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<Record<string, unknown>>;
  const props: Record<string, unknown> = {};
  for (const attribute of translatedAttributes) {
    const value = element.props[attribute];
    if (typeof value === "string") props[attribute] = t(value);
  }
  if (element.props.children !== undefined) {
    props.children = Children.map(element.props.children as ReactNode, (child) => translateNode(child, t));
  }
  return cloneElement(element, props);
}

export function DashboardLanguage({ children, initialLanguage }: { children: ReactNode; initialLanguage: DashboardLanguageCode }) {
  const t = useCallback((value: string) => translateDashboard(value, initialLanguage), [initialLanguage]);
  const localize = useCallback((node: ReactNode) => translateNode(node, t), [t]);
  const value = useMemo(() => ({ language: initialLanguage, t, localize }), [initialLanguage, localize, t]);

  function toggle() {
    const next = initialLanguage === "it" ? "en" : "it";
    window.localStorage.setItem("onepixel.dashboard.language", next);
    document.cookie = `onepixel_dashboard_locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.location.reload();
  }

  return <DashboardLanguageContext.Provider value={value}>
    {localize(children)}
    <button type="button" onClick={toggle} data-language-switch className="fixed bottom-4 right-4 z-[2000] flex h-11 items-center gap-2 rounded-full border border-white/12 bg-[#111516]/95 px-4 font-mono text-[10px] font-semibold text-[#d1e66a] shadow-2xl backdrop-blur-xl transition hover:border-[#d1e66a]/35 active:scale-[.97]" aria-label={initialLanguage === "it" ? "Switch dashboard to English" : "Passa la dashboard in italiano"}><GlobeHemisphereWestIcon size={15} />{initialLanguage === "it" ? "EN" : "IT"}</button>
  </DashboardLanguageContext.Provider>;
}

export function useDashboardI18n() {
  const value = useContext(DashboardLanguageContext);
  if (!value) throw new Error("DashboardLanguage provider missing");
  return value;
}

export function DashboardText({ children }: { children: string }) {
  const { t } = useDashboardI18n();
  return <>{t(children)}</>;
}

export function Localized({ children }: { children: ReactNode }) {
  const { localize } = useDashboardI18n();
  return <>{localize(children)}</>;
}
