"use client";

import { PowerIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Localized } from "./dashboard-language";

export function AdminUserActions({ userId, enabled }: { userId: string; enabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    if (!window.confirm(`${enabled ? "Disabilitare" : "Riabilitare"} questo utente?`)) return;
    setPending(true);
    setError("");
    const response = await fetch(`/api/control/v1/admin/users/${userId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: !enabled }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.message ?? "Operazione non riuscita");
      setPending(false);
      return;
    }
    router.refresh();
  }

  return <Localized><div><button type="button" onClick={() => void toggle()} disabled={pending} className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] transition disabled:opacity-40 ${enabled ? "border-[#d17667]/25 text-[#e18a7d] hover:bg-[#d17667]/8" : "border-[#d1e66a]/25 text-[#d1e66a] hover:bg-[#d1e66a]/8"}`}><PowerIcon size={13} />{pending ? "Attendi…" : enabled ? "Disabilita" : "Riabilita"}</button>{error && <p role="alert" className="mt-1 max-w-36 text-[9px] text-[#e18a7d]">{error}</p>}</div></Localized>;
}
