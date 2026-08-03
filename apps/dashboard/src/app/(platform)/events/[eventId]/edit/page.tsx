import { EventDetailsForm } from "@/components/event-details-form";
import { PageHeader } from "@/components/page-header";
import { controlPlaneGet } from "@/lib/control-plane";

type EventDetails = Parameters<typeof EventDetailsForm>[0]["event"];

export default async function EditEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await controlPlaneGet<EventDetails>(`/v1/events/${eventId}`);
  return <div className="space-y-8"><PageHeader eyebrow="Evento" title="Dettagli e configurazione." description="Modifica i dati consentiti in base allo stato dell’evento, senza alterare accidentalmente accessi, struttura o pacchetto pubblicato." /><EventDetailsForm event={event} /></div>;
}
