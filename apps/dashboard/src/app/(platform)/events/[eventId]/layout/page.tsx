import { EventLayoutEditor } from "@/components/event-layout-editor";
import { EventWorkflowNav } from "@/components/event-workflow-nav";
import { PageHeader } from "@/components/page-header";
import { controlPlaneGet } from "@/lib/control-plane";
import { parseVenueDocument, type VenueDocument } from "@/lib/venue-types";
import { notFound } from "next/navigation";
import { Localized } from "@/components/dashboard-language";

type Event = { id: string; title: string; status: string; venue_name: string; participant_limit?: number; layout_snapshot?: VenueDocument | string };

export default async function EventLayoutPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await controlPlaneGet<Event>(`/v1/events/${eventId}`);
  if (!event?.layout_snapshot) notFound();
  const document = parseVenueDocument(event.layout_snapshot);
  return <Localized><div className="space-y-7">
    <PageHeader eyebrow={`${event.title} · Passo 2`} title="Prepara lo spazio del singolo evento." description="Aggiungi palco, passerella, platea, transenne e aree tecniche sulla copia congelata dell'evento. La struttura originale resta sempre intatta." />
    <EventWorkflowNav eventId={eventId} current="layout" status={event.status} />
    {event.status !== "draft" && <section className="rounded-[24px] border border-[#e2a65a]/25 bg-[#e2a65a]/7 p-5"><p className="font-mono text-[9px] uppercase tracking-[.16em] text-[#e2a65a]">ALLESTIMENTO CONGELATO</p><p className="mt-2 max-w-2xl text-xs leading-5 text-[#909896]">Puoi ispezionare la pianta usata da QR, dispositivi e timeline, ma non modificarla durante prove, diretta o dopo la conclusione.</p></section>}
    <EventLayoutEditor eventId={eventId} eventTitle={event.title} venueName={event.venue_name} initialDocument={document} participantLimit={event.participant_limit ?? 0} readOnly={event.status !== "draft"} />
  </div></Localized>;
}
