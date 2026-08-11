import { BroadcastIcon, CheckCircleIcon, MapTrifoldIcon, SlidersHorizontalIcon, WaveformIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

type EventWorkflowStep = "details" | "layout" | "studio" | "live";

const steps = [
  { id: "details" as const, label: "Dettagli", note: "Identità e accessi", suffix: "edit", icon: SlidersHorizontalIcon },
  { id: "layout" as const, label: "Allestimento", note: "Spazio del singolo evento", suffix: "layout", icon: MapTrifoldIcon },
  { id: "studio" as const, label: "Effetti e QR", note: "Timeline e assegnazioni", suffix: "studio", icon: WaveformIcon },
  { id: "live" as const, label: "Prova e live", note: "Dispositivi e trasmissione", suffix: "live", icon: BroadcastIcon },
];

export function EventWorkflowNav({ eventId, current, status = "draft" }: { eventId: string; current: EventWorkflowStep; status?: string }) {
  const currentIndex = steps.findIndex((step) => step.id === current);
  return <nav aria-label="Preparazione evento" className="rounded-[24px] border border-white/10 bg-[#101415] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.035)]">
    <div className="grid grid-cols-2 gap-1 md:grid-cols-4">{steps.map((step, index) => {
      const Icon = step.icon;
      const active = step.id === current;
      const completed = index < currentIndex || (status !== "draft" && index < 3);
      return <Link key={step.id} href={`/events/${eventId}/${step.suffix}`} aria-current={active ? "step" : undefined} className={`group flex min-h-16 items-center gap-3 rounded-[18px] px-3 py-2.5 transition active:scale-[.99] ${active ? "bg-[#d1e66a] text-[#101314]" : "text-[#8e9694] hover:bg-white/[.04] hover:text-white"}`}>
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl border ${active ? "border-[#101314]/10 bg-[#101314]/8" : completed ? "border-[#77a4a1]/20 bg-[#77a4a1]/8 text-[#9fc7c4]" : "border-white/8 bg-white/[.025]"}`}>{completed && !active ? <CheckCircleIcon size={17} weight="fill" /> : <Icon size={17} />}</span>
        <span className="min-w-0"><span className="block font-mono text-[8px] uppercase tracking-[.14em] opacity-65">0{index + 1}</span><span className="mt-0.5 block text-xs font-semibold">{step.label}</span><span className={`mt-0.5 block truncate text-[8px] ${active ? "text-[#101314]/65" : "text-[#68716f]"}`}>{step.note}</span></span>
      </Link>;
    })}</div>
  </nav>;
}
