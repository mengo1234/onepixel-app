import { PageHeader } from "@/components/page-header";
import { TimelineStudio } from "@/components/timeline-studio";
import { QrIssuer } from "@/components/qr-issuer";
import { ParadeRoutePlanner, type ParadeRoutePolicy } from "@/components/parade-route-planner";
import { controlPlaneGet } from "@/lib/control-plane";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Localized } from "@/components/dashboard-language";

type Event = { id: string; title: string; kind: string; latitude: number; longitude: number; venue_id: string; venue_name: string; access_policy?: ParadeRoutePolicy | string; layout_snapshot?: { elements?: Array<{ id: string; label: string; kind: string; rows?: number; seatsPerRow?: number; seatOverrides?: Array<{ deleted?: boolean }> }> } | string };

export default async function StudioPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const events = await controlPlaneGet<Event[]>("/v1/events");
  const event = events.find((item) => item.id === eventId);
  if (!event) notFound();
  const snapshot = event.layout_snapshot ? (typeof event.layout_snapshot === "string" ? JSON.parse(event.layout_snapshot) as Exclude<Event["layout_snapshot"], string> : event.layout_snapshot) : undefined;
  const accessPolicy = event.access_policy ? (typeof event.access_policy === "string" ? JSON.parse(event.access_policy) as ParadeRoutePolicy : event.access_policy) : undefined;
  const zones = snapshot?.elements?.filter((element) => ["sector", "stand", "curve", "block", "standing-area", "accessible-area"].includes(element.kind)).map((element) => ({ id: element.id, label: element.label, seats: Math.max(0, (element.rows ?? 0) * (element.seatsPerRow ?? 0) + (element.seatOverrides?.filter((seat) => !seat.deleted).length ?? 0)) })) ?? [];
  return (
    <Localized><div className="space-y-8">
      <PageHeader eyebrow={`${event.title} · Editor effetti`} title="Crea la coreografia, un effetto alla volta." description="Scegli settori, colore e durata oppure importa un'immagine o un video. Pubblica la timeline quando l'anteprima è pronta." action={{ label: "Apri regia live", href: `/events/${eventId}/live` }} />
      <div className="flex justify-end"><Link href={`/events/${eventId}/upgrade`} className="rounded-full border border-white/12 px-4 py-2 text-xs text-[#aab1af] transition hover:border-[#d1e66a]/35 hover:text-[#d1e66a]">Aumenta capienza</Link></div>
      {event.kind === "parade" && <ParadeRoutePlanner eventId={eventId} initialPolicy={accessPolicy} fallbackCenter={{ latitude: event.latitude, longitude: event.longitude }} />}
      <TimelineStudio eventId={eventId} eventTitle={event.title} venueName={event.venue_name} zones={zones.map((zone) => zone.id)} />
      <QrIssuer eventId={eventId} zones={zones} />
    </div></Localized>
  );
}
