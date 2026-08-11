"use client";

import { ArrowDownIcon, ArrowUpIcon, CheckCircleIcon, FlagCheckeredIcon, PathIcon, TrashIcon } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { RoutePoint } from "./parade-route-map";
import { Localized } from "./dashboard-language";

const ParadeRouteMap = dynamic(() => import("./parade-route-map"), { ssr: false, loading: () => <div className="size-full animate-pulse bg-white/[.035]" /> });

export type ParadeRouteStop = RoutePoint & {
  id: string;
  label: string;
  trigger: "manual" | "schedule" | "arrival";
  offsetMinutes?: number;
  radiusM?: number;
  enabled: boolean;
  cue: {
    durationMs: number;
    zones: string[];
    color?: string;
    text?: { it: string; en: string };
    vibration?: number[];
    torch?: boolean;
  };
};

export type ParadeRoutePolicy = {
  route?: { type: "LineString"; coordinates: number[][] };
  routeStops?: ParadeRouteStop[];
};

const fieldClass = "mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#0b0e0f] px-3 text-xs text-white outline-none focus:border-[#d1e66a]/55";

function distanceMeters(left: RoutePoint, right: RoutePoint) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLat = radians(right.latitude - left.latitude);
  const deltaLng = radians(right.longitude - left.longitude);
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude)) * Math.sin(deltaLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function ParadeRoutePlanner({ eventId, initialPolicy, fallbackCenter }: { eventId: string; initialPolicy?: ParadeRoutePolicy; fallbackCenter: RoutePoint }) {
  const initialPoints = (initialPolicy?.route?.coordinates ?? []).map(([longitude, latitude]) => ({ latitude, longitude }));
  const initialStops = initialPolicy?.routeStops?.length ? initialPolicy.routeStops : initialPoints.map((point, index) => ({
    ...point,
    id: `route-initial-${index + 1}`,
    label: index === 0 ? "Partenza" : index === initialPoints.length - 1 ? "Arrivo" : `Tappa ${index + 1}`,
    trigger: "manual" as const,
    enabled: true,
    cue: { durationMs: 5000, zones: ["*"], color: "#D1E66A", text: { it: "GUARDA LO SCHERMO", en: "LOOK AT YOUR SCREEN" } },
  }));
  const [points, setPoints] = useState<RoutePoint[]>(initialPoints);
  const [stops, setStops] = useState<ParadeRouteStop[]>(initialStops);
  const [selectedId, setSelectedId] = useState<string | undefined>(initialStops[0]?.id);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState(initialPoints.length >= 2 ? "Percorso caricato. Clicca sulla mappa per aggiungere altre tappe." : "Clicca sulla mappa nell’ordine del corteo: partenza, tappe e arrivo.");
  const selected = stops.find((stop) => stop.id === selectedId);
  const selectedIndex = selected ? stops.findIndex((stop) => stop.id === selected.id) : -1;
  const lengthM = useMemo(() => points.slice(1).reduce((total, point, index) => total + distanceMeters(points[index], point), 0), [points]);

  useEffect(() => {
    if (saveState !== "idle" || points.length === 0) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [points.length, saveState]);

  function addPoint(point: RoutePoint) {
    const id = `route-${Date.now()}-${points.length + 1}`;
    const stop: ParadeRouteStop = {
      ...point,
      id,
      label: points.length === 0 ? "Partenza" : `Tappa ${points.length + 1}`,
      trigger: "manual",
      enabled: true,
      cue: { durationMs: 5000, zones: ["*"], color: "#D1E66A", text: { it: "GUARDA LO SCHERMO", en: "LOOK AT YOUR SCREEN" } },
    };
    setPoints((current) => [...current, point]);
    setStops((current) => [...current, stop]);
    setSelectedId(id);
    setSaveState("idle");
    setMessage("Tappa aggiunta. Configura quando e cosa deve apparire.");
  }

  function updateSelected(update: (stop: ParadeRouteStop) => ParadeRouteStop) {
    setStops((current) => current.map((stop) => stop.id === selectedId ? update(stop) : stop));
    setSaveState("idle");
  }

  function removeSelected() {
    const target = selected;
    if (!target) return;
    const index = stops.findIndex((stop) => stop.id === target.id);
    setPoints((current) => current.filter((_, pointIndex) => pointIndex !== index));
    setStops((current) => current.filter((stop) => stop.id !== target.id));
    const remaining = stops.filter((stop) => stop.id !== target.id);
    setSelectedId(remaining[Math.max(0, index - 1)]?.id);
    setSaveState("idle");
    setMessage("Tappa rimossa dal percorso.");
  }

  function moveSelected(direction: -1 | 1) {
    if (!selected) return;
    const index = stops.findIndex((stop) => stop.id === selected.id);
    const target = index + direction;
    if (target < 0 || target >= stops.length) return;
    const nextStops = [...stops];
    [nextStops[index], nextStops[target]] = [nextStops[target], nextStops[index]];
    setStops(nextStops);
    setPoints(nextStops.map(({ latitude, longitude }) => ({ latitude, longitude })));
    setSaveState("idle");
  }

  async function save() {
    if (points.length < 2) {
      setSaveState("error");
      setMessage("Servono almeno due punti: una partenza e un arrivo.");
      return;
    }
    if (stops.some((stop) => !stop.label.trim())) {
      setSaveState("error");
      setMessage("Dai un nome a ogni tappa prima di salvare.");
      return;
    }
    setSaveState("saving");
    setMessage("Salvataggio del percorso e delle automazioni…");
    try {
      const response = await fetch(`/api/control/v1/events/${eventId}/route`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ route: { type: "LineString", coordinates: stops.map((stop) => [stop.longitude, stop.latitude]) }, routeStops: stops }),
      });
      const payload = await response.json().catch(() => ({}));
      setSaveState(response.ok ? "saved" : "error");
      setMessage(response.ok ? `${stops.length} tappe salvate. La regia live è pronta per gestirle.` : payload.message ?? "Percorso non salvato. Controlla i dati e riprova.");
    } catch {
      setSaveState("error");
      setMessage("Connessione assente: il percorso non è stato salvato. Riprova quando sei online.");
    }
  }

  return (
    <Localized><section className="overflow-hidden rounded-[30px] border border-[#d1e66a]/20 bg-[#111516]">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1.25fr)_410px]">
        <div className="min-w-0 border-b border-white/8 xl:border-b-0 xl:border-r">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4">
            <div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#d1e66a]">PERCORSO DEL CORTEO</p><h2 className="mt-1 text-lg font-semibold">Traccia il tragitto sulla mappa</h2></div>
            <div className="flex gap-2 text-[10px] text-[#8e9694]"><span className="rounded-full bg-white/5 px-3 py-1.5">{stops.length} tappe</span><span className="rounded-full bg-white/5 px-3 py-1.5">{lengthM >= 1000 ? `${(lengthM / 1000).toFixed(1)} km` : `${Math.round(lengthM)} m`}</span><span className={`rounded-full px-3 py-1.5 ${saveState === "saved" ? "bg-[#d1e66a]/10 text-[#d1e66a]" : saveState === "saving" ? "bg-white/5" : "bg-[#e2a65a]/10 text-[#e2a65a]"}`}>{saveState === "saved" ? "Salvato" : saveState === "saving" ? "Salvataggio…" : "Da salvare"}</span></div>
          </div>
          <div className="relative h-[430px]">
            <ParadeRouteMap center={points[0] ?? fallbackCenter} points={points} stops={stops.map((stop) => ({ ...stop, active: stop.enabled }))} selectedStopId={selectedId} onSelectStop={setSelectedId} onAdd={addPoint} />
            <div className="pointer-events-none absolute left-4 top-4 z-[500] max-w-[280px] rounded-2xl border border-white/10 bg-[#0b0d0e]/90 p-3 text-[10px] leading-4 text-[#c1c8c5] shadow-xl backdrop-blur-md"><span className="font-semibold text-white">1. Traccia il percorso:</span> clicca partenza, tappe e arrivo nell’ordine reale. <span className="text-[#d1e66a]">2. Seleziona una tappa</span> per programmare cosa apparirà.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-white/8 px-4 py-3">
            <p aria-live="polite" className="mr-auto text-[10px] text-[#8d9693]">{message}</p>
            <button type="button" disabled={points.length === 0} onClick={() => { const last = stops.at(-1); if (!last) return; setPoints((current) => current.slice(0, -1)); setStops((current) => current.slice(0, -1)); setSelectedId(stops.at(-2)?.id); setSaveState("idle"); setMessage("Ultimo punto rimosso."); }} className="rounded-full border border-white/10 px-3 py-2 text-[10px] text-[#aab2af] disabled:opacity-35">Annulla ultimo punto</button>
            <button type="button" disabled={points.length === 0} onClick={() => { if (window.confirm("Vuoi cancellare tutto il percorso e tutte le tappe?")) { setPoints([]); setStops([]); setSelectedId(undefined); setSaveState("idle"); setMessage("Percorso cancellato. Clicca sulla mappa per ricominciare."); } }} className="rounded-full border border-[#d17667]/25 px-3 py-2 text-[10px] text-[#e18a7d] disabled:opacity-35">Cancella percorso</button>
          </div>
        </div>

        <aside className="p-5">
          {!selected ? <div className="grid min-h-[420px] place-items-center text-center"><div><PathIcon size={30} className="mx-auto text-[#d1e66a]" /><h3 className="mt-4 text-base font-semibold">Aggiungi la prima tappa</h3><p className="mx-auto mt-2 max-w-[270px] text-[11px] leading-5 text-[#7f8885]">Clicca sulla mappa. Potrai decidere cosa compare e se attivarlo manualmente, a un orario o all’arrivo.</p></div></div> : <>
            <div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-[.16em] text-[#77a4a1]">MODIFICA TAPPA</p><p className="mt-1 text-[10px] text-[#707876]">Punto {selectedIndex + 1} di {stops.length}</p></div><div className="flex gap-1"><button type="button" disabled={selectedIndex <= 0} onClick={() => moveSelected(-1)} aria-label="Sposta tappa prima" title="Sposta prima" className="grid size-9 place-items-center rounded-full border border-white/10 text-[#9ca4a1] disabled:opacity-25"><ArrowUpIcon size={15} /></button><button type="button" disabled={selectedIndex < 0 || selectedIndex >= stops.length - 1} onClick={() => moveSelected(1)} aria-label="Sposta tappa dopo" title="Sposta dopo" className="grid size-9 place-items-center rounded-full border border-white/10 text-[#9ca4a1] disabled:opacity-25"><ArrowDownIcon size={15} /></button><button type="button" onClick={removeSelected} aria-label="Elimina tappa" title="Elimina tappa" className="grid size-9 place-items-center rounded-full border border-[#d17667]/25 text-[#e18a7d]"><TrashIcon size={15} /></button></div></div>

            <label className="mt-5 block"><span className="editor-label">Nome facile da riconoscere</span><input value={selected.label} onChange={(event) => updateSelected((stop) => ({ ...stop, label: event.target.value }))} className={fieldClass} placeholder="Es. Piazza del Comune" /></label>
            <label className="mt-3 block"><span className="editor-label">Quando parte l’effetto</span><select value={selected.trigger} onChange={(event) => updateSelected((stop) => ({ ...stop, trigger: event.target.value as ParadeRouteStop["trigger"], offsetMinutes: event.target.value === "schedule" ? stop.offsetMinutes ?? 10 : undefined, radiusM: event.target.value === "arrival" ? stop.radiusM ?? 60 : undefined }))} className={fieldClass}><option value="manual">Manuale · decido io dalla regia</option><option value="schedule">Programmato · dopo l’avvio</option><option value="arrival">Automatico · quando arriva il capofila</option></select></label>
            {selected.trigger === "schedule" && <label className="mt-3 block"><span className="editor-label">Minuti dopo l’avvio</span><input type="number" min={0} max={10080} value={selected.offsetMinutes ?? 0} onChange={(event) => updateSelected((stop) => ({ ...stop, offsetMinutes: Math.max(0, Number(event.target.value)) }))} className={fieldClass} /></label>}
            {selected.trigger === "arrival" && <label className="mt-3 block"><span className="editor-label">Attiva entro questo raggio · {selected.radiusM ?? 60} m</span><input type="range" min={10} max={500} step={10} value={selected.radiusM ?? 60} onChange={(event) => updateSelected((stop) => ({ ...stop, radiusM: Number(event.target.value) }))} className="mt-3 w-full accent-[#d1e66a]" /></label>}

            <div className="mt-4 grid grid-cols-[1fr_92px] gap-2"><label><span className="editor-label">Testo che compare</span><input value={selected.cue.text?.it ?? ""} onChange={(event) => updateSelected((stop) => ({ ...stop, cue: { ...stop.cue, text: { it: event.target.value, en: stop.cue.text?.en || event.target.value } } }))} className={fieldClass} /></label><label><span className="editor-label">Durata</span><input type="number" min={1} max={60} value={selected.cue.durationMs / 1000} onChange={(event) => updateSelected((stop) => ({ ...stop, cue: { ...stop.cue, durationMs: Math.max(1, Math.min(60, Number(event.target.value))) * 1000 } }))} className={fieldClass} /></label></div>
            <label className="mt-3 block"><span className="editor-label">Colore degli schermi</span><input type="color" value={selected.cue.color ?? "#D1E66A"} onChange={(event) => updateSelected((stop) => ({ ...stop, cue: { ...stop.cue, color: event.target.value } }))} className="mt-1 h-10 w-full cursor-pointer rounded-xl border border-white/10 bg-[#0b0e0f] p-1" /></label>
            <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" aria-pressed={Boolean(selected.cue.vibration)} onClick={() => updateSelected((stop) => ({ ...stop, cue: { ...stop.cue, vibration: stop.cue.vibration ? undefined : [140, 80, 140] } }))} className={`rounded-xl border p-3 text-[11px] ${selected.cue.vibration ? "border-[#d17667] bg-[#d17667]/10 text-white" : "border-white/8 text-[#8f9795]"}`}>Vibrazione {selected.cue.vibration ? "attiva" : "disattiva"}</button><button type="button" aria-pressed={Boolean(selected.cue.torch)} onClick={() => updateSelected((stop) => ({ ...stop, cue: { ...stop.cue, torch: !stop.cue.torch } }))} className={`rounded-xl border p-3 text-[11px] ${selected.cue.torch ? "border-[#e2a65a] bg-[#e2a65a]/10 text-white" : "border-white/8 text-[#8f9795]"}`}>Flash {selected.cue.torch ? "attivo" : "disattivo"}</button></div>
            <label className="mt-3 flex items-center justify-between rounded-xl border border-white/8 px-3 py-3 text-[11px] text-[#aab2af]"><span><span className="block text-white">Tappa {selected.enabled ? "attiva" : "disattivata"}</span><span className="mt-0.5 block text-[9px] text-[#707876]">Se disattivata, resta salvata ma non partirà.</span></span><input type="checkbox" checked={selected.enabled} onChange={(event) => updateSelected((stop) => ({ ...stop, enabled: event.target.checked }))} className="size-4 accent-[#d1e66a]" /></label>
          </>}

          <button type="button" onClick={() => void save()} disabled={saveState === "saving" || points.length < 2} className="image-skin mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full text-xs font-semibold text-[#0b0d0e] disabled:opacity-40" style={{ borderImageSource: "url('/buttons/primary-signal-v1.png')" }}>{saveState === "saving" ? "Salvataggio…" : saveState === "saved" ? <><CheckCircleIcon size={17} weight="fill" /> Percorso e automazioni salvati</> : <><FlagCheckeredIcon size={17} weight="fill" /> Salva percorso e automazioni</>}</button>
        </aside>
      </div>
    </section></Localized>
  );
}
