import { ArrowUpRightIcon, BuildingsIcon, MapPinIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { controlPlaneGet } from "@/lib/control-plane";
import { Localized } from "@/components/dashboard-language";

type VenueKind = "stadium" | "arena" | "concert" | "square" | "outdoor" | "fairground" | "custom";
type VenueMap = { elements?: Array<{ kind: string }> };
type Venue = { id: string; name: string; kind: VenueKind; capacity: number; map: VenueMap | string };

export default async function VenuesPage() {
  const venues = await controlPlaneGet<Venue[]>("/v1/venues");
  const accents = ["#d1e66a", "#e2a65a", "#77a4a1", "#d17667"];
  const kinds: Record<VenueKind, string> = { stadium: "Stadio", arena: "Palazzetto", concert: "Concerto", square: "Piazza", outdoor: "Area esterna", fairground: "Fiera", custom: "Personalizzata" };
  return (
    <Localized><div className="space-y-8">
      <PageHeader eyebrow="Strutture" title="Ogni posto ha coordinate precise." description="Genera una base dall'alto, poi modifica liberamente settori, righe, posti, campo, palco e ingressi." action={{ label: "Nuova struttura", href: "/venues/new" }} />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[1.3fr_0.7fr]">
        {venues.length === 0 && <div className="rounded-[30px] border border-dashed border-white/10 p-12 text-center md:col-span-2"><BuildingsIcon size={28} className="mx-auto text-[#d1e66a]" /><h2 className="mt-4 text-base font-semibold">Crea la prima struttura</h2><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[#7d8583]">L’editor guidato genera una base pronta e ti permette di modificare ogni settore, livello e posto.</p></div>}
        {venues.map((venue, index) => {
          let map: VenueMap = {};
          try { map = typeof venue.map === "string" ? JSON.parse(venue.map) as VenueMap : venue.map; } catch { map = {}; }
          const sectors = map.elements?.filter((element) => element.kind === "sector").length ?? 0;
          const accent = accents[index % accents.length];
          return (
          <Link
            key={venue.id}
            href={`/venues/${venue.id}/edit`}
            aria-label={`Modifica struttura ${venue.name}`}
            className={`group relative min-h-[270px] overflow-hidden rounded-[30px] border border-white/10 bg-[#111516] p-6 transition duration-300 hover:-translate-y-1 hover:border-white/20 active:translate-y-px ${index === 0 ? "md:row-span-2 md:min-h-[565px]" : ""}`}
          >
            <div className="absolute inset-6 rounded-[40%] border border-white/8 p-[10%] opacity-70 transition duration-500 group-hover:scale-[1.02]">
              <div className="grid size-full grid-cols-4 gap-1 rounded-[32%] border p-2" style={{ borderColor: `${accent}55` }}>
                {Array.from({ length: sectors }, (_, sector) => (
                  <span key={sector} className="rounded-md opacity-60" style={{ backgroundColor: accent }} />
                ))}
              </div>
            </div>
            <div className="relative z-[1] flex items-start justify-between">
              <span className="grid size-10 place-items-center rounded-xl border border-white/10 bg-[#0b0d0e]/70" style={{ color: accent }}><BuildingsIcon size={19} /></span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0b0d0e]/70 px-3 py-1.5 text-[10px] text-[#aab1af] transition group-hover:text-white">Modifica <ArrowUpRightIcon size={14} /></span>
            </div>
            <div className="absolute bottom-6 left-6 right-6 z-[1] rounded-2xl border border-white/10 bg-[#0b0d0e]/80 p-4 backdrop-blur-md">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.15em]" style={{ color: accent }}>{kinds[venue.kind]}</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-[-0.04em]">{venue.name}</h2>
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-[#7d8583]"><MapPinIcon size={12} /> {sectors} settori configurati</p>
                </div>
                <p className="font-mono text-xs text-[#b8bfbd]">{venue.capacity.toLocaleString("it-IT")} posti</p>
              </div>
            </div>
          </Link>
          );
        })}
      </div>
    </div></Localized>
  );
}
