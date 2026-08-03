import { PageHeader } from "@/components/page-header";
import { VenueEditor } from "@/components/venue-editor";

export default function NewVenuePage() {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Editor guidato 2D" title="Costruisci qualsiasi spazio dall'alto." description="Parti da una base automatica e segui i quattro passi. Puoi aggiungere livelli, tribune, palchi, righe e posti oppure importare il lotto dalla mappa." />
      <VenueEditor />
    </div>
  );
}
