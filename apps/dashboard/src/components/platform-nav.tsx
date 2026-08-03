"use client";

import {
  BuildingsIcon,
  CalendarBlankIcon,
  ChartLineUpIcon,
  CreditCardIcon,
  GaugeIcon,
  GearSixIcon,
  SignOutIcon,
  ShieldCheckIcon,
  UserListIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BrandMark } from "./brand-mark";

const organizationLinks = [
  { href: "/dashboard", label: "Panoramica", mobileLabel: "Home", icon: GaugeIcon },
  { href: "/venues", label: "Strutture", mobileLabel: "Strutture", icon: BuildingsIcon },
  { href: "/events", label: "Eventi", mobileLabel: "Eventi", icon: CalendarBlankIcon },
  { href: "/reports", label: "Report", mobileLabel: "Report", icon: ChartLineUpIcon },
  { href: "/settings", label: "Profilo e brand", mobileLabel: "Profilo", icon: GearSixIcon },
];

const adminLinks = [
  { href: "/admin/organizations", label: "Organizzazioni", mobileLabel: "Clienti", icon: UsersThreeIcon },
  { href: "/admin/users", label: "Utenti", mobileLabel: "Utenti", icon: UserListIcon },
  { href: "/admin/payments", label: "Pagamenti", mobileLabel: "Pagamenti", icon: CreditCardIcon },
  { href: "/admin/events", label: "Tutti gli eventi", mobileLabel: "Tutti eventi", icon: CalendarBlankIcon },
];

export function PlatformNav({ role, email }: { role: "super_admin" | "organization_admin"; email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const visibleLinks = role === "super_admin" ? [...organizationLinks, ...adminLinks] : organizationLinks;
  const initials = email.split("@")[0].split(/[._-]/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "OP";

  async function signOut() {
    await fetch("/api/session", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="flex flex-col border-b border-white/8 bg-[#0d1011] lg:fixed lg:inset-y-0 lg:w-[248px] lg:border-b-0 lg:border-r">
      <div className="flex w-full items-center justify-between gap-3 px-4 py-4 lg:block lg:px-6 lg:py-7">
        <BrandMark />
        <div className="flex items-center gap-2 lg:block">
          <span className="rounded-full border border-[#d1e66a]/25 bg-[#d1e66a]/8 px-2.5 py-1 font-mono text-[10px] tracking-[0.16em] text-[#d1e66a] lg:mt-5 lg:inline-flex">
            {role === "super_admin" ? "CONTROL 01" : "ORG PANEL"}
          </span>
          <button type="button" onClick={signOut} className="grid size-9 place-items-center rounded-full border border-white/10 text-[#aab1af] lg:hidden" aria-label="Esci dalla regia" title="Esci">
            <SignOutIcon size={17} />
          </button>
        </div>
      </div>

      <nav className="hide-scrollbar flex w-full gap-1 overflow-x-auto px-3 pb-3 lg:hidden" aria-label="Navigazione mobile">
        {visibleLinks.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} aria-label={item.label} aria-current={active ? "page" : undefined} className={`flex min-w-[72px] flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-center text-[9px] ${active ? "bg-[#d1e66a] font-semibold text-[#0b0d0e]" : "bg-white/[0.04] text-[#aab1af]"}`}><Icon size={16} /><span className="w-full truncate">{item.mobileLabel}</span></Link>;
        })}
      </nav>

      <nav className="hidden flex-1 px-3 lg:block" aria-label="Navigazione principale">
        <p className="px-3 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#697170]">
          Organizzazione
        </p>
        <div className="space-y-1">
          {organizationLinks.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition duration-300 active:scale-[0.98] ${
                  active
                    ? "bg-[#d1e66a] font-semibold text-[#0b0d0e]"
                    : "text-[#aab1af] hover:bg-white/5 hover:text-[#f2f3ed]"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={19} weight={active ? "fill" : "regular"} />
                {item.label}
              </Link>
            );
          })}
        </div>

        {role === "super_admin" && <><p className="px-3 pb-2 pt-7 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#697170]">
          onePixel
        </p><div className="space-y-1">
          {adminLinks.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition duration-300 active:scale-[0.98] ${
                  active
                    ? "bg-[#d1e66a] font-semibold text-[#0b0d0e]"
                    : "text-[#aab1af] hover:bg-white/5 hover:text-[#f2f3ed]"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={19} weight={active ? "fill" : "regular"} />
                {item.label}
              </Link>
            );
          })}
        </div></>}
      </nav>

      <div className="hidden border-t border-white/8 p-4 lg:block">
        <button type="button" onClick={signOut} className="mb-3 flex w-full items-center gap-3 rounded-2xl bg-white/[0.035] p-3 text-left transition hover:bg-white/[0.06]" aria-label="Esci dalla regia">
          <span className="grid size-9 place-items-center rounded-xl bg-[#252b2d] text-xs font-semibold text-[#d1e66a]">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#f2f3ed]">{email}</p>
            <p className="truncate text-[11px] text-[#7d8583]">{role === "super_admin" ? "Super amministratore" : "Amministratore organizzazione"}</p>
          </div>
          <SignOutIcon size={17} className="text-[#727a78]" />
        </button>
        <div className="flex items-center gap-2 px-2 text-[11px] text-[#707876]">
          <ShieldCheckIcon size={14} />
          Sessione autenticata
        </div>
      </div>
    </aside>
  );
}
