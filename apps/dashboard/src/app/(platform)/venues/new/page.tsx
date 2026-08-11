import { PageHeader } from "@/components/page-header";
import { VenueEditor } from "@/components/venue-editor";
import { Localized } from "@/components/dashboard-language";

export default function NewVenuePage() {
  return (
    <Localized><div className="space-y-8">
      <PageHeader eyebrow="Struttura · configurazione guidata" title="Costruisci il luogo una volta sola." description="Scegli il tipo di spazio fisico, inserisci misure e capienza, quindi lascia che onePixel generi la base. Gli allestimenti temporanei verranno preparati dentro ogni evento." />
      <VenueEditor />
    </div></Localized>
  );
}
