"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarDotsIcon,
  CheckCircleIcon,
  GlobeHemisphereWestIcon,
  MapPinIcon,
  QrCodeIcon,
  SpeakerHighIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LocationPicker, type CadastralSelection } from "./location-picker";

const ParadeRouteMap = dynamic(() => import("./parade-route-map"), { ssr: false, loading: () => <div className="size-full animate-pulse bg-white/[.035]" /> });

type Layout = { id: string; name: string; capacity: number; is_default: boolean };
type Venue = { id: string; name: string; kind: string; layouts: Layout[] };
type AccessMethod = "qr" | "fixed_geofence" | "mobile_radius";
type Point = { latitude: number; longitude: number };

const kinds = [
  ["sport", "Sport"], ["concert", "Concerto"], ["festival", "Festival"],
  ["demonstration", "Manifestazione"], ["gathering", "Aggregazione"], ["parade", "Corteo"],
  ["fair", "Fiera"], ["civic", "Evento civico"], ["temporary", "Evento temporaneo"], ["other", "Altro"],
] as const;

const inputClass = "h-11 w-full rounded-xl border border-white/10 bg-[#0b0e0f] px-3.5 text-xs text-white outline-none transition placeholder:text-[#4f5655] focus:border-[#d1e66a]/55";

function squareAround(point: Point, radiusM: number) {
  const latDelta = radiusM / 111_320;
  const lngDelta = radiusM / (111_320 * Math.max(.2, Math.cos(point.latitude * Math.PI / 180)));
  return {
    type: "Polygon" as const,
    coordinates: [[
      [point.longitude - lngDelta, point.latitude - latDelta],
      [point.longitude + lngDelta, point.latitude - latDelta],
      [point.longitude + lngDelta, point.latitude + latDelta],
      [point.longitude - lngDelta, point.latitude + latDelta],
      [point.longitude - lngDelta, point.latitude - latDelta],
    ]],
  };
}

export function NewEventForm({ venues, paymentId, participantLimit }: { venues: Venue[]; paymentId: string; participantLimit: number }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<(typeof kinds)[number][0]>("sport");
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "");
  const selectedVenue = venues.find((venue) => venue.id === venueId);
  const [layoutIds, setLayoutIds] = useState<Record<string, string>>(() => Object.fromEntries(venues.map((venue) => [venue.id, venue.layouts.find((layout) => layout.is_default)?.id ?? venue.layouts[0]?.id ?? ""])));
  const layoutId = layoutIds[venueId] ?? "";
  const selectedLayout = selectedVenue?.layouts.find((layout) => layout.id === layoutId);
  const [startsAt, setStartsAt] = useState("");
  const [durationHours, setDurationHours] = useState(3);
  const [locationName, setLocationName] = useState("");
  const [point, setPoint] = useState<Point>({ latitude: 45.4781, longitude: 9.124 });
  const [cadastre, setCadastre] = useState<CadastralSelection>();
  const [useCadastre, setUseCadastre] = useState(false);
  const [methods, setMethods] = useState<AccessMethod[]>(["qr", "fixed_geofence"]);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [discoveryRadiusM, setDiscoveryRadiusM] = useState(3000);
  const [fixedRadiusM, setFixedRadiusM] = useState(350);
  const [mobileRadiusM, setMobileRadiusM] = useState(500);
  const [routePoints, setRoutePoints] = useState<Point[]>([]);
  const [audioAllowed, setAudioAllowed] = useState(true);
  const [torchAllowed, setTorchAllowed] = useState(true);
  const [coverUrl, setCoverUrl] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [program, setProgram] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setStartsAt(`${new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}T20:00`);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const hasChanges = Boolean(title || description || locationName || coverFile || coverUrl || program || routePoints.length);
    if (!hasChanges || pending) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [coverFile, coverUrl, description, locationName, pending, program, routePoints.length, title]);

  const capacityTooLarge = (selectedLayout?.capacity ?? 0) > participantLimit;
  const fixedGeometry = useMemo(() => {
    if (useCadastre && cadastre?.selected?.geometry) return cadastre.selected.geometry;
    return squareAround(point, fixedRadiusM);
  }, [cadastre, fixedRadiusM, point, useCadastre]);

  function toggleMethod(method: AccessMethod) {
    setMethods((current) => current.includes(method) ? (current.length === 1 ? current : current.filter((item) => item !== method)) : [...current, method]);
  }

  function canContinue() {
    if (step === 0) return title.trim().length >= 2 && Boolean(venueId && layoutId) && !capacityTooLarge;
    if (step === 1) return Boolean(startsAt && locationName.trim()) && methods.length > 0;
    return true;
  }

  function continueHint() {
    if (step === 0) {
      if (title.trim().length < 2) return "Inserisci il nome dell’evento.";
      if (!venueId || !layoutId) return "Scegli struttura e configurazione.";
      if (capacityTooLarge) return "Scegli una configurazione entro la capienza sbloccata.";
    }
    if (step === 1) {
      if (!locationName.trim()) return "Inserisci il nome del luogo.";
      if (!startsAt) return "Scegli data e ora di inizio.";
      if (kind === "parade" && routePoints.length === 1) return "Aggiungi almeno l’arrivo oppure annulla l’unico punto del percorso.";
    }
    return "";
  }

  async function submit() {
    setPending(true);
    setError("");
    try {
      const start = new Date(startsAt);
      if (Number.isNaN(start.getTime())) throw new Error("Data e ora di inizio non valide.");
      const accessPolicy = {
        visibility,
        methods,
        discoveryRadiusM,
        mobileRadiusM: methods.includes("mobile_radius") ? mobileRadiusM : undefined,
        fixedGeometry: methods.includes("fixed_geofence") ? fixedGeometry : undefined,
        geoZones: methods.includes("fixed_geofence") ? [{ id: "AREA-1", label: "Area evento", geometry: fixedGeometry, dwellSeconds: 8 }] : undefined,
        route: kind === "parade" && routePoints.length >= 2 ? { type: "LineString", coordinates: routePoints.map((item) => [item.longitude, item.latitude]) } : undefined,
      };
      const response = await fetch("/api/control/v1/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          venueId, layoutId, paymentId, title: title.trim(), description: description.trim(), kind,
          startsAt: start.toISOString(), endsAt: new Date(start.getTime() + durationHours * 3_600_000).toISOString(),
          locationName: locationName.trim(), coverUrl: coverUrl.trim() || null,
          program: program.split("\n").map((line) => line.trim()).filter(Boolean).map((line, index) => ({ at: `T+${index}`, title: line })),
          latitude: point.latitude, longitude: point.longitude, discoveryRadiusM, audioAllowed, torchAllowed, accessPolicy,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? payload.error ?? "Evento non creato");
      if (coverFile) {
        const form = new FormData();
        form.set("cover", coverFile);
        await fetch(`/api/control/v1/events/${payload.id}/cover`, { method: "POST", body: form });
      }
      router.push(`/events/${payload.id}/studio`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connessione assente: evento non creato. Riprova.");
      setPending(false);
    }
  }

  const steps = [
    { label: "Evento", icon: CalendarDotsIcon },
    { label: "Accesso", icon: MapPinIcon },
    { label: "Esperienza", icon: SpeakerHighIcon },
    { label: "Conferma", icon: CheckCircleIcon },
  ];

  return (
    <div className="overflow-hidden rounded-[34px] border border-white/10 bg-[#101415] shadow-[0_30px_90px_-45px_rgba(0,0,0,.9)]">
      <div className="grid border-b border-white/10 sm:grid-cols-4">
        {steps.map(({ label, icon: Icon }, index) => <button key={label} type="button" disabled={index > step} onClick={() => index < step && setStep(index)} aria-current={index === step ? "step" : undefined} className={`flex items-center gap-3 border-white/8 px-4 py-3.5 text-left transition sm:border-r ${index === step ? "bg-[#d1e66a]/8 text-[#d1e66a]" : index < step ? "text-white" : "text-[#626a68]"}`}><span className={`grid size-8 place-items-center rounded-xl border ${index <= step ? "border-[#d1e66a]/30" : "border-white/8"}`}><Icon size={16} weight={index === step ? "fill" : "regular"} /></span><span><span className="block font-mono text-[8px] uppercase tracking-[.15em]">0{index + 1}</span><span className="mt-0.5 block text-xs font-medium">{label}</span></span></button>)}
      </div>

      <div className="min-h-[590px] p-5 sm:p-7 lg:p-9">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: .22 }}>
            {step === 0 && <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px]">
              <section><p className="font-mono text-[9px] uppercase tracking-[.2em] text-[#d1e66a]">IDENTITÀ E STRUTTURA</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.045em]">Diamo forma all&apos;evento.</h2><div className="mt-7 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="editor-label">Nome evento</span><input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="Finale Luce" autoFocus /></label><label><span className="editor-label">Tipo</span><select value={kind} onChange={(event) => { const next = event.target.value as typeof kind; setKind(next); if (next === "parade") setMethods((current) => current.includes("mobile_radius") ? current : [...current, "mobile_radius"]); }} className={inputClass}>{kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="editor-label">Struttura</span><select value={venueId} onChange={(event) => setVenueId(event.target.value)} className={inputClass}>{venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select></label><label className="sm:col-span-2"><span className="editor-label">Configurazione</span><select value={layoutId} onChange={(event) => setLayoutIds((current) => ({ ...current, [venueId]: event.target.value }))} className={inputClass}>{selectedVenue?.layouts.map((layout) => <option key={layout.id} value={layout.id}>{layout.name} · {layout.capacity.toLocaleString("it-IT")} posti</option>)}</select></label><label className="sm:col-span-2"><span className="editor-label">Descrizione</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="w-full rounded-xl border border-white/10 bg-[#0b0e0f] p-3.5 text-xs leading-5 text-white outline-none focus:border-[#d1e66a]/55" placeholder="Racconta cosa vedranno i partecipanti…" /></label></div></section>
              <aside className="rounded-[28px] border border-white/8 bg-[#0b0e0f] p-5"><UsersThreeIcon size={23} className="text-[#d1e66a]" /><p className="mt-4 text-sm font-semibold">Fascia sbloccata</p><p className="mt-2 font-mono text-3xl text-[#d1e66a]">{participantLimit.toLocaleString("it-IT")}</p><p className="mt-1 text-[11px] text-[#697170]">partecipanti massimi</p>{selectedLayout && <div className="mt-6 border-t border-white/8 pt-5"><p className="text-[10px] uppercase tracking-[.15em] text-[#68716f]">CONFIGURAZIONE SCELTA</p><p className="mt-2 text-sm text-white">{selectedLayout.name}</p><p className={`mt-1 text-xs ${capacityTooLarge ? "text-[#e58a7c]" : "text-[#8f9795]"}`}>{selectedLayout.capacity.toLocaleString("it-IT")} posti</p></div>}{capacityTooLarge && <p role="alert" className="mt-4 rounded-2xl border border-[#e58a7c]/25 bg-[#e58a7c]/10 p-3 text-[11px] leading-5 text-[#eea093]">Questa configurazione supera la fascia acquistata. Scegli una configurazione più piccola o acquista la fascia corretta.</p>}</aside>
            </div>}

            {step === 1 && <div className="grid gap-7 xl:grid-cols-[minmax(0,1.2fr)_360px]">
              <section><p className="font-mono text-[9px] uppercase tracking-[.2em] text-[#d1e66a]">POSIZIONE E INGRESSO</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.045em]">Come entrano le persone?</h2><div className="mt-6"><LocationPicker latitude={point.latitude} longitude={point.longitude} onChange={(latitude, longitude) => setPoint({ latitude, longitude })} onCadastre={setCadastre} /></div>{kind === "parade" && <div className="mt-4 overflow-hidden rounded-[24px] border border-[#d1e66a]/20 bg-[#0d1112]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 p-4"><div><p className="text-xs font-semibold text-white">Traccia il percorso del corteo</p><p className="mt-1 text-[10px] text-[#7f8885]">Clicca nell’ordine: partenza, tappe e arrivo. Potrai configurare gli effetti nello studio.</p></div><span className="rounded-full bg-[#d1e66a]/10 px-3 py-1.5 text-[10px] text-[#d1e66a]">{routePoints.length} punti</span></div><div className="h-[300px]"><ParadeRouteMap center={routePoints[0] ?? point} points={routePoints} onAdd={(routePoint) => setRoutePoints((items) => [...items, routePoint])} /></div><div className="flex items-center justify-end gap-2 border-t border-white/8 p-3"><button type="button" disabled={routePoints.length === 0} onClick={() => setRoutePoints((items) => items.slice(0, -1))} className="rounded-full border border-white/10 px-3 py-2 text-[10px] text-[#aab2af] disabled:opacity-35">Annulla ultimo punto</button><button type="button" disabled={routePoints.length === 0} onClick={() => setRoutePoints([])} className="rounded-full border border-[#d17667]/25 px-3 py-2 text-[10px] text-[#e18a7d] disabled:opacity-35">Cancella percorso</button></div></div>}</section>
              <aside className="space-y-5"><label><span className="editor-label">Luogo</span><input value={locationName} onChange={(event) => setLocationName(event.target.value)} className={inputClass} placeholder="Stadio, piazza o punto di ritrovo" /></label><div className="grid grid-cols-2 gap-2"><label><span className="editor-label">Inizio</span><input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className={inputClass} /></label><label><span className="editor-label">Durata</span><select value={durationHours} onChange={(event) => setDurationHours(Number(event.target.value))} className={inputClass}><option value={2}>2 ore</option><option value={3}>3 ore</option><option value={4}>4 ore</option><option value={8}>8 ore</option><option value={12}>12 ore</option></select></label></div><div><p className="editor-label">Metodi validi</p><div className="mt-2 space-y-2"><AccessChoice active={methods.includes("qr")} onClick={() => toggleMethod("qr")} icon={QrCodeIcon} title="QR code" note="Autorità esatta per settore e posto" /><AccessChoice active={methods.includes("fixed_geofence")} onClick={() => toggleMethod("fixed_geofence")} icon={MapPinIcon} title="Area GPS fissa" note="Aggancio automatico nella macro-area" /><AccessChoice active={methods.includes("mobile_radius")} onClick={() => toggleMethod("mobile_radius")} icon={UsersThreeIcon} title="Raggio mobile" note="Segue il telefono admin, ideale per cortei" /></div></div>{methods.includes("fixed_geofence") && <div className="rounded-2xl border border-white/8 p-3"><label className="flex items-center gap-2 text-[11px] text-[#a5adaa]"><input type="checkbox" checked={useCadastre} disabled={!cadastre?.selected} onChange={(event) => setUseCadastre(event.target.checked)} className="accent-[#d1e66a]" />Usa il confine catastale selezionato</label>{!useCadastre && <label className="mt-3 block"><span className="editor-label">Raggio macro-area · {fixedRadiusM} m</span><input type="range" min={100} max={5000} step={50} value={fixedRadiusM} onChange={(event) => setFixedRadiusM(Number(event.target.value))} className="w-full accent-[#d1e66a]" /></label>}</div>}{methods.includes("mobile_radius") && <label><span className="editor-label">Raggio dal capofila · {mobileRadiusM} m</span><input type="range" min={20} max={5000} step={20} value={mobileRadiusM} onChange={(event) => setMobileRadiusM(Number(event.target.value))} className="w-full accent-[#d1e66a]" /></label>}</aside>
            </div>}

            {step === 2 && <div className="mx-auto max-w-3xl"><p className="font-mono text-[9px] uppercase tracking-[.2em] text-[#d1e66a]">ESPERIENZA PARTECIPANTE</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.045em]">Decidi cosa può attivare la regia.</h2><div className="mt-7 grid gap-4 sm:grid-cols-2"><ToggleCard active={audioAllowed} onClick={() => setAudioAllowed(!audioAllowed)} icon={SpeakerHighIcon} title="Audio e cori" note="La regia può proporli; ogni utente conserva la scelta finale." /><ToggleCard active={torchAllowed} onClick={() => setTorchAllowed(!torchAllowed)} icon={GlobeHemisphereWestIcon} title="Torcia e luce" note="Coreografie luminose sincronizzate, con consenso dell'utente." /></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label><span className="editor-label">Visibilità</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as typeof visibility)} className={inputClass}><option value="public">Pubblico · visibile nelle vicinanze</option><option value="private">Privato · accesso tramite metodi scelti</option></select></label><label><span className="editor-label">Raggio notifica · {(discoveryRadiusM / 1000).toLocaleString("it-IT")} km</span><input type="range" min={500} max={50000} step={500} value={discoveryRadiusM} onChange={(event) => setDiscoveryRadiusM(Number(event.target.value))} className="mt-4 w-full accent-[#d1e66a]" /></label><label className="sm:col-span-2"><span className="editor-label">Copertina evento · carica file</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} className="block h-12 w-full rounded-xl border border-dashed border-white/15 bg-[#0b0e0f] px-3 py-2 text-[11px] text-[#8d9693] file:mr-3 file:rounded-full file:border-0 file:bg-[#d1e66a] file:px-3 file:py-1.5 file:text-[10px] file:font-semibold file:text-[#101314]" /></label><label className="sm:col-span-2"><span className="editor-label">Oppure usa un URL immagine</span><input type="url" value={coverUrl} onChange={(event) => setCoverUrl(event.target.value)} className={inputClass} placeholder="https://…" /></label><label className="sm:col-span-2"><span className="editor-label">Programma · una voce per riga</span><textarea value={program} onChange={(event) => setProgram(event.target.value)} rows={5} className="w-full rounded-xl border border-white/10 bg-[#0b0e0f] p-3.5 text-xs leading-5 text-white outline-none focus:border-[#d1e66a]/55" placeholder={'Apertura cancelli\nInizio spettacolo\nCoreografia finale'} /></label></div></div>}

            {step === 3 && <div className="mx-auto max-w-3xl"><p className="font-mono text-[9px] uppercase tracking-[.2em] text-[#d1e66a]">RIEPILOGO</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.045em]">Pronto per entrare in regia.</h2><div className="mt-7 divide-y divide-white/8 rounded-[28px] border border-white/10 bg-[#0b0e0f] px-5"><Summary label="Evento" value={`${title} · ${kinds.find(([value]) => value === kind)?.[1]}`} /><Summary label="Struttura" value={`${selectedVenue?.name} · ${selectedLayout?.name}`} /><Summary label="Luogo" value={locationName} /><Summary label="Ingresso" value={methods.map((method) => method === "qr" ? "QR" : method === "fixed_geofence" ? "GPS fisso" : "Capofila mobile").join(" + ")} /><Summary label="Pubblico" value={`fino a ${participantLimit.toLocaleString("it-IT")} partecipanti`} /><Summary label="Controlli" value={`${audioAllowed ? "audio" : "no audio"} · ${torchAllowed ? "torcia" : "no torcia"}`} /></div><p className="mt-5 text-xs leading-5 text-[#747c7a]">Dopo la creazione apriremo lo studio: potrai caricare media, generare QR e costruire la timeline prima di pubblicare.</p></div>}
          </motion.div>
        </AnimatePresence>
      </div>

      {error && <p role="alert" className="mx-5 mb-3 rounded-2xl border border-[#e26d5a]/25 bg-[#e26d5a]/10 p-3 text-xs text-[#f1a193] sm:mx-8">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 sm:px-8"><button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0 || pending} className="flex h-10 items-center gap-2 rounded-full border border-white/10 px-4 text-xs text-[#a4acaa] transition hover:bg-white/5 disabled:opacity-25"><ArrowLeftIcon size={15} />Indietro</button>{step < 3 && continueHint() && <p className="order-3 w-full text-center text-[10px] text-[#e2a65a] sm:order-none sm:w-auto" aria-live="polite">{continueHint()}</p>}{step < 3 ? <button type="button" onClick={() => canContinue() && setStep((value) => value + 1)} disabled={!canContinue() || (kind === "parade" && step === 1 && routePoints.length === 1)} className="flex h-10 items-center gap-2 rounded-full bg-[#d1e66a] px-5 text-xs font-semibold text-[#101314] disabled:opacity-30">Continua<ArrowRightIcon size={15} weight="bold" /></button> : <button type="button" onClick={() => void submit()} disabled={pending} className="flex h-10 items-center gap-2 rounded-full bg-[#d1e66a] px-5 text-xs font-semibold text-[#101314] disabled:opacity-50">{pending ? "Creazione…" : "Crea e apri lo studio"}<ArrowRightIcon size={15} weight="bold" /></button>}</div>
    </div>
  );
}

function AccessChoice({ active, onClick, icon: Icon, title, note }: { active: boolean; onClick: () => void; icon: typeof QrCodeIcon; title: string; note: string }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${active ? "border-[#d1e66a]/35 bg-[#d1e66a]/8" : "border-white/8 bg-white/[.015]"}`}><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${active ? "bg-[#d1e66a] text-[#101314]" : "bg-white/5 text-[#777f7d]"}`}><Icon size={17} weight={active ? "bold" : "regular"} /></span><span className="min-w-0"><span className={`block text-xs font-medium ${active ? "text-white" : "text-[#858d8b]"}`}>{title}</span><span className="mt-0.5 block text-[9px] leading-4 text-[#68706f]">{note}</span></span>{active && <CheckCircleIcon size={17} weight="fill" className="ml-auto shrink-0 text-[#d1e66a]" />}</button>;
}

function ToggleCard({ active, onClick, icon: Icon, title, note }: { active: boolean; onClick: () => void; icon: typeof SpeakerHighIcon; title: string; note: string }) {
  return <button type="button" onClick={onClick} aria-pressed={active} className={`min-h-40 rounded-[26px] border p-5 text-left transition ${active ? "border-[#d1e66a]/35 bg-[#d1e66a]/8" : "border-white/10 bg-[#0b0e0f]"}`}><div className="flex items-start justify-between"><span className={`grid size-11 place-items-center rounded-2xl ${active ? "bg-[#d1e66a] text-[#101314]" : "bg-white/5 text-[#707876]"}`}><Icon size={21} weight="fill" /></span><span className={`rounded-full border px-2.5 py-1 font-mono text-[8px] ${active ? "border-[#d1e66a]/30 text-[#d1e66a]" : "border-white/8 text-[#68706f]"}`}>{active ? "CONSENTITO" : "DISATTIVO"}</span></div><p className="mt-5 text-sm font-semibold text-white">{title}</p><p className="mt-1.5 text-[11px] leading-5 text-[#747c7a]">{note}</p></button>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 py-4 sm:grid-cols-[150px_1fr]"><span className="font-mono text-[9px] uppercase tracking-[.15em] text-[#66706d]">{label}</span><span className="text-xs text-[#dce1df]">{value}</span></div>;
}
