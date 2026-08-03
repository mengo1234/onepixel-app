"use client";

import { ArrowRightIcon, EyeIcon, EyeSlashIcon, LockKeyIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Localized } from "./dashboard-language";

export function LoginForm({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Email o password non corretti.");
      router.replace(payload.user?.role === "super_admin" ? "/admin/organizations" : "/checkout");
      router.refresh();
    } catch (caught) {
      setPending(false);
      setError(caught instanceof Error ? caught.message : "Connessione assente. Riprova.");
    }
  }

  return (
    <Localized><form className="mt-9 space-y-5" method="post" action="/api/session" onSubmit={submit}>
      <label className="block space-y-2">
        <span className="block text-xs font-medium text-[#c0c6c4]">Email organizzazione</span>
        <input name="email" type="email" required autoComplete="username" placeholder="regia@organizzazione.it" className="h-12 w-full rounded-xl border border-white/10 bg-[#111516] px-4 text-sm text-white placeholder:text-[#4f5655] focus:border-[#d1e66a]/60" />
      </label>
      <label className="block space-y-2">
        <span className="block text-xs font-medium text-[#c0c6c4]">Password</span>
        <span className="relative block"><input name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" className="h-12 w-full rounded-xl border border-white/10 bg-[#111516] px-4 pr-12 text-sm text-white placeholder:text-[#4f5655] focus:border-[#d1e66a]/60" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-[#858d8b] hover:bg-white/5 hover:text-white" aria-label={showPassword ? "Nascondi password" : "Mostra password"}>{showPassword ? <EyeSlashIcon size={18} /> : <EyeIcon size={18} />}</button></span>
        <span className="block text-[10px] text-[#697170]">La sessione resta protetta da cookie HttpOnly.</span>
      </label>
      {error && <p role="alert" className="rounded-xl border border-[#e26d5a]/30 bg-[#e26d5a]/10 px-4 py-3 text-xs text-[#f08a79]">{error}</p>}
      <button disabled={pending} type="submit" aria-label={pending ? "Accesso alla regia in corso" : "Accedi alla regia"} aria-busy={pending} className="image-skin flex h-14 w-full items-center justify-between rounded-full px-6 text-sm font-semibold text-[#0b0d0e] transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 active:translate-y-px" style={{ borderImageSource: "url('/buttons/primary-signal-v1.png')" }}>
        <span className="flex items-center gap-2"><LockKeyIcon size={17} weight="bold" /> {pending ? "Accesso in corso…" : "Accedi alla regia"}</span>
        <ArrowRightIcon size={17} weight="bold" />
      </button>
    </form></Localized>
  );
}
