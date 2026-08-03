"use client";

import { ArrowRightIcon, CheckCircleIcon, EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function RegisterForm({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(initialError);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.get("name"), organizationName: form.get("organizationName"), email: form.get("email"), password: form.get("password") }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Registrazione non riuscita");
      router.replace("/checkout");
      router.refresh();
    } catch (caught) {
      setPending(false);
      setError(caught instanceof Error ? caught.message : "Connessione assente. Riprova.");
    }
  }

  const field = "h-12 w-full rounded-2xl border border-white/10 bg-white/[0.035] px-4 text-sm text-white outline-none transition focus:border-[#d1e66a]/60";
  return (
    <form method="post" action="/api/register" onSubmit={submit} className="mt-8 space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="grid gap-2"><span className="text-xs font-medium text-[#c6ccca]">Il tuo nome</span><input className={field} name="name" required autoComplete="name" placeholder="Livia Ferri" /></label>
        <label className="grid gap-2"><span className="text-xs font-medium text-[#c6ccca]">Organizzazione</span><input className={field} name="organizationName" required autoComplete="organization" placeholder="Luce Civica" /></label>
      </div>
      <label className="grid gap-2"><span className="text-xs font-medium text-[#c6ccca]">Email</span><input className={field} name="email" type="email" required autoComplete="email" placeholder="regia@organizzazione.it" /></label>
      <label className="grid gap-2">
        <span className="text-xs font-medium text-[#c6ccca]">Password</span>
        <span className="relative"><input className={`${field} pr-12`} name="password" type={showPassword ? "text" : "password"} required minLength={10} autoComplete="new-password" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-[#858d8b] hover:bg-white/5 hover:text-white" aria-label={showPassword ? "Nascondi password" : "Mostra password"}>{showPassword ? <EyeSlashIcon size={18} /> : <EyeIcon size={18} />}</button></span>
        <span className="text-[10px] text-[#747c7a]">Almeno 10 caratteri. Non chiediamo abbonamenti.</span>
      </label>
      {error && <p role="alert" className="rounded-2xl border border-[#e26d5a]/25 bg-[#e26d5a]/10 px-4 py-3 text-xs text-[#f1a193]">{error}</p>}
      <button type="submit" disabled={pending} aria-label={pending ? "Creazione account in corso" : "Crea account e scegli evento"} aria-busy={pending} className="flex h-14 w-full items-center justify-between rounded-full bg-[#d1e66a] px-6 text-sm font-semibold text-[#101314] transition hover:-translate-y-0.5 active:translate-y-px disabled:opacity-50">
        <span className="flex items-center gap-2"><CheckCircleIcon size={18} weight="fill" />{pending ? "Creazione account…" : "Crea account e scegli evento"}</span><ArrowRightIcon size={18} weight="bold" />
      </button>
      <p className="text-center text-xs text-[#7e8684]">Hai già un account? <Link className="font-medium text-[#d1e66a] hover:text-white" href="/login">Accedi</Link></p>
    </form>
  );
}
