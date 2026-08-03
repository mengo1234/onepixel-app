"use client";

import { CrosshairIcon, MapPinIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useState } from "react";

const LocationMap = dynamic(() => import("./location-map"), { ssr: false, loading: () => <div className="size-full animate-pulse bg-white/[0.035]" /> });

type Geometry = { type: string; coordinates?: number[][][] };
export type CadastralSelection = { source: Record<string, unknown>; selected?: { geometry: Geometry }; neighbors: Array<{ geometry: Geometry }> };

export function LocationPicker({ latitude, longitude, onChange, onCadastre }: { latitude: number; longitude: number; onChange: (latitude: number, longitude: number) => void; onCadastre?: (selection: CadastralSelection) => void }) {
  const [cadastre, setCadastre] = useState<CadastralSelection>();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Clicca sulla mappa per scegliere il punto e cercare la particella.");

  async function pick(lat: number, lng: number) {
    onChange(lat, lng);
    setLoading(true);
    setMessage("Ricerca del confine catastale…");
    const response = await fetch("/api/control/v1/geo/cadastre", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ latitude: lat, longitude: lng }) });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setCadastre(undefined);
      setMessage(payload.message ?? "Particella non disponibile: puoi continuare e disegnare l'area manualmente.");
      return;
    }
    setCadastre(payload);
    onCadastre?.(payload);
    const source = payload.source as { sheet?: string; parcel?: string; municipalityName?: string };
    setMessage(`Foglio ${source.sheet ?? "–"} · Particella ${source.parcel ?? "–"}${source.municipalityName ? ` · ${source.municipalityName}` : ""}`);
  }

  function locate() {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition((position) => void pick(position.coords.latitude, position.coords.longitude), () => { setLoading(false); setMessage("Posizione non disponibile. Seleziona manualmente sulla mappa."); }, { enableHighAccuracy: true, timeout: 10_000 });
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1112]">
      <div className="relative h-[330px] sm:h-[390px]">
        <LocationMap center={[latitude, longitude]} boundary={cadastre?.selected?.geometry} neighbors={cadastre?.neighbors.map((item) => item.geometry)} onPick={(lat, lng) => void pick(lat, lng)} />
        <button type="button" onClick={locate} className="absolute bottom-4 right-4 z-[500] grid size-11 place-items-center rounded-full border border-white/10 bg-[#101415]/90 text-[#d1e66a] shadow-xl backdrop-blur-xl transition active:scale-[0.97]" aria-label="Usa la posizione attuale"><CrosshairIcon size={20} weight="bold" /></button>
      </div>
      <div className="flex min-h-14 items-center gap-3 border-t border-white/10 px-4 py-3 text-xs text-[#9ba3a1]">{loading ? <SpinnerGapIcon size={17} className="shrink-0 animate-spin text-[#d1e66a]" /> : <MapPinIcon size={17} className="shrink-0 text-[#d1e66a]" />}<span>{message}</span></div>
    </div>
  );
}
