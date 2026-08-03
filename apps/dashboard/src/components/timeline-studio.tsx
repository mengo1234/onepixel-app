"use client";

import { ImageIcon, MicrophoneIcon, PauseIcon, PlayIcon, SpeakerHighIcon, TrashIcon, VideoIcon, VibrateIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { StadiumMap } from "./stadium-map";

type Cue = {
  id: string;
  atMs: number;
  durationMs: number;
  zones: string[];
  color?: string;
  text?: { it: string; en: string };
  audioAsset?: string;
  vibration?: number[];
  torch?: boolean;
};
type Asset = { url: string; sha256: string; bytes: number; mimeType: string };

const palette = ["#D1E66A", "#E2A65A", "#77A4A1", "#D17667", "#F2F3ED", "#15191B"];
const trackDefinitions = [
  { label: "Colori", icon: ImageIcon, color: "#d1e66a", applies: (cue: Cue) => Boolean(cue.color) },
  { label: "Audio", icon: SpeakerHighIcon, color: "#77a4a1", applies: (cue: Cue) => Boolean(cue.audioAsset) },
  { label: "Testo", icon: MicrophoneIcon, color: "#e2a65a", applies: (cue: Cue) => Boolean(cue.text?.it || cue.text?.en) },
  { label: "Vibrazione", icon: VibrateIcon, color: "#d17667", applies: (cue: Cue) => Boolean(cue.vibration?.length || cue.torch) },
];

export function TimelineStudio({ eventId, eventTitle, venueName, zones }: { eventId: string; eventTitle: string; venueName: string; zones: string[] }) {
  const [playing, setPlaying] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [mode, setMode] = useState<"draw" | "media">("draw");
  const [publishState, setPublishState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [status, setStatus] = useState("Crea il primo effetto oppure importa un'immagine o un video.");
  const [manualCues, setManualCues] = useState<Cue[]>([]);
  const [importedCues, setImportedCues] = useState<Cue[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>(zones[0] ? [zones[0]] : ["*"]);
  const [selectedColor, setSelectedColor] = useState(palette[0]);
  const [durationSeconds, setDurationSeconds] = useState(5);
  const [textIt, setTextIt] = useState("");
  const [textEn, setTextEn] = useState("");
  const [vibration, setVibration] = useState(false);
  const [torch, setTorch] = useState(false);
  const [audioAsset, setAudioAsset] = useState<string>();
  const [audioName, setAudioName] = useState("Nessun audio");
  const [selectedCueId, setSelectedCueId] = useState<string>();
  const mediaInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const activeCues = mode === "media" ? importedCues : manualCues;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setSeconds((value) => (value >= 120 ? 0 : value + 1)), 1000);
    return () => window.clearInterval(timer);
  }, [playing]);

  const orderedCues = useMemo(() => [...activeCues].sort((left, right) => left.atMs - right.atMs), [activeCues]);
  const selectedCue = activeCues.find((cue) => cue.id === selectedCueId);

  function chooseMode(next: "draw" | "media") {
    setMode(next);
    setSelectedCueId(undefined);
    setPublishState("idle");
    setStatus(next === "draw" ? `${manualCues.length} effetti creati a mano` : `${importedCues.length} effetti generati dal media`);
  }

  function toggleZone(zone: string) {
    setSelectedZones((current) => current.includes(zone) ? current.filter((item) => item !== zone) : [...current, zone]);
  }

  function addManualCue() {
    if (selectedZones.length === 0) {
      setStatus("Seleziona almeno un settore.");
      return;
    }
    const cue: Cue = {
      id: `manual-${Date.now()}`,
      atMs: seconds * 1000,
      durationMs: durationSeconds * 1000,
      zones: selectedZones,
      color: selectedColor,
      ...(textIt || textEn ? { text: { it: textIt || textEn, en: textEn || textIt } } : {}),
      ...(audioAsset ? { audioAsset } : {}),
      ...(vibration ? { vibration: [100, 90, 100] } : {}),
      ...(torch ? { torch: true } : {}),
    };
    setManualCues((current) => [...current, cue]);
    setSelectedCueId(cue.id);
    setStatus(`Effetto aggiunto a 00:${seconds.toString().padStart(2, "0")} per ${selectedZones.join(", ")}.`);
    setPublishState("idle");
  }

  function removeCue(id: string) {
    setManualCues((current) => current.filter((cue) => cue.id !== id));
    setSelectedCueId(undefined);
    setStatus("Effetto eliminato. Ricontrolla l’anteprima prima di pubblicare.");
    setPublishState("idle");
  }

  async function publishTimeline() {
    if (activeCues.length === 0) {
      setPublishState("error");
      setStatus("La timeline è vuota: aggiungi un effetto oppure importa un'immagine o un video.");
      return;
    }
    setPublishState("saving");
    setStatus("Pubblicazione in corso…");
    try {
      const response = await fetch(`/api/control/v1/events/${eventId}/timeline`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publish: true, assets, cues: orderedCues }),
      });
      setPublishState(response.ok ? "saved" : "error");
      setStatus(response.ok ? `${orderedCues.length} effetti pubblicati e disponibili anche offline.` : "Pubblicazione non riuscita. Controlla la connessione e riprova.");
    } catch {
      setPublishState("error");
      setStatus("Connessione assente: la timeline non è stata pubblicata. Riprova quando sei online.");
    }
  }

  async function importMedia(file: File) {
    setStatus("Conversione media in corso…");
    try {
      const data = new FormData();
      data.set("file", file);
      const response = await fetch(`/api/control/v1/events/${eventId}/media`, { method: "POST", body: data });
      const payload = await response.json();
      if (!response.ok) {
        setStatus(payload.message ?? "Conversione non riuscita");
        return;
      }
      setImportedCues(payload.cues as Cue[]);
      setAssets((current) => [...current.filter((asset) => asset.url !== payload.sourceAsset.url), payload.sourceAsset as Asset]);
      setStatus(`${file.name} · ${payload.frameCount} fotogrammi · ${payload.cues.length} effetti pronti`);
      setMode("media");
      setSelectedCueId(undefined);
      setPublishState("idle");
    } catch {
      setStatus("Connessione assente: il media non è stato caricato. Riprova.");
    }
  }

  async function uploadAudio(file: File) {
    setAudioName("Caricamento audio…");
    try {
      const data = new FormData();
      data.set("file", file);
      const response = await fetch(`/api/control/v1/events/${eventId}/audio`, { method: "POST", body: data });
      const payload = await response.json();
      if (!response.ok) {
        setAudioName(payload.message ?? "Audio non caricato");
        return;
      }
      const asset = payload.asset as Asset;
      setAssets((current) => [...current.filter((item) => item.url !== asset.url), asset]);
      setAudioAsset(asset.url);
      setAudioName(file.name);
      setPublishState("idle");
    } catch {
      setAudioName("Connessione assente · riprova");
    }
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className="min-w-0 space-y-5">
        <div className="relative">
          <StadiumMap compact active={playing} venueName={venueName} zoneCount={zones.length} />
          <div className="absolute right-4 top-4 flex gap-1 rounded-full border border-white/10 bg-[#0b0d0e]/85 p-1 backdrop-blur-md">
            <button type="button" onClick={() => chooseMode("draw")} className={`rounded-full px-3 py-1.5 text-[11px] transition ${mode === "draw" ? "bg-[#d1e66a] font-semibold text-[#0b0d0e]" : "text-[#9ba3a2]"}`}>Crea effetto</button>
            <button type="button" onClick={() => chooseMode("media")} className={`rounded-full px-3 py-1.5 text-[11px] transition ${mode === "media" ? "bg-[#d1e66a] font-semibold text-[#0b0d0e]" : "text-[#9ba3a2]"}`}>Importa media</button>
          </div>
        </div>

        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#111516]">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setPlaying((value) => !value)} className="grid size-10 place-items-center rounded-full bg-[#d1e66a] text-[#0b0d0e] transition active:scale-[0.96]" aria-label={playing ? "Metti in pausa" : "Riproduci anteprima"}>{playing ? <PauseIcon size={17} weight="fill" /> : <PlayIcon size={17} weight="fill" />}</button>
              <div><p className="font-mono text-xs text-white">00:{seconds.toString().padStart(2, "0")}.00</p><p className="text-[10px] text-[#6f7775]">Durata massima 02:00</p></div>
            </div>
            <div className="flex gap-2">
              <input ref={mediaInput} type="file" accept="image/png,image/jpeg,image/gif,video/mp4,video/webm,video/quicktime" className="hidden" tabIndex={-1} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void importMedia(file); }} />
              <button type="button" disabled={publishState === "saving"} onClick={() => void publishTimeline()} className="h-9 rounded-full bg-white px-4 text-[11px] font-semibold text-[#0b0d0e] transition disabled:opacity-50 active:scale-[0.98]">{publishState === "saving" ? "Pubblicazione…" : publishState === "saved" ? "Timeline pubblicata ✓" : publishState === "error" ? "Riprova pubblicazione" : "Pubblica timeline"}</button>
            </div>
          </div>
          <div className="border-b border-white/8 px-5 py-3">
            <label className="flex items-center gap-3 text-[10px] text-[#8e9694]"><span className="w-20 shrink-0">Posizione</span><input type="range" min={0} max={120} value={seconds} onChange={(event) => { setPlaying(false); setSeconds(Number(event.target.value)); }} className="w-full accent-[#d1e66a]" aria-label="Posizione dell’anteprima in secondi" /><span className="w-10 text-right font-mono text-white">{seconds}s</span></label>
          </div>
          <div className="overflow-x-auto p-4">
            <div className="min-w-[660px] space-y-2">
              {trackDefinitions.map((track) => {
                const Icon = track.icon;
                return <div key={track.label} className="grid grid-cols-[112px_1fr] gap-3"><div className="flex items-center gap-2 text-[11px] text-[#959d9b]"><Icon size={15} style={{ color: track.color }} />{track.label}</div><div className="relative h-10 overflow-hidden rounded-lg border border-white/7 bg-[#0b0d0e]">
                  {orderedCues.filter(track.applies).map((cue) => <button key={`${track.label}-${cue.id}`} type="button" onClick={() => { setSeconds(Math.round(cue.atMs / 1000)); setSelectedCueId(cue.id); }} title="Seleziona questo effetto" aria-label={`Seleziona effetto ${track.label} a ${Math.round(cue.atMs / 1000)} secondi`} aria-pressed={selectedCueId === cue.id} className={`absolute top-1 h-7 min-w-2 rounded-md border opacity-85 transition hover:opacity-100 ${selectedCueId === cue.id ? "border-white ring-2 ring-white/70" : "border-white/10"}`} style={{ left: `${Math.min(99, cue.atMs / 1200)}%`, width: `${Math.max(1.5, cue.durationMs / 1200)}%`, backgroundColor: cue.color ?? track.color }} />)}
                  <span className="pointer-events-none absolute bottom-0 top-0 w-px bg-white" style={{ left: `${(seconds / 120) * 100}%` }} />
                </div></div>;
              })}
            </div>
          </div>
        </section>
      </div>

      <aside className="rounded-[28px] border border-white/10 bg-[#111516] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d1e66a]">{eventTitle} · 00:{seconds.toString().padStart(2, "0")}</p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.035em]">{mode === "draw" ? "Crea un effetto" : "Importa un media"}</h2>
        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[9px] text-[#88918e]"><span className="rounded-lg bg-white/[.035] px-2 py-2">1 · Configura</span><span className="rounded-lg bg-white/[.035] px-2 py-2">2 · Aggiungi</span><span className="rounded-lg bg-white/[.035] px-2 py-2">3 · Pubblica</span></div>
        <p className="mt-3 rounded-xl border border-white/8 bg-[#0b0d0e] px-3 py-2 font-mono text-[9px] leading-4 text-[#77a4a1]" aria-live="polite">{status}</p>

        {mode === "draw" && selectedCue && <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[#d1e66a]/20 bg-[#d1e66a]/7 p-3"><div className="min-w-0 flex-1"><p className="text-[11px] font-semibold text-white">Effetto selezionato · {Math.round(selectedCue.atMs / 1000)}s</p><p className="mt-1 truncate text-[9px] text-[#929a98]">{selectedCue.zones.join(", ")} · durata {selectedCue.durationMs / 1000}s</p></div><button type="button" onClick={() => removeCue(selectedCue.id)} className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[#d17667]/30 px-3 text-[10px] text-[#e79082]"><TrashIcon size={14} /> Elimina</button></div>}

        {mode === "draw" ? <>
          <p className="mt-5 text-[11px] font-medium text-[#b8bfbd]">Settori destinatari</p>
          <div className="mt-2 grid max-h-28 grid-cols-4 gap-1.5 overflow-y-auto">{zones.map((zone) => <button key={zone} type="button" onClick={() => toggleZone(zone)} aria-pressed={selectedZones.includes(zone)} className={`rounded-lg px-2 py-2 font-mono text-[9px] ${selectedZones.includes(zone) ? "bg-[#d1e66a] font-semibold text-[#0b0d0e]" : "bg-white/5 text-[#8f9795]"}`}>{zone}</button>)}</div>

          <p className="mt-5 text-[11px] font-medium text-[#b8bfbd]">Colore schermi</p>
          <div className="mt-2 grid grid-cols-6 gap-2">{palette.map((color) => <button type="button" key={color} onClick={() => setSelectedColor(color)} aria-pressed={selectedColor === color} className={`aspect-square rounded-xl transition hover:scale-[1.04] ${selectedColor === color ? "ring-2 ring-white ring-offset-2 ring-offset-[#111516]" : ""}`} style={{ backgroundColor: color }} aria-label={`Seleziona colore ${color}`} />)}</div>

          <div className="mt-5 grid grid-cols-[1fr_86px] gap-2"><label><span className="text-[10px] text-[#8f9795]">Testo italiano</span><input value={textIt} onChange={(event) => setTextIt(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#0b0d0e] px-3 text-xs outline-none focus:border-[#d1e66a]/60" /></label><label><span className="text-[10px] text-[#8f9795]">Durata s</span><input type="number" min={1} max={60} value={durationSeconds} onChange={(event) => setDurationSeconds(Math.max(1, Math.min(60, Number(event.target.value))))} className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#0b0d0e] px-3 font-mono text-xs outline-none" /></label></div>
          <label className="mt-2 block"><span className="text-[10px] text-[#8f9795]">Testo inglese</span><input value={textEn} onChange={(event) => setTextEn(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#0b0d0e] px-3 text-xs outline-none focus:border-[#d1e66a]/60" /></label>

          <input ref={audioInput} type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/aac" className="hidden" tabIndex={-1} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void uploadAudio(file); }} />
          <button type="button" onClick={() => audioInput.current?.click()} className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-3 text-left transition hover:border-white/20"><span className="grid size-9 place-items-center rounded-xl bg-[#252b2d] text-[#77a4a1]"><SpeakerHighIcon size={17} /></span><span><span className="block text-xs font-medium text-white">Carica coro o traccia audio</span><span className="mt-0.5 block max-w-[240px] truncate text-[10px] text-[#737b79]">{audioName}</span></span></button>

          <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setVibration((value) => !value)} aria-pressed={vibration} className={`rounded-xl border p-3 text-xs ${vibration ? "border-[#d17667] bg-[#d17667]/10 text-white" : "border-white/8 text-[#8f9795]"}`}><VibrateIcon size={16} className="mx-auto mb-1" />Vibrazione {vibration ? "attiva" : "disattiva"}</button><button type="button" onClick={() => setTorch((value) => !value)} aria-pressed={torch} className={`rounded-xl border p-3 text-xs ${torch ? "border-[#e2a65a] bg-[#e2a65a]/10 text-white" : "border-white/8 text-[#8f9795]"}`}><ImageIcon size={16} className="mx-auto mb-1" />Flash {torch ? "attivo" : "disattivo"}</button></div>
          <button type="button" onClick={addManualCue} className="image-skin mt-4 h-11 w-full rounded-full text-xs font-semibold text-[#0b0d0e]" style={{ borderImageSource: "url('/buttons/primary-signal-v1.png')" }}>Aggiungi effetto alla timeline</button>
        </> : <div className="mt-6 rounded-2xl border border-white/8 bg-white/[0.025] p-5 text-center"><VideoIcon size={25} className="mx-auto text-[#d1e66a]" /><p className="mt-3 text-xs text-[#b8bfbd]">{importedCues.length ? `${importedCues.length} effetti pronti` : "Scegli un'immagine, una GIF o un video: verrà trasformato automaticamente in effetti sincronizzati."}</p><button type="button" onClick={() => mediaInput.current?.click()} className="mt-4 rounded-full bg-[#d1e66a] px-4 py-2 text-[11px] font-semibold text-[#101314]">Scegli immagine o video</button></div>}
      </aside>
    </div>
  );
}
