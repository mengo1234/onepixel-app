import {
  ArrowUpRightIcon,
  BroadcastIcon,
  BuildingsIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  CircleIcon,
  DownloadSimpleIcon,
  GearSixIcon,
  WarningCircleIcon,
  WaveformIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StadiumMap } from "@/components/stadium-map";
import { controlPlaneGet } from "@/lib/control-plane";
import { Localized } from "@/components/dashboard-language";

type EventStatus = "draft" | "published" | "live" | "stopped" | "completed";
type Event = {
  id: string;
  title: string;
  venue_name: string;
  venue_capacity: number;
  starts_at: string;
  ends_at?: string;
  status: EventStatus;
  package_version: number;
  layout_snapshot?: { elements?: Array<{ kind: string }> } | string;
};
type Presence = { connected: number; ready: number; avg_offset_ms: number; zones: Array<unknown> };
type Payment = { id: string; participant_limit: number; status: string; consumed_event_id?: string | null };
type Venue = { id: string };

const statusCopy: Record<EventStatus, { label: string; detail: string; className: string }> = {
  draft: { label: "Bozza", detail: "Completa effetti e accessi prima della pubblicazione.", className: "border-white/10 bg-white/5 text-[#aab1af]" },
  published: { label: "Pubblicato", detail: "Il pacchetto è pronto per prove e distribuzione.", className: "border-[#77a4a1]/25 bg-[#77a4a1]/10 text-[#9fc7c4]" },
  live: { label: "In diretta", detail: "La regia e i dispositivi sono attivi adesso.", className: "border-[#d1e66a]/30 bg-[#d1e66a]/10 text-[#d1e66a]" },
  stopped: { label: "Arrestato", detail: "L'emissione è stata fermata; controlla il report operativo.", className: "border-[#e2a65a]/30 bg-[#e2a65a]/10 text-[#e2a65a]" },
  completed: { label: "Concluso", detail: "L'evento è chiuso e i risultati sono disponibili nei report.", className: "border-white/10 bg-white/5 text-[#aab1af]" },
};

function parseSnapshot(value: Event["layout_snapshot"]) {
  if (!value) return undefined;
  try { return typeof value === "string" ? JSON.parse(value) as Exclude<Event["layout_snapshot"], string> : value; }
  catch { return undefined; }
}

function eventHref(event: Event) {
  if (event.status === "draft") return `/events/${event.id}/studio`;
  if (event.status === "published" || event.status === "live") return `/events/${event.id}/live`;
  return `/reports`;
}

function eventAction(event: Event) {
  if (event.status === "draft") return "Continua configurazione";
  if (event.status === "published") return "Apri prova e regia";
  if (event.status === "live") return "Entra nella regia live";
  return "Apri il report";
}

function eventPriority(event: Event) {
  const status = { live: 0, published: 1, draft: 2, stopped: 3, completed: 4 }[event.status];
  return status * 10 ** 15 + Math.abs(new Date(event.starts_at).getTime() - Date.now());
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ payment_id?: string; mock?: string }> }) {
  const [{ payment_id: returnedPaymentId, mock }, events, payments, venues] = await Promise.all([
    searchParams,
    controlPlaneGet<Event[]>("/v1/events"),
    controlPlaneGet<Payment[]>("/v1/billing/payments"),
    controlPlaneGet<Venue[]>("/v1/venues"),
  ]);
  const availablePayment = payments.find((payment) => payment.status === "paid" && !payment.consumed_event_id);
  if (events.length === 0 && !availablePayment) redirect("/checkout?required=1");
  const paymentJustCompleted = mock === "1" && availablePayment?.id === returnedPaymentId;
  const featured = [...events].sort((left, right) => eventPriority(left) - eventPriority(right))[0];
  const featuredSnapshot = parseSnapshot(featured?.layout_snapshot);
  const featuredZoneCount = featuredSnapshot?.elements?.filter((element) => ["sector", "stand", "curve", "block", "standing-area", "accessible-area"].includes(element.kind)).length ?? 0;
  const presence = featured && ["published", "live"].includes(featured.status)
    ? await controlPlaneGet<Presence>(`/v1/events/${featured.id}/presence`).catch(() => ({ connected: 0, ready: 0, avg_offset_ms: 0, zones: [] }))
    : { connected: 0, ready: 0, avg_offset_ms: 0, zones: [] };
  const readyPercent = presence.connected ? Math.round((presence.ready / presence.connected) * 1000) / 10 : 0;
  const upcoming = [...events].sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime()).slice(0, 5);
  const liveCount = events.filter((event) => event.status === "live").length;
  const preparationCount = events.filter((event) => event.status === "draft" || event.status === "published").length;
  const featuredStatus = featured ? statusCopy[featured.status] : undefined;
  const readiness = featured ? [
    { label: "Struttura assegnata", ready: Boolean(featured.venue_name && featuredZoneCount > 0), detail: featuredZoneCount ? `${featuredZoneCount} zone nella pianta` : "Pianta da controllare" },
    { label: "Pacchetto pubblicato", ready: featured.package_version > 0, detail: featured.package_version > 0 ? `Versione ${featured.package_version}` : "Apri lo studio e pubblica" },
    { label: "Dispositivi pronti", ready: presence.connected > 0 && presence.ready === presence.connected, detail: presence.connected > 0 ? `${presence.ready} di ${presence.connected}` : "Nessun dispositivo collegato" },
  ] : [];

  return (
    <Localized><div className="space-y-8">
      <PageHeader
        eyebrow="Centro di controllo"
        title="Prepara, verifica, poi vai in scena."
        description="Qui trovi lo stato reale di strutture, pacchetti e dispositivi. Ogni avviso indica la prossima azione da completare prima della diretta."
        action={{ label: availablePayment ? "Configura evento" : "Sblocca un evento", href: availablePayment ? `/events/new?payment_id=${encodeURIComponent(availablePayment.id)}` : "/checkout" }}
      />

      {paymentJustCompleted && availablePayment && <section role="status" className="flex flex-col gap-4 rounded-[26px] border border-[#d1e66a]/25 bg-[#d1e66a]/8 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3"><CheckCircleIcon size={22} weight="fill" className="mt-0.5 shrink-0 text-[#d1e66a]" /><div><p className="text-sm font-semibold text-white">Pagamento demo completato</p><p className="mt-1 text-xs leading-5 text-[#9da5a3]">Hai sbloccato un evento fino a {availablePayment.participant_limit.toLocaleString("it-IT")} partecipanti. Ora puoi configurarlo.</p></div></div>
        <Link href={`/events/new?payment_id=${encodeURIComponent(availablePayment.id)}`} className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-[#d1e66a] px-5 text-xs font-semibold text-[#101314] transition hover:-translate-y-0.5 active:translate-y-px">Configura evento</Link>
      </section>}

      <section aria-label="Riepilogo operativo" className="grid border-y border-white/8 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Strutture", value: venues.length, note: venues.length === 1 ? "pianta disponibile" : "piante disponibili", icon: BuildingsIcon },
          { label: "In preparazione", value: preparationCount, note: "bozze o pubblicati", icon: WaveformIcon },
          { label: "In diretta", value: liveCount, note: liveCount ? "richiedono attenzione" : "nessun evento attivo", icon: BroadcastIcon },
          { label: "Dispositivi collegati", value: presence.connected, note: featured ? `sull'evento in evidenza` : "nessun evento", icon: DownloadSimpleIcon },
        ].map(({ label, value, note, icon: Icon }, index) => <div key={label} className={`flex items-center gap-4 py-5 sm:px-5 ${index > 0 ? "sm:border-l sm:border-white/8" : ""} ${index % 2 === 0 ? "sm:border-l-0" : ""} ${index > 1 ? "border-t border-white/8 xl:border-t-0" : ""} xl:border-l xl:first:border-l-0`}><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.03] text-[#d1e66a]"><Icon size={18} /></span><div><p className="font-mono text-2xl font-semibold text-white">{value.toLocaleString("it-IT")}</p><p className="mt-0.5 text-[10px] text-[#737b79]"><span className="text-[#aab1af]">{label}</span> · {note}</p></div></div>)}
      </section>

      {featured ? <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,0.75fr)]">
        <div className="relative min-h-[390px]">
          <StadiumMap active={featured.status === "published" || featured.status === "live"} live={featured.status === "live"} venueName={featured.venue_name} zoneCount={Math.max(featuredZoneCount, presence.zones.length)} deviceCount={presence.connected} />
          <div className="absolute left-4 top-4 max-w-[calc(100%-2rem)] rounded-2xl border border-white/10 bg-[#0b0d0e]/90 p-3 backdrop-blur-md">
            <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[#d1e66a]">Evento in evidenza</p>
            <p className="mt-1 truncate text-sm font-semibold text-white">{featured.title}</p>
          </div>
          <Link href={eventHref(featured)} className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#0b0d0e] transition hover:-translate-y-0.5 active:translate-y-px">{eventAction(featured)} <ArrowUpRightIcon size={15} weight="bold" /></Link>
        </div>

        <div className="flex flex-col rounded-[30px] border border-white/10 bg-[#111516] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,.035)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#d1e66a]">Stato operativo</p><h2 className="mt-3 text-2xl font-semibold tracking-[-0.045em]">{featured.venue_name}</h2><p className="mt-1 text-xs text-[#7f8785]">{new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(featured.starts_at))}</p></div>
            <span className={`rounded-full border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.1em] ${featuredStatus?.className}`}>{featuredStatus?.label}</span>
          </div>
          <p className="mt-5 border-y border-white/8 py-4 text-xs leading-5 text-[#9ca4a2]">{featuredStatus?.detail}</p>
          <div className="divide-y divide-white/8">
            {readiness.map((item) => <div key={item.label} className="flex items-center gap-3 py-4"><span className={`grid size-8 shrink-0 place-items-center rounded-full ${item.ready ? "bg-[#d1e66a]/10 text-[#d1e66a]" : "bg-[#e2a65a]/10 text-[#e2a65a]"}`}>{item.ready ? <CheckCircleIcon size={16} weight="fill" /> : <WarningCircleIcon size={16} />}</span><div className="min-w-0 flex-1"><p className="text-xs text-white">{item.label}</p><p className="mt-1 text-[10px] text-[#737b79]">{item.detail}</p></div></div>)}
          </div>
          {presence.connected > 0 && <div className="mt-auto grid grid-cols-2 gap-4 border-t border-white/8 pt-5"><div><p className="text-[10px] text-[#717977]">Pacchetto pronto</p><p className="mt-1 font-mono text-xl font-semibold">{readyPercent}%</p></div><div><p className="text-[10px] text-[#717977]">Offset medio</p><p className="mt-1 font-mono text-xl font-semibold">{presence.avg_offset_ms} ms</p></div></div>}
        </div>
      </section> : <section className="rounded-[30px] border border-dashed border-white/12 p-10 text-left"><CalendarBlankIcon size={28} className="text-[#d1e66a]" /><h2 className="mt-4 text-lg font-semibold">Nessun evento configurato</h2><p className="mt-2 max-w-xl text-xs leading-5 text-[#7d8583]">Crea una struttura, sblocca un evento e completa il percorso guidato. La panoramica mostrerà solo dati realmente disponibili.</p><Link href={availablePayment ? `/events/new?payment_id=${encodeURIComponent(availablePayment.id)}` : "/checkout"} className="mt-5 inline-flex rounded-full bg-[#d1e66a] px-5 py-3 text-xs font-semibold text-[#101314]">Inizia configurazione</Link></section>}

      <section className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="mb-4 flex items-center justify-between"><div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#68716f]">CALENDARIO</p><h2 className="mt-1 text-lg font-semibold tracking-[-0.035em]">Eventi e prossime azioni</h2></div><Link href="/events" className="text-xs text-[#929a98] transition hover:text-white">Vedi tutti</Link></div>
          <div className="divide-y divide-white/8 border-y border-white/8">
            {upcoming.map((event) => <Link key={event.id} href={eventHref(event)} className="group grid grid-cols-[1fr_auto] items-center gap-4 py-4 transition hover:pl-2"><div className="flex min-w-0 items-center gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-[#d1e66a]"><CalendarBlankIcon size={18} /></span><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{event.title}</p><p className="mt-1 truncate text-[11px] text-[#737b79]">{event.venue_name} · {eventAction(event)}</p></div></div><div className="text-right"><p className="font-mono text-[10px] text-[#aab1af]">{new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(event.starts_at)).toUpperCase()}</p><p className="mt-1 font-mono text-[9px] text-[#d1e66a]">{statusCopy[event.status].label.toUpperCase()}</p></div></Link>)}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[#111516] p-6">
          <GearSixIcon size={22} className="text-[#d1e66a]" />
          <h2 className="mt-5 text-xl font-semibold tracking-[-0.04em]">Percorso di preparazione</h2>
          <p className="mt-2 text-xs leading-5 text-[#838b89]">Apri direttamente l&apos;area che devi completare. Nessuno stato viene dato per pronto senza dati.</p>
          <div className="mt-6 divide-y divide-white/8 border-y border-white/8">
            {[
              { href: "/venues", label: "Strutture e configurazioni", icon: BuildingsIcon },
              { href: "/events", label: "Eventi, effetti e regia", icon: WaveformIcon },
              { href: "/reports", label: "Report e risultati", icon: BroadcastIcon },
              { href: "/settings", label: "Profilo e identità", icon: GearSixIcon },
            ].map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex items-center gap-3 py-3 text-xs text-[#aab1af] transition hover:pl-1 hover:text-white"><Icon size={16} className="text-[#d1e66a]" /><span className="flex-1">{label}</span><ArrowUpRightIcon size={14} /></Link>)}
          </div>
          <p className="mt-4 flex items-center gap-2 text-[10px] text-[#707876]"><CircleIcon size={8} weight="fill" className="text-[#77a4a1]" />I dati realtime compaiono solo quando un evento è pubblicato o live.</p>
        </div>
      </section>
    </div></Localized>
  );
}
