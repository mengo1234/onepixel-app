import { PageHeader } from "@/components/page-header";
import { LiveConsole } from "@/components/live-console";
import type { ParadeRoutePolicy } from "@/components/parade-route-planner";
import { controlPlaneGet } from "@/lib/control-plane";
import { notFound } from "next/navigation";
import { Localized } from "@/components/dashboard-language";
import { EventWorkflowNav } from "@/components/event-workflow-nav";

type Event = { id: string; title: string; kind: string; status: string; venue_name: string; access_policy?: ({ methods?: string[] } & ParadeRoutePolicy) | string; layout_snapshot?: { elements?: Array<{ kind: string; hidden?: boolean }> } | string };

export default async function LivePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = (await controlPlaneGet<Event[]>("/v1/events")).find((item) => item.id === eventId);
  if (!event) notFound();
  const snapshot = event.layout_snapshot ? (typeof event.layout_snapshot === "string" ? JSON.parse(event.layout_snapshot) as Exclude<Event["layout_snapshot"], string> : event.layout_snapshot) : undefined;
  const accessPolicy = event.access_policy ? (typeof event.access_policy === "string" ? JSON.parse(event.access_policy) as Exclude<Event["access_policy"], string> : event.access_policy) : undefined;
  const zoneCount = snapshot?.elements?.filter((element) => !element.hidden && ["sector", "stand", "curve", "block", "standing-area", "accessible-area"].includes(element.kind)).length ?? 0;
  return (
    <Localized><div className="space-y-7">
      <PageHeader eyebrow={`${event.title} · Passo 4`} title="Prova tutto, poi apri la diretta." description="Controlla copertura e sincronizzazione prima di armare la regia. Ogni comando critico resta visibile e registrato." />
      <EventWorkflowNav eventId={eventId} current="live" status={event.status} />
      <LiveConsole eventId={eventId} eventTitle={event.title} venueName={event.venue_name} zoneCount={zoneCount} mobileRadiusEnabled={accessPolicy?.methods?.includes("mobile_radius") ?? false} routePolicy={event.kind === "parade" ? accessPolicy : undefined} />
    </div></Localized>
  );
}
