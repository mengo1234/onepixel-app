"use client";

import { ArrowRightIcon, CheckIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import { useState } from "react";

type Tier = { id: "small" | "medium" | "large"; participantLimit: number; amountCents: number; label: { it: string; en: string } };

export function EventCheckout({ tiers, successPath = "/dashboard", cancelPath = "/checkout" }: { tiers: Tier[]; successPath?: string; cancelPath?: string }) {
  const [selected, setSelected] = useState<Tier["id"]>(tiers[0]?.id ?? "small");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function checkout() {
    setPending(true);
    setError("");
    const origin = window.location.origin;
    const response = await fetch("/api/control/v1/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tier: selected, successUrl: `${origin}${successPath}`, cancelUrl: `${origin}${cancelPath}` }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setPending(false);
      setError(payload.message ?? "Sblocco demo non disponibile");
      return;
    }
    window.location.assign(payload.checkoutUrl);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="divide-y divide-white/8 border-y border-white/10">
        {tiers.map((tier, index) => {
          const active = selected === tier.id;
          return (
            <button key={tier.id} type="button" onClick={() => setSelected(tier.id)} className={`group grid w-full gap-4 px-1 py-6 text-left transition sm:grid-cols-[52px_1fr_auto] sm:items-center ${active ? "text-white" : "text-[#8f9795] hover:text-white"}`}>
              <span className={`grid size-11 place-items-center rounded-2xl border font-mono text-xs transition ${active ? "border-[#d1e66a] bg-[#d1e66a] text-[#101314]" : "border-white/10 bg-white/[0.035]"}`}>{String(index + 1).padStart(2, "0")}</span>
              <span><span className="block text-lg font-semibold tracking-[-0.035em]">{tier.label.it}</span><span className="mt-1 block text-xs text-[#757d7b]">Fino a {tier.participantLimit.toLocaleString("it-IT")} partecipanti, un solo evento.</span></span>
              <span className="flex items-center justify-between gap-5 sm:block sm:text-right"><span className="font-mono text-2xl font-semibold text-[#d1e66a]">{(tier.amountCents / 100).toLocaleString("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 0 })}</span><span className={`ml-auto grid size-6 place-items-center rounded-full border sm:mt-2 ${active ? "border-[#d1e66a] bg-[#d1e66a] text-[#101314]" : "border-white/15"}`}>{active && <CheckIcon size={14} weight="bold" />}</span></span>
            </button>
          );
        })}
      </div>
      <aside className="rounded-[32px] border border-white/10 bg-[#111516] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <ShieldCheckIcon size={24} className="text-[#d1e66a]" />
        <h2 className="mt-5 text-xl font-semibold tracking-[-0.04em]">Sblocco demo, nessun addebito.</h2>
        <ul className="mt-5 space-y-3 text-xs leading-5 text-[#8f9795]">
          <li className="flex gap-2"><CheckIcon className="mt-0.5 shrink-0 text-[#d1e66a]" size={15} />Editor completo della struttura</li>
          <li className="flex gap-2"><CheckIcon className="mt-0.5 shrink-0 text-[#d1e66a]" size={15} />QR, GPS e regia sincronizzata</li>
          <li className="flex gap-2"><CheckIcon className="mt-0.5 shrink-0 text-[#d1e66a]" size={15} />Nessuna carta e nessun addebito</li>
        </ul>
        {error && <p role="alert" className="mt-5 rounded-2xl border border-[#e26d5a]/25 bg-[#e26d5a]/10 p-3 text-xs text-[#f1a193]">{error}</p>}
        <button type="button" onClick={checkout} disabled={pending || tiers.length === 0} className="mt-7 flex h-13 w-full items-center justify-between rounded-full bg-[#d1e66a] px-5 text-sm font-semibold text-[#101314] transition hover:-translate-y-0.5 active:translate-y-px disabled:opacity-50"><span>{pending ? "Attivazione demo…" : "Sblocca evento demo"}</span><ArrowRightIcon size={17} weight="bold" /></button>
        <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-[#5f6765]">MODALITÀ MOCK · NESSUN ADDEBITO</p>
      </aside>
    </div>
  );
}
