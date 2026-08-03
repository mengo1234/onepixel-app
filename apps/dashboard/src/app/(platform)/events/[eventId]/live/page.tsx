import { PageHeader } from "@/components/page-header";
import { LiveConsole } from "@/components/live-console";
import type { ParadeRoutePolicy } from "@/components/parade-route-planner";
import { controlPlaneGet } from "@/lib/control-plane";
import { notFound } from "next/navigation";

type Event = { id: string; title: string; kind: string; venue_name: string; access_policy?: ({ methods?: string[] } & ParadeRoutePolicy) | string; layout_snapshot?: { elements?: Array<{ kind: string }> } | string };

export default async function LivePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = (await controlPlaneGet<Event[]>("/v1/events")).find((item) => item.id === eventId);
  if (!event) notFound();
  const snapshot = event.layout_snapshot ? (typeof event.layout_snapshot === "string" ? JSON.parse(event.layout_snapshot) as Exclude<Event["layout_snapshot"], string> : event.layout_snapshot) : undefined;
  const accessPolicy = event.access_policy ? (typeof event.access_policy === "string" ? JSON.parse(event.access_policy) as Exclude<Event["access_policy"], string> : event.access_policy) : undefined;
  const zoneCount = snapshot?.elements?.filter((element) => ["sector", "stand", "curve", "block", "standing-area", "accessible-area"].includes(element.kind)).length ?? 0;
  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`${event.title} · Live`} title="Un gesto. Migliaia di schermi." description="Controlla copertura e sincronizzazione prima di armare la regia. Ogni comando critico resta visibile e registrato." />
      <LiveConsole eventId={eventId} eventTitle={event.title} venueName={event.venue_name} zoneCount={zoneCount} mobileRadiusEnabled={accessPolicy?.methods?.includes("mobile_radius") ?? false} routePolicy={event.kind === "parade" ? accessPolicy : undefined} />
    </div>
  );
}
