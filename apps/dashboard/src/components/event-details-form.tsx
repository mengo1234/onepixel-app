"use client";

import { FloppyDiskIcon, LockKeyIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Localized } from "./dashboard-language";

type EditableEvent = {
  id: string;
  title: string;
  description?: string;
  program?: Array<{ at: string; title: string }> | string;
  location_name?: string;
  cover_url?: string;
  kind: string;
  status: "draft" | "published" | "live" | "stopped" | "completed";
  starts_at: string;
  ends_at: string;
  audio_allowed: boolean;
  torch_allowed: boolean;
  venue_name: string;
};

const inputClass = "h-11 w-full rounded-xl border border-white/10 bg-[#0b0e0f] px-3.5 text-xs text-white outline-none focus:border-[#d1e66a]/55 disabled:cursor-not-allowed disabled:opacity-45";

function localDateTime(value: string) {
  const date = new Date(value);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function EventDetailsForm({ event }: { event: EditableEvent }) {
  const router = useRouter();
  const readOnly = ["live", "stopped", "completed"].includes(event.status);
  const operationalLocked = event.status !== "draft";
  const parsedProgram = useMemo(() => {
    const value = typeof event.program === "string" ? JSON.parse(event.program) as Array<{ title?: string }> : event.program ?? [];
    return value.map((item) => item.title ?? "").filter(Boolean).join("\n");
  }, [event.program]);
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [program, setProgram] = useState(parsedProgram);
  const [locationName, setLocationName] = useState(event.location_name ?? "");
  const [coverUrl, setCoverUrl] = useState(event.cover_url ?? "");
  const [kind, setKind] = useState(event.kind);
  const [startsAt, setStartsAt] = useState(localDateTime(event.starts_at));
  const [endsAt, setEndsAt] = useState(localDateTime(event.ends_at));
  const [audioAllowed, setAudioAllowed] = useState(event.audio_allowed);
  const [torchAllowed, setTorchAllowed] = useState(event.torch_allowed);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    setPending(true);
    setMessage("");
    setError("");
    const payload = event.status === "published" ? {
      title: title.trim(), description: description.trim(), coverUrl: coverUrl.trim() || null,
      program: program.split("\n").map((line) => line.trim()).filter(Boolean).map((line, index) => ({ at: `T+${index}`, title: line })),
    } : {
      title: title.trim(), description: description.trim(), coverUrl: coverUrl.trim() || null, kind, locationName: locationName.trim(),
      startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), audioAllowed, torchAllowed,
      program: program.split("\n").map((line) => line.trim()).filter(Boolean).map((line, index) => ({ at: `T+${index}`, title: line })),
    };
    const response = await fetch(`/api/control/v1/events/${event.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) { setError(result.message ?? "Modifiche non salvate"); return; }
    setMessage("Modifiche salvate.");
    router.refresh();
  }

  return <Localized><div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#101415]"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5"><div><p className="font-mono text-[9px] uppercase tracking-[.16em] text-[#d1e66a]">{event.status}</p><h2 className="mt-1 text-lg font-semibold">{event.venue_name}</h2></div>{operationalLocked && <span className="flex items-center gap-2 rounded-full border border-[#e2a65a]/25 bg-[#e2a65a]/8 px-3 py-2 text-[10px] text-[#e2a65a]"><LockKeyIcon size={13} />{readOnly ? "Evento non modificabile" : "Dati operativi bloccati dopo la pubblicazione"}</span>}</div>
    <div className="grid gap-6 p-5 lg:grid-cols-2 lg:p-7"><div className="space-y-4"><label className="editor-label">Titolo<input value={title} disabled={readOnly} onChange={(e) => setTitle(e.target.value)} className={inputClass} /></label><label className="editor-label">Descrizione<textarea value={description} disabled={readOnly} onChange={(e) => setDescription(e.target.value)} rows={6} className="w-full rounded-xl border border-white/10 bg-[#0b0e0f] p-3.5 text-xs leading-5 text-white outline-none focus:border-[#d1e66a]/55 disabled:opacity-45" /></label><label className="editor-label">Programma, una voce per riga<textarea value={program} disabled={readOnly} onChange={(e) => setProgram(e.target.value)} rows={5} className="w-full rounded-xl border border-white/10 bg-[#0b0e0f] p-3.5 text-xs leading-5 text-white outline-none focus:border-[#d1e66a]/55 disabled:opacity-45" /></label><label className="editor-label">URL copertina<input type="url" value={coverUrl} disabled={readOnly} onChange={(e) => setCoverUrl(e.target.value)} className={inputClass} /></label></div>
      <div className="space-y-4"><label className="editor-label">Tipo<select value={kind} disabled={operationalLocked} onChange={(e) => setKind(e.target.value)} className={inputClass}><option value="sport">Sport</option><option value="concert">Concerto</option><option value="festival">Festival</option><option value="demonstration">Manifestazione</option><option value="gathering">Aggregazione</option><option value="parade">Corteo</option><option value="fair">Fiera</option><option value="civic">Evento civico</option><option value="temporary">Temporaneo</option><option value="other">Altro</option></select></label><label className="editor-label">Luogo<input value={locationName} disabled={operationalLocked} onChange={(e) => setLocationName(e.target.value)} className={inputClass} /></label><div className="grid grid-cols-2 gap-3"><label className="editor-label">Inizio<input type="datetime-local" value={startsAt} disabled={operationalLocked} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} /></label><label className="editor-label">Fine<input type="datetime-local" value={endsAt} disabled={operationalLocked} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} /></label></div><div className="grid grid-cols-2 gap-3"><button type="button" disabled={operationalLocked} onClick={() => setAudioAllowed((v) => !v)} className={`rounded-2xl border p-4 text-left text-xs ${audioAllowed ? "border-[#d1e66a]/35 bg-[#d1e66a]/8 text-[#d1e66a]" : "border-white/10 text-[#777f7d]"}`}>Audio {audioAllowed ? "consentito" : "disattivo"}</button><button type="button" disabled={operationalLocked} onClick={() => setTorchAllowed((v) => !v)} className={`rounded-2xl border p-4 text-left text-xs ${torchAllowed ? "border-[#d1e66a]/35 bg-[#d1e66a]/8 text-[#d1e66a]" : "border-white/10 text-[#777f7d]"}`}>Torcia {torchAllowed ? "consentita" : "disattiva"}</button></div><p className="rounded-2xl border border-white/8 bg-white/[.02] p-4 text-[11px] leading-5 text-[#7d8583]">QR, accessi GPS, percorso e struttura restano invariati. In bozza puoi modificare i dati operativi; dopo la pubblicazione solo contenuti editoriali.</p></div></div>
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 p-5">{error && <p role="alert" className="mr-auto text-xs text-[#e18a7d]">{error}</p>}{message && <p role="status" className="mr-auto text-xs text-[#d1e66a]">{message}</p>}<button type="button" onClick={() => void save()} disabled={pending || readOnly || title.trim().length < 2} className="flex h-11 items-center gap-2 rounded-full bg-[#d1e66a] px-5 text-xs font-semibold text-[#101314] disabled:opacity-35"><FloppyDiskIcon size={15} />{pending ? "Salvataggio…" : "Salva dettagli"}</button></div></div></Localized>;
}
