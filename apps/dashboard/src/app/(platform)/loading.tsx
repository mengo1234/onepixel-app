import { Localized } from "@/components/dashboard-language";
export default function PlatformLoading() {
  return <Localized><div role="status" aria-live="polite" className="space-y-6"><div className="h-5 w-36 animate-pulse rounded-full bg-[#d1e66a]/12" /><div className="h-12 max-w-xl animate-pulse rounded-2xl bg-white/5" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-40 animate-pulse rounded-[26px] border border-white/8 bg-[#111516]" />)}</div><span className="sr-only">Caricamento dashboard…</span></div></Localized>;
}
