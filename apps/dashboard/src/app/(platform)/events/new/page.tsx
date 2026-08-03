import { PageHeader } from "@/components/page-header";
import { NewEventForm } from "@/components/new-event-form";
import { controlPlaneGet, controlPlanePost } from "@/lib/control-plane";
import { redirect } from "next/navigation";
import { Localized } from "@/components/dashboard-language";

type Layout = { id: string; name: string; capacity: number; is_default: boolean };
type Venue = { id: string; name: string; kind: string };
type Payment = { id: string; participant_limit: number; status: string };

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ payment_id?: string; session_id?: string }> }) {
  const { payment_id: paymentId, session_id: sessionId } = await searchParams;
  if (!paymentId) redirect("/checkout");
  const payments = await controlPlaneGet<Payment[]>("/v1/billing/payments");
  let payment = payments.find((item) => item.id === paymentId);
  if (payment?.status === "pending" && sessionId) {
    const confirmation = await controlPlanePost<{ status: string; confirmed: boolean }>("/v1/billing/confirm", { paymentId, sessionId });
    if (confirmation.confirmed) payment = { ...payment, status: confirmation.status };
  }
  if (!payment || payment.status !== "paid") redirect("/checkout?payment=pending");
  const venues = await controlPlaneGet<Venue[]>("/v1/venues");
  const venuesWithLayouts = await Promise.all(venues.map(async (venue) => ({ ...venue, layouts: await controlPlaneGet<Layout[]>(`/v1/venues/${venue.id}/layouts`) })));
  if (venuesWithLayouts.length === 0) redirect("/venues/new?return_to=event");
  return (
    <Localized><div className="space-y-8">
      <PageHeader eyebrow="Configurazione guidata" title="Crea il tuo evento, senza saltare nulla." description="Struttura, posizione, QR o GPS, capofila mobile e permessi della regia: il wizard prepara tutto prima dello studio." />
      <NewEventForm venues={venuesWithLayouts} paymentId={payment.id} participantLimit={payment.participant_limit} />
    </div></Localized>
  );
}
