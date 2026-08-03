import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { VenueEditor } from "@/components/venue-editor";
import { controlPlaneGet } from "@/lib/control-plane";
import type { StoredLayout, StoredVenue } from "@/lib/venue-types";

export default async function EditVenuePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const venues = await controlPlaneGet<StoredVenue[]>("/v1/venues");
  const venue = venues.find((item) => item.id === venueId);
  if (!venue) notFound();
  const layouts = await controlPlaneGet<StoredLayout[]>(`/v1/venues/${venueId}/layouts`);
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Editor guidato 2D" title={`Modifica ${venue.name}.`} description="Scegli uno strumento, tocca la pianta, personalizza e salva. Livelli, tribune, righe e singoli posti restano sempre modificabili." />
      <VenueEditor initialVenue={venue} initialLayouts={layouts} />
    </div>
  );
}
