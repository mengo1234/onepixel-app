"use client";

import { CheckCircleIcon, FloppyDiskIcon, ImageIcon } from "@phosphor-icons/react";
import { useState, type FormEvent } from "react";

export function OrganizationSettingsForm({ initial }: { initial: { name: string; brand: { primary?: string; logo?: string | null } } }) {
  const [name, setName] = useState(initial.name);
  const [primary, setPrimary] = useState(initial.brand.primary ?? "#D1E66A");
  const [logo, setLogo] = useState(initial.brand.logo ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  async function save(event: FormEvent) {
    event.preventDefault(); setState("saving");
    const response = await fetch("/api/control/v1/auth/organization", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, brand: { primary, logo: logo || null } }) });
    setState(response.ok ? "saved" : "error");
  }
  return <form onSubmit={save} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]"><section className="rounded-[30px] border border-white/10 bg-[#111516] p-6"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#d1e66a]">IDENTITÀ ORGANIZZAZIONE</p><div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="sm:col-span-2"><span className="editor-label">Nome pubblico</span><input value={name} onChange={(event) => setName(event.target.value)} className="editor-input h-11" /></label><label><span className="editor-label">Colore principale</span><div className="mt-1.5 flex h-11 items-center gap-3 rounded-xl border border-white/10 bg-[#0b0e0f] px-3"><input type="color" value={primary} onChange={(event) => setPrimary(event.target.value)} className="size-7 rounded border-0 bg-transparent" /><input value={primary} onChange={(event) => setPrimary(event.target.value)} pattern="#[0-9A-Fa-f]{6}" className="min-w-0 flex-1 bg-transparent font-mono text-xs uppercase text-white outline-none" /></div></label><label><span className="editor-label">Logo · URL</span><input type="url" value={logo} onChange={(event) => setLogo(event.target.value)} placeholder="https://…" className="editor-input h-11" /></label></div><button type="submit" disabled={state === "saving"} className="mt-7 flex h-11 items-center gap-2 rounded-full bg-[#d1e66a] px-5 text-xs font-semibold text-[#101314]"><FloppyDiskIcon size={16} />{state === "saving" ? "Salvataggio…" : "Salva identità"}</button>{state === "error" && <p className="mt-3 text-xs text-[#e58a7c]">Salvataggio non riuscito.</p>}</section><aside className="rounded-[30px] border border-white/10 bg-[#111516] p-6"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#68716f]">ANTEPRIMA NELL&apos;APP</p><div className="mt-5 overflow-hidden rounded-[24px] bg-[#0b0e0f]"><div className="h-28" style={{ background: `linear-gradient(135deg, ${primary}55, #101415)` }} /><div className="p-5"><span className="grid size-11 place-items-center rounded-2xl" style={{ backgroundColor: primary, color: "#101314" }}>{logo ? <ImageIcon size={21} /> : name.slice(0, 2).toUpperCase()}</span><h2 className="mt-4 text-lg font-semibold">{name}</h2><p className="mt-1 text-[10px] text-[#737b79]">Identità applicata a manifest, eventi e regia</p></div></div>{state === "saved" && <p className="mt-4 flex items-center gap-2 text-xs text-[#d1e66a]"><CheckCircleIcon weight="fill" />Salvato</p>}</aside></form>;
}
