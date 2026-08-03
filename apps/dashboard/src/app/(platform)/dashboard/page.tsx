import {
  ArrowUpRightIcon,
  BroadcastIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  DownloadSimpleIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StadiumMap } from "@/components/stadium-map";
import { controlPlaneGet } from "@/lib/control-plane";

type Event = { id: string; title: string; venue_name: string; venue_capacity: number; starts_at: string; status: string; layout_snapshot?: { elements?: Array<{ kind: string }> } | string };
type Presence = { connected: number; ready: number; avg_offset_ms: number; zones: Array<unknown> };
type Payment = { id: string; participant_limit: number; status: string; consumed_event_id?: string | null };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ payment_id?: string; mock?: string }> }) {
  const [{ payment_id: returnedPaymentId, mock }, events, payments] = await Promise.all([
    searchParams,
    controlPlaneGet<Event[]>("/v1/events"),
    controlPlaneGet<Payment[]>("/v1/billing/payments"),
  ]);
  const availablePayment = payments.find((payment) => payment.status === "paid" && !payment.consumed_event_id);
  if (events.length === 0 && !availablePayment) redirect("/checkout?required=1");
  const paymentJustCompleted = mock === "1" && availablePayment?.id === returnedPaymentId;
  const featured = events[0];
  const featuredSnapshot = featured?.layout_snapshot ? (typeof featured.layout_snapshot === "string" ? JSON.parse(featured.layout_snapshot) as Exclude<Event["layout_snapshot"], string> : featured.layout_snapshot) : undefined;
  const featuredZoneCount = featuredSnapshot?.elements?.filter((element) => ["sector", "stand", "curve", "block", "standing-area", "accessible-area"].includes(element.kind)).length ?? 0;
  const presence = featured ? await controlPlaneGet<Presence>(`/v1/events/${featured.id}/presence`).catch(() => ({ connected: 0, ready: 0, avg_offset_ms: 0, zones: [] })) : { connected: 0, ready: 0, avg_offset_ms: 0, zones: [] };
  const readyPercent = presence.connected ? Math.round((presence.ready / presence.connected) * 1000) / 10 : 0;
  const upcoming = events.slice(0, 4).map((event) => ({ name: event.title, venue: event.venue_name, date: new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(event.starts_at)).toUpperCase(), status: event.status.toUpperCase(), href: `/events/${event.id}/${event.status === "live" ? "live" : "studio"}` }));
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Centro di controllo"
        title="La folla è pronta a diventare immagine."
        description="Prepara le strutture, pubblica le sequenze e controlla ogni settore da una regia costruita per il momento in cui tutto deve funzionare insieme."
        action={{ label: "Crea evento", href: availablePayment ? `/events/new?payment_id=${encodeURIComponent(availablePayment.id)}` : "/checkout" }}
      />

      {paymentJustCompleted && availablePayment && <section role="status" className="flex flex-col gap-4 rounded-[26px] border border-[#d1e66a]/25 bg-[#d1e66a]/8 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3"><CheckCircleIcon size={22} weight="fill" className="mt-0.5 shrink-0 text-[#d1e66a]" /><div><p className="text-sm font-semibold text-white">Pagamento demo completato</p><p className="mt-1 text-xs leading-5 text-[#9da5a3]">Hai sbloccato un evento fino a {availablePayment.participant_limit.toLocaleString("it-IT")} partecipanti. Ora puoi configurarlo.</p></div></div>
        <Link href={`/events/new?payment_id=${encodeURIComponent(availablePayment.id)}`} className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-[#d1e66a] px-5 text-xs font-semibold text-[#101314] transition hover:-translate-y-0.5 active:translate-y-px">Configura evento</Link>
      </section>}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(310px,0.7fr)]">
        <div className="relative">
          <StadiumMap active live venueName={featured?.venue_name} zoneCount={Math.max(featuredZoneCount, presence.zones.length)} deviceCount={presence.connected} />
          <Link
            href={featured ? `/events/${featured.id}/live` : "/events"}
            className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#0b0d0e] transition hover:-translate-y-0.5 active:translate-y-px"
          >
            Apri regia <ArrowUpRightIcon size={15} weight="bold" />
          </Link>
        </div>

        <div className="flex flex-col rounded-[30px] border border-white/10 bg-[#111516] p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d1e66a]">Evento in evidenza</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.045em]">{featured?.title ?? "Nessun evento"}</h2>
              <p className="mt-1 text-xs text-[#7f8785]">{featured?.venue_name ?? "Crea il primo evento"}</p>
            </div>
            <span className="flex items-center gap-2 rounded-full bg-[#d1e66a]/10 px-3 py-1.5 font-mono text-[9px] text-[#d1e66a]">
              <span className="size-1.5 rounded-full bg-[#d1e66a] breathe" /> LIVE TEST
            </span>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-7 border-y border-white/8 py-6">
            <div>
              <p className="text-[10px] text-[#717977]">Posti assegnati</p>
              <p className="mt-1 font-mono text-2xl font-semibold">{presence.connected.toLocaleString("it-IT")}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#717977]">Pacchetto pronto</p>
              <p className="mt-1 font-mono text-2xl font-semibold">{readyPercent}%</p>
            </div>
            <div>
              <p className="text-[10px] text-[#717977]">Offset medio</p>
              <p className="mt-1 font-mono text-2xl font-semibold">{presence.avg_offset_ms} ms</p>
            </div>
            <div>
              <p className="text-[10px] text-[#717977]">Settori attivi</p>
              <p className="mt-1 font-mono text-2xl font-semibold">{presence.zones.length}</p>
            </div>
          </div>

          <div className="mt-auto space-y-3 pt-6">
            <div className="flex items-center gap-3 text-xs text-[#a5adaa]">
              <CheckCircleIcon size={17} weight="fill" className="text-[#d1e66a]" /> Timeline firmata e distribuita
            </div>
            <div className="flex items-center gap-3 text-xs text-[#a5adaa]">
              <DownloadSimpleIcon size={17} className="text-[#77a4a1]" /> {Math.max(0, (featured?.venue_capacity ?? 0) - presence.ready).toLocaleString("it-IT")} dispositivi ancora attesi
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-[-0.035em]">Prossimi eventi</h2>
            <Link href="/events" className="text-xs text-[#929a98] transition hover:text-white">Vedi tutti</Link>
          </div>
          <div className="divide-y divide-white/8 border-y border-white/8">
            {upcoming.map((event) => (
              <Link key={event.name} href={event.href} className="group grid grid-cols-[1fr_auto] items-center gap-4 py-4 transition hover:pl-2">
                <div className="flex items-center gap-4">
                  <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-[#d1e66a]">
                    <CalendarBlankIcon size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">{event.name}</p>
                    <p className="mt-1 text-[11px] text-[#737b79]">{event.venue}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[10px] text-[#aab1af]">{event.date}</p>
                  <p className="mt-1 font-mono text-[9px] text-[#d1e66a]">{event.status}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#111516] p-6">
          <BroadcastIcon size={22} className="text-[#d1e66a]" />
          <h2 className="mt-5 text-xl font-semibold tracking-[-0.04em]">Rete operativa</h2>
          <p className="mt-2 text-xs leading-5 text-[#838b89]">Gateway realtime, storage e compilatore timeline rispondono normalmente.</p>
          <div className="mt-6 space-y-4">
            {["Realtime Europa", "Distribuzione media", "Worker conversione"].map((label, index) => (
              <div key={label} className="flex items-center justify-between border-t border-white/8 pt-3">
                <span className="text-xs text-[#aab1af]">{label}</span>
                <span className="font-mono text-[10px] text-[#d1e66a]">{index === 1 ? "42 ms" : "NOMINALE"}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
