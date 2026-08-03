"use client";

import {
  BroadcastIcon,
  CheckCircleIcon,
  LightningIcon,
  MapPinIcon,
  ShieldWarningIcon,
  SpeakerHighIcon,
  StopIcon,
  VibrateIcon,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StadiumMap } from "./stadium-map";
import type { ParadeRoutePolicy, ParadeRouteStop } from "./parade-route-planner";

const ParadeRouteMap = dynamic(() => import("./parade-route-map"), { ssr: false, loading: () => <div className="size-full animate-pulse bg-white/[.035]" /> });

type Presence = { connected: number; ready: number; avg_offset_ms: number; websocketConnections: number; zones: Array<{ zone_id: string; connected: number; ready: number }> };

function metersBetween(left: { latitude: number; longitude: number }, right: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLat = radians(right.latitude - left.latitude);
  const deltaLng = radians(right.longitude - left.longitude);
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude)) * Math.sin(deltaLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function LiveConsole({ eventId, eventTitle, venueName, zoneCount, mobileRadiusEnabled = false, routePolicy }: { eventId: string; eventTitle: string; venueName: string; zoneCount: number; mobileRadiusEnabled?: boolean; routePolicy?: ParadeRoutePolicy }) {
  const [armed, setArmed] = useState(false);
  const [live, setLive] = useState(false);
  const [lastCommand, setLastCommand] = useState("Nessun comando inviato");
  const [presence, setPresence] = useState<Presence>({ connected: 0, ready: 0, avg_offset_ms: 0, websocketConnections: 0, zones: [] });
  const [error, setError] = useState("");
  const [leaderActive, setLeaderActive] = useState(false);
  const [leaderStatus, setLeaderStatus] = useState("Capofila non attivo");
  const [leaderPosition, setLeaderPosition] = useState<{ latitude: number; longitude: number }>();
  const [routeStops, setRouteStops] = useState<ParadeRouteStop[]>(routePolicy?.routeStops ?? []);
  const [completedStops, setCompletedStops] = useState<Set<string>>(() => new Set());
  const [queuedStops, setQueuedStops] = useState<Set<string>>(() => new Set());
  const routePoints = useMemo(() => (routePolicy?.route?.coordinates ?? []).map(([longitude, latitude]) => ({ latitude, longitude })), [routePolicy?.route?.coordinates]);

  const refreshPresence = useCallback(async () => {
    const response = await fetch(`/api/control/v1/events/${eventId}/presence`, { cache: "no-store" });
    if (response.ok) setPresence(await response.json());
  }, [eventId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refreshPresence(), 0);
    const timer = window.setInterval(() => void refreshPresence(), 3000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refreshPresence]);

  useEffect(() => {
    if (!leaderActive || !navigator.geolocation) return;
    const inFlightStops = new Set<string>();
    const watchId = navigator.geolocation.watchPosition(async (position) => {
      const current = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setLeaderPosition(current);
      const response = await fetch(`/api/control/v1/events/${eventId}/leader/location`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracyM: position.coords.accuracy }) });
      setLeaderStatus(response.ok ? `Posizione inviata · precisione ${Math.round(position.coords.accuracy)} m` : "Posizione non inviata");
      if (response.ok && live) {
        for (const stop of routeStops.filter((item) => item.enabled && item.trigger === "arrival" && !completedStops.has(item.id) && !inFlightStops.has(item.id))) {
          if (metersBetween(current, stop) <= (stop.radiusM ?? 60)) {
            inFlightStops.add(stop.id);
            const cue = { id: `route-${stop.id}-${Date.now()}`, atMs: 0, ...stop.cue };
            void fetch(`/api/control/v1/events/${eventId}/commands`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "cue", cue }) }).then(async (commandResponse) => {
              const payload = await commandResponse.json();
              if (!commandResponse.ok) { inFlightStops.delete(stop.id); setError(payload.message ?? "Effetto automatico non inviato"); return; }
              setLastCommand(`Arrivo a ${stop.label} · sequenza ${payload.command.sequence} · ${payload.delivered} device live`);
              setCompletedStops((completed) => new Set(completed).add(stop.id));
            });
          }
        }
      }
    }, (failure) => { setLeaderStatus(failure.message); setLeaderActive(false); }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 12_000 });
    return () => navigator.geolocation.clearWatch(watchId);
  }, [completedStops, eventId, leaderActive, live, routeStops]);

  async function sendCommand(type: "start" | "cue" | "stop", label: string, cue?: Record<string, unknown>, executeAt?: string) {
    setError("");
    const response = await fetch(`/api/control/v1/events/${eventId}/commands`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, cue, executeAt, reason: type === "stop" ? "Arresto manuale dalla regia" : undefined }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.message ?? "Comando non inviato");
      return false;
    }
    setLastCommand(`${label} · sequenza ${payload.command.sequence} · ${payload.delivered} device live`);
    return true;
  }

  async function triggerStop(stop: ParadeRouteStop, label = stop.label, executeAt?: string) {
    const cue = { id: `route-${stop.id}-${Date.now()}`, atMs: 0, ...stop.cue };
    const sent = await sendCommand("cue", label, cue, executeAt);
    if (sent && !executeAt) setCompletedStops((current) => new Set(current).add(stop.id));
    return sent;
  }

  async function queueScheduledStops(startedAt: number) {
    const scheduled = routeStops.filter((stop) => stop.enabled && stop.trigger === "schedule" && !queuedStops.has(stop.id));
    for (const stop of scheduled) {
      const executeAt = new Date(startedAt + (stop.offsetMinutes ?? 0) * 60_000).toISOString();
      if (await triggerStop(stop, `${stop.label} programmata`, executeAt)) setQueuedStops((current) => new Set(current).add(stop.id));
    }
  }

  async function toggleStop(stop: ParadeRouteStop) {
    const nextStops = routeStops.map((item) => item.id === stop.id ? { ...item, enabled: !item.enabled } : item);
    setRouteStops(nextStops);
    const response = await fetch(`/api/control/v1/events/${eventId}/route`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ route: routePolicy?.route ?? null, routeStops: nextStops }) });
    if (!response.ok) {
      setRouteStops(routeStops);
      setError("Modifica della tappa non salvata");
    }
  }

  async function stopEverything() {
    if (!(await sendCommand("stop", "Arresto generale inviato"))) return;
    setLive(false);
    setArmed(false);
    setQueuedStops(new Set());
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        {routePoints.length >= 2 ? <section className="overflow-hidden rounded-[28px] border border-[#d1e66a]/20 bg-[#111516]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4"><div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#d1e66a]">CORTEO IN TEMPO REALE</p><h2 className="mt-1 text-lg font-semibold">Percorso e posizione del capofila</h2></div><span className="rounded-full bg-white/5 px-3 py-1.5 text-[10px] text-[#aab2af]">{completedStops.size} di {routeStops.filter((stop) => stop.enabled).length} tappe eseguite</span></div><div className="h-[440px]"><ParadeRouteMap center={routePoints[0]} points={routePoints} stops={routeStops.map((stop) => ({ ...stop, active: stop.enabled, completed: completedStops.has(stop.id) }))} leader={leaderPosition} /></div></section> : <StadiumMap active={live} live={live} venueName={venueName} zoneCount={Math.max(zoneCount, presence.zones.length)} deviceCount={presence.connected} />}
        <div className="grid gap-px overflow-hidden rounded-[26px] border border-white/10 bg-white/10 sm:grid-cols-3">
          {[
            ["Dispositivi", presence.connected.toLocaleString("it-IT"), `${presence.websocketConnections} connessioni realtime`],
            ["Sincronizzazione", `± ${presence.avg_offset_ms} ms`, "offset medio assoluto"],
            ["Pacchetto pronto", presence.connected ? `${Math.round((presence.ready / presence.connected) * 1000) / 10}%` : "0%", `${presence.ready} dispositivi pronti`],
          ].map(([label, value, detail]) => (
            <div key={label} className="bg-[#111516] p-5">
              <p className="text-[11px] text-[#78807e]">{label}</p>
              <p className="mt-2 font-mono text-2xl font-semibold tracking-[-0.04em] text-white">{value}</p>
              <p className="mt-1 text-[10px] text-[#8e9694]">{detail}</p>
            </div>
          ))}
        </div>
        {routeStops.length > 0 && <section className="rounded-[28px] border border-white/10 bg-[#111516] p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#77a4a1]">TAPPE ED EFFETTI</p><h2 className="mt-1 text-lg font-semibold">Gestisci cosa appare lungo il percorso</h2><p className="mt-2 text-[11px] text-[#7e8784]">Puoi lanciare subito, mettere in pausa una tappa o riarmarla senza fermare il corteo.</p></div><div className="flex gap-2"><button type="button" onClick={() => { setCompletedStops(new Set()); setQueuedStops(new Set()); }} className="rounded-full border border-white/10 px-3 py-2 text-[10px] text-[#aab2af]">Riattiva tutte</button><Link href={`/events/${eventId}/studio`} className="rounded-full border border-[#d1e66a]/25 px-3 py-2 text-[10px] text-[#d1e66a]">Modifica percorso</Link></div></div><div className="mt-4 grid gap-2 md:grid-cols-2">{routeStops.map((stop, index) => { const done = completedStops.has(stop.id); const queued = queuedStops.has(stop.id); const triggerLabel = stop.trigger === "arrival" ? `Automatico entro ${stop.radiusM ?? 60} m` : stop.trigger === "schedule" ? `Al minuto ${stop.offsetMinutes ?? 0}` : "Manuale"; return <article key={stop.id} className={`rounded-2xl border p-4 ${stop.enabled ? done ? "border-[#77a4a1]/35 bg-[#77a4a1]/[.06]" : "border-white/8 bg-[#0b0d0e]" : "border-white/5 bg-white/[.015] opacity-60"}`}><div className="flex items-start gap-3"><span className={`grid size-8 shrink-0 place-items-center rounded-full font-mono text-[10px] ${done ? "bg-[#77a4a1] text-[#0b0d0e]" : "bg-white/5 text-[#d1e66a]"}`}>{done ? <CheckCircleIcon size={16} weight="fill" /> : index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{stop.label}</p><p className="mt-1 text-[10px] text-[#7f8885]">{queued ? "Programmato e inviato ai dispositivi" : done ? "Effetto già eseguito" : triggerLabel}</p></div><button type="button" onClick={() => void toggleStop(stop)} className={`rounded-full px-2.5 py-1.5 text-[9px] ${stop.enabled ? "bg-[#d1e66a]/10 text-[#d1e66a]" : "bg-white/5 text-[#8b9391]"}`}>{stop.enabled ? "Attiva" : "In pausa"}</button></div><button type="button" disabled={!live || !stop.enabled} onClick={() => void triggerStop(stop, `${stop.label} avviata ora`)} className="mt-3 h-9 w-full rounded-full border border-white/10 text-[10px] font-semibold text-white transition hover:border-[#d1e66a]/30 disabled:cursor-not-allowed disabled:opacity-35">Avvia effetto adesso</button></article>; })}</div></section>}
      </div>

      <aside className="space-y-4">
        {mobileRadiusEnabled && <section className="rounded-[28px] border border-[#77a4a1]/20 bg-[#77a4a1]/[.045] p-5"><div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[9px] uppercase tracking-[.16em] text-[#77a4a1]">CAPOFILA MOBILE</p><h2 className="mt-2 text-base font-semibold">Questo telefono è l&apos;aggancio</h2><p className="mt-2 text-[10px] leading-4 text-[#818987]">Chi entra nel raggio resta associato anche quando si allontana. Se la rete cade, rimane valida l&apos;ultima posizione.</p></div><span className={`mt-1 size-2.5 shrink-0 rounded-full ${leaderActive ? "bg-[#d1e66a] breathe" : "bg-[#535b59]"}`} /></div><button type="button" onClick={() => setLeaderActive((value) => !value)} className={`mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full text-xs font-semibold ${leaderActive ? "border border-white/12 text-white" : "bg-[#77a4a1] text-[#101314]"}`}><MapPinIcon size={16} weight="fill" />{leaderActive ? "Ferma capofila" : "Avvia capofila"}</button><p className="mt-3 text-center font-mono text-[8px] text-[#77807e]">{leaderStatus.toUpperCase()}</p></section>}
        <section className="rounded-[28px] border border-white/10 bg-[#111516] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#d1e66a]">Regia live</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.035em]">{eventTitle}</h2>
            </div>
            <span className={`size-2.5 rounded-full ${live ? "bg-[#d1e66a] breathe" : "bg-[#4c5352]"}`} />
          </div>

          <div className="mt-6 rounded-2xl border border-white/8 bg-[#0b0d0e] p-4">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#68706e]">Ultimo comando</p>
            <p className="mt-2 text-sm text-white">{lastCommand}</p>
          </div>
          {error && <p role="alert" className="mt-3 rounded-xl border border-[#e26d5a]/25 bg-[#e26d5a]/10 px-3 py-2 text-[11px] text-[#f08a79]">{error}</p>}

          {!armed ? (
            <button type="button" onClick={() => setArmed(true)} className="image-skin mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-[#0b0d0e] transition hover:-translate-y-0.5 active:translate-y-px" style={{ borderImageSource: "url('/buttons/primary-signal-v1.png')" }}>
              <ShieldWarningIcon size={18} weight="bold" /> Arma la regia
            </button>
          ) : (
            <button type="button" disabled={live} onClick={async () => { const startedAt = Date.now(); if (await sendCommand("start", "Sequenza live avviata")) { setLive(true); await queueScheduledStops(startedAt); } }} className="image-skin mt-4 flex h-13 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-[#0b0d0e] transition hover:-translate-y-0.5 active:translate-y-px disabled:cursor-default disabled:opacity-65" style={{ borderImageSource: "url('/buttons/neutral-paper-v1.png')" }}>
              <BroadcastIcon size={18} weight="fill" /> {live ? "Trasmissione attiva" : "Avvia trasmissione"}
            </button>
          )}
        </section>

        <section className="rounded-[28px] border border-white/10 bg-[#111516] p-5">
          <p className="text-xs font-medium text-[#aab1af]">Comandi immediati</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              [LightningIcon, "Flash", "#0b0d0e", "/buttons/primary-signal-v1.png"],
              [SpeakerHighIcon, "Audio", "#0b0d0e", "/buttons/audio-teal-v1.png"],
              [VibrateIcon, "Vibra", "#0b0d0e", "/buttons/live-amber-v1.png"],
              [BroadcastIcon, "Colore", "#0b0d0e", "/buttons/emergency-coral-v1.png"],
            ].map(([Icon, label, color, skin]) => (
              <button
                key={label as string}
                type="button"
                disabled={!live}
                onClick={() => {
                  const cue = {
                    id: `live-${(label as string).toLowerCase()}-${Date.now()}`,
                    atMs: 0,
                    durationMs: 1200,
                    zones: ["*"],
                    color: label === "Colore" || label === "Flash" ? "#D1E66A" : undefined,
                    torch: label === "Flash" ? true : undefined,
                    vibration: label === "Vibra" ? [140, 80, 140] : undefined,
                    text: label === "Audio" ? { it: "CORO ORA", en: "CHANT NOW" } : undefined,
                  };
                  void sendCommand("cue", `${label as string} inviato a tutti`, cue);
                }}
                className="image-skin image-skin-card flex min-h-24 flex-col items-start justify-between rounded-2xl p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-35 active:scale-[0.98]"
                style={{ borderImageSource: `url('${skin as string}')` }}
              >
                <Icon size={19} style={{ color: color as string }} />
                <span className="text-xs font-medium text-white">{label as string}</span>
              </button>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={stopEverything}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-[20px] border border-[#e26d5a]/40 bg-[#e26d5a]/10 text-sm font-semibold text-[#f08a79] transition hover:bg-[#e26d5a]/20 active:scale-[0.98]"
        >
          <StopIcon size={20} weight="fill" /> Arresto generale
        </button>
      </aside>
    </div>
  );
}
