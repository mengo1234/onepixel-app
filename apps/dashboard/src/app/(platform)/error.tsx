"use client";

import { ArrowClockwiseIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { Localized } from "@/components/dashboard-language";
import { useEffect } from "react";

export default function PlatformError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <Localized><div className="mx-auto grid min-h-[55dvh] max-w-2xl place-items-center"><div role="alert" className="w-full rounded-[30px] border border-[#e18a7d]/25 bg-[#111516] p-7 text-center"><WarningCircleIcon size={30} weight="fill" className="mx-auto text-[#e18a7d]" /><h1 className="mt-4 text-xl font-semibold">Questa sezione non è disponibile.</h1><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#858d8b]">Il control-plane non ha risposto oppure la sessione non può accedere ai dati richiesti. Nessuna modifica è stata applicata.</p>{error.digest && <p className="mt-3 font-mono text-[9px] text-[#626a68]">RIF. {error.digest}</p>}<button type="button" onClick={reset} className="mx-auto mt-6 flex h-11 items-center gap-2 rounded-full bg-[#d1e66a] px-5 text-xs font-semibold text-[#101314]"><ArrowClockwiseIcon size={15} />Riprova</button></div></div></Localized>;
}
