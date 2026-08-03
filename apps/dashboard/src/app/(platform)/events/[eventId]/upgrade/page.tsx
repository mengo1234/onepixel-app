import { notFound } from "next/navigation";
import { EventCheckout } from "@/components/event-checkout";
import { PageHeader } from "@/components/page-header";
import { UpgradeFinalize } from "@/components/upgrade-finalize";
import { controlPlaneGet } from "@/lib/control-plane";

type Event = { id: string; title: string; participant_limit: number };
type Tier = { id: "small" | "medium" | "large"; participantLimit: number; amountCents: number; label: { it: string; en: string } };
type Payment = { id: string; status: string };

export default async function UpgradeEventPage({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams: Promise<{ payment_id?: string }> }) {
  const [{ eventId }, { payment_id: paymentId }] = await Promise.all([params, searchParams]);
  const event = (await controlPlaneGet<Event[]>("/v1/events")).find((item) => item.id === eventId);
  if (!event) notFound();
  if (paymentId) {
    const payment = (await controlPlaneGet<Payment[]>("/v1/billing/payments")).find((item) => item.id === paymentId);
    if (payment?.status === "paid") return <div className="space-y-8"><PageHeader eyebrow={event.title} title="Applico la nuova fascia." description="Lo sblocco demo è confermato; aggiorniamo il limite senza interrompere chi è già collegato." /><UpgradeFinalize eventId={eventId} paymentId={paymentId} /></div>;
  }
  const tiers = (await controlPlaneGet<Tier[]>("/v1/billing/tiers")).filter((tier) => tier.participantLimit > event.participant_limit);
  return <div className="space-y-8"><PageHeader eyebrow={`${event.title} · Upgrade`} title="Aumenta la capienza dell’evento." description={`Limite attuale: ${event.participant_limit.toLocaleString("it-IT")} partecipanti. Lo sblocco mock viene collegato soltanto a questo evento.`} /><EventCheckout tiers={tiers} successPath={`/events/${eventId}/upgrade`} cancelPath={`/events/${eventId}/studio`} /></div>;
}
