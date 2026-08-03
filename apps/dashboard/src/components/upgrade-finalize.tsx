"use client";

import { CheckCircleIcon, SpinnerGapIcon, WarningCircleIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function UpgradeFinalize({ eventId, paymentId }: { eventId: string; paymentId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("Verifico lo sblocco mock e aggiorno la capienza…");
  useEffect(() => {
    let cancelled = false;
    async function apply() {
      const response = await fetch(`/api/control/v1/events/${eventId}/upgrade`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ paymentId }) });
      const payload = await response.json();
      if (cancelled) return;
      if (!response.ok) { setState("error"); setMessage(payload.message ?? "Upgrade non applicato"); return; }
      setState("done");
      setMessage(`Capienza aggiornata a ${Number(payload.participantLimit).toLocaleString("it-IT")} partecipanti.`);
      window.setTimeout(() => { router.replace(`/events/${eventId}/studio`); router.refresh(); }, 900);
    }
    void apply();
    return () => { cancelled = true; };
  }, [eventId, paymentId, router]);
  return <div className="mx-auto max-w-xl rounded-[30px] border border-white/10 bg-[#111516] p-8 text-center">{state === "loading" ? <SpinnerGapIcon size={34} className="mx-auto animate-spin text-[#d1e66a]" /> : state === "done" ? <CheckCircleIcon size={34} weight="fill" className="mx-auto text-[#d1e66a]" /> : <WarningCircleIcon size={34} className="mx-auto text-[#e58a7c]" />}<h2 className="mt-5 text-xl font-semibold">{state === "error" ? "Serve un controllo" : "Upgrade evento"}</h2><p className="mt-2 text-xs leading-5 text-[#8f9795]">{message}</p>{state === "error" && <Link href={`/events/${eventId}/upgrade`} className="mt-5 inline-flex rounded-full bg-[#d1e66a] px-5 py-2.5 text-xs font-semibold text-[#101314]">Riprova</Link>}</div>;
}
