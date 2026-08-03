"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Localized } from "./dashboard-language";

export function AdminEventStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function change(next: string) {
    setPending(true);
    await fetch(`/api/control/v1/admin/events/${id}/status`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next }) });
    setPending(false);
    router.refresh();
  }
  return <Localized><select disabled={pending} value={status} onChange={(event) => void change(event.target.value)} className="h-9 rounded-xl border border-white/10 bg-[#0b0e0f] px-3 text-[11px] text-white"><option value="draft">Bozza</option><option value="published">Pubblicato</option><option value="live">Live</option><option value="stopped">Fermato</option></select></Localized>;
}
