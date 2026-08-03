import { ArrowUpRightIcon, CalendarBlankIcon, WaveformIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { controlPlaneGet } from "@/lib/control-plane";

type Event = { id: string; title: string; venue_name: string; starts_at: string; status: "draft" | "published" | "live" | "stopped" | "completed"; package_version: number };

export default async function EventsPage() {
  const events = await controlPlaneGet<Event[]>("/v1/events");
  const statusLabel = { draft: "Bozza", published: "Pronto", live: "Live", stopped: "Arrestato", completed: "Concluso" };
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Eventi" title="Programma. Prova. Trasmetti." description="Ogni evento contiene assegnazione QR, media, timeline e regia live in un unico flusso controllato." action={{ label: "Sblocca un evento", href: "/checkout" }} />
      <div className="divide-y divide-white/8 border-y border-white/8">
        {events.length === 0 && <div className="py-14 text-center"><CalendarBlankIcon size={28} className="mx-auto text-[#d1e66a]" /><h2 className="mt-4 text-base font-semibold">Nessun evento ancora</h2><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#7d8583]">Sblocca il primo evento e segui la configurazione guidata: struttura, accessi, effetti e regia live.</p></div>}
        {events.map((event) => (
          <article key={event.id} className="grid gap-5 py-6 md:grid-cols-[1fr_auto] md:items-center">
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.035] text-[#d1e66a]"><WaveformIcon size={22} /></span>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-semibold tracking-[-0.04em]">{event.title}</h2>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[9px] text-[#aab1af]">{statusLabel[event.status].toUpperCase()}</span>
                </div>
                <p className="mt-2 flex items-center gap-2 text-xs text-[#7d8583]"><CalendarBlankIcon size={14} /> {new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.starts_at))} · {event.venue_name}</p>
                <div className="mt-4 h-1.5 max-w-md overflow-hidden rounded-full bg-white/8"><span className="block h-full rounded-full bg-[#d1e66a]" style={{ width: `${event.status === "draft" ? 38 : 100}%` }} /></div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-16 md:justify-end md:pl-0">
              <Link href={`/events/${event.id}/edit`} className="rounded-full border border-white/12 px-4 py-2 text-xs text-[#c1c6c4] transition hover:border-white/30 hover:text-white active:scale-[0.98]">Dettagli evento</Link>
              <Link href={`/events/${event.id}/studio`} className="rounded-full border border-white/12 px-4 py-2 text-xs text-[#c1c6c4] transition hover:border-white/30 hover:text-white active:scale-[0.98]">Modifica effetti</Link>
              <Link href={`/events/${event.id}/live`} className="flex items-center gap-2 rounded-full bg-[#d1e66a] px-4 py-2 text-xs font-semibold text-[#0b0d0e] transition hover:-translate-y-0.5 active:translate-y-px">Apri regia live <ArrowUpRightIcon size={15} weight="bold" /></Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
