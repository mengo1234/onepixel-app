import { EventCheckout } from "@/components/event-checkout";
import { PageHeader } from "@/components/page-header";
import { controlPlaneGet } from "@/lib/control-plane";

type Tier = { id: "small" | "medium" | "large"; participantLimit: number; amountCents: number; label: { it: string; en: string } };

export default async function CheckoutPage() {
  const tiers = await controlPlaneGet<Tier[]>("/v1/billing/tiers");
  return <div className="space-y-8"><PageHeader eyebrow="Sblocca un evento" title="Scegli soltanto la capienza che ti serve." description="Il pagamento è simulato: nessuna carta e nessun addebito. Passi subito alla configurazione guidata e puoi provare anche l’upgrade." /><EventCheckout tiers={tiers} /></div>;
}
