"use client";

import { KeyIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Localized } from "./dashboard-language";

export function NewOrganizationButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/control/v1/admin/organizations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"), slug: form.get("slug"), adminEmail: form.get("adminEmail"), adminPassword: form.get("adminPassword"),
        expiresAt: new Date(String(form.get("expiresAt"))).toISOString(), maxEvents: Number(form.get("maxEvents")), maxDevices: Number(form.get("maxDevices")), maxCapacity: Number(form.get("maxCapacity")),
        brand: { primary: form.get("primary"), logo: null },
      }),
    });
    const payload = await response.json();
    if (!response.ok) { setPending(false); setError(payload.message ?? "Organizzazione non creata"); return; }
    setOpen(false);
    setPending(false);
    router.refresh();
  }

  const input = "h-11 w-full rounded-xl border border-white/10 bg-[#0b0d0e] px-3 text-sm text-white";
  return <Localized><>
    <button type="button" onClick={() => setOpen(true)} className="image-skin flex h-12 items-center gap-2 rounded-full px-6 text-sm font-semibold text-[#0b0d0e] transition hover:-translate-y-0.5" style={{ borderImageSource: "url('/buttons/primary-signal-v1.png')" }}><PlusIcon size={17} weight="bold" /> Nuova organizzazione</button>
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-[#050607]/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Nuova organizzazione">
      <form onSubmit={submit} autoComplete="off" className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-[30px] border border-white/12 bg-[#111516] p-6 shadow-2xl">
        <div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#d1e66a]">Nuovo cliente B2B</p><h2 className="mt-2 text-2xl font-semibold">Crea accesso e licenza</h2></div><button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full bg-white/5" aria-label="Chiudi"><XIcon size={18} /></button></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label><span className="mb-2 block text-xs text-[#b8bfbd]">Ragione sociale</span><input name="name" required className={input} /></label>
          <label><span className="mb-2 block text-xs text-[#b8bfbd]">Slug</span><input name="slug" required pattern="[a-z0-9-]+" placeholder="arena-nord" className={input} /></label>
          <label><span className="mb-2 block text-xs text-[#b8bfbd]">Email amministratore</span><input name="adminEmail" type="email" autoComplete="off" required className={input} /></label>
          <label><span className="mb-2 block text-xs text-[#b8bfbd]">Password iniziale</span><input name="adminPassword" type="password" autoComplete="new-password" minLength={10} required className={input} /></label>
          <label><span className="mb-2 block text-xs text-[#b8bfbd]">Scadenza licenza</span><input name="expiresAt" type="date" required defaultValue="2027-07-30" className={input} /></label>
          <label><span className="mb-2 block text-xs text-[#b8bfbd]">Colore brand</span><input name="primary" type="color" defaultValue="#d1e66a" className={`${input} p-1`} /></label>
          <label><span className="mb-2 block text-xs text-[#b8bfbd]">Eventi massimi</span><input name="maxEvents" type="number" min="1" required defaultValue="12" className={input} /></label>
          <label><span className="mb-2 block text-xs text-[#b8bfbd]">Dispositivi massimi</span><input name="maxDevices" type="number" min="1" required defaultValue="50000" className={input} /></label>
          <label className="sm:col-span-2"><span className="mb-2 block text-xs text-[#b8bfbd]">Capienza massima struttura</span><input name="maxCapacity" type="number" min="1" required defaultValue="50000" className={input} /></label>
        </div>
        {error && <p role="alert" className="mt-4 text-xs text-[#f08a79]">{error}</p>}
        <button disabled={pending} type="submit" className="image-skin mt-6 h-12 w-full rounded-full text-sm font-semibold text-[#0b0d0e] disabled:opacity-50" style={{ borderImageSource: "url('/buttons/primary-signal-v1.png')" }}>{pending ? "Creazione…" : "Crea organizzazione e credenziali"}</button>
      </form>
    </div>}
  </></Localized>;
}

export function OrganizationStatusButton({ id, status, name }: { id: string; status: "active" | "suspended"; name: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function toggle() {
    setPending(true);
    await fetch(`/api/control/v1/admin/organizations/${id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: status === "active" ? "suspended" : "active" }) });
    setPending(false);
    router.refresh();
  }
  return <Localized><button disabled={pending} onClick={() => void toggle()} type="button" className="grid size-9 place-items-center rounded-full border border-white/10 text-[#87908d] transition hover:text-white disabled:opacity-40" aria-label={`${status === "active" ? "Sospendi" : "Riattiva"} ${name}`}><KeyIcon size={16} /></button></Localized>;
}
