"use client";

import {
  ArrowUDownLeftIcon,
  ArrowUUpRightIcon,
  BarricadeIcon,
  BoundingBoxIcon,
  CheckCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  FloppyDiskIcon,
  PathIcon,
  SelectionIcon,
  TrashIcon,
  UsersThreeIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { countSeats, polygonBounds, rectangle, type ElementKind, type VenueDocument, type VenueElement } from "@/lib/venue-types";
import { Localized } from "./dashboard-language";

type TemporaryKind = "stage" | "runway" | "barrier" | "standing-area" | "technical-area" | "accessible-area";
type SaveState = "idle" | "saving" | "saved" | "error";

const tools: Array<{ kind: TemporaryKind; label: string; note: string; icon: typeof BoundingBoxIcon }> = [
  { kind: "stage", label: "Palco", note: "Area principale dello spettacolo", icon: BoundingBoxIcon },
  { kind: "runway", label: "Passerella", note: "Estensione dentro il pubblico", icon: PathIcon },
  { kind: "standing-area", label: "Area in piedi", note: "Prato o platea non numerata", icon: UsersThreeIcon },
  { kind: "barrier", label: "Transenna", note: "Separazione e controllo flussi", icon: BarricadeIcon },
  { kind: "technical-area", label: "Area tecnica", note: "Regia, audio, sicurezza", icon: SelectionIcon },
  { kind: "accessible-area", label: "Pedana accessibile", note: "Area riservata e raggiungibile", icon: UsersThreeIcon },
];

const labels: Record<TemporaryKind, string> = {
  stage: "Palco", runway: "Passerella", barrier: "Transenna", "standing-area": "Area in piedi", "technical-area": "Area tecnica", "accessible-area": "Pedana accessibile",
};

function isTemporary(element: VenueElement) {
  return element.id.startsWith("event-");
}

function elementColor(kind: ElementKind, selected: boolean, temporary: boolean) {
  if (selected) return "#d1e66a";
  if (kind === "stage" || kind === "runway") return "#d98d6b";
  if (kind === "standing-area" || kind === "accessible-area") return "#77a4a1";
  if (kind === "barrier" || kind === "technical-area") return "#e2a65a";
  return temporary ? "#64706e" : "#30393a";
}

function elementSize(kind: TemporaryKind) {
  if (kind === "stage") return { width: 46, height: 18 };
  if (kind === "runway") return { width: 12, height: 42 };
  if (kind === "barrier") return { width: 48, height: 4 };
  if (kind === "standing-area") return { width: 44, height: 30 };
  if (kind === "accessible-area") return { width: 24, height: 14 };
  return { width: 30, height: 18 };
}

export function EventLayoutEditor({ eventId, eventTitle, venueName, initialDocument, participantLimit, readOnly = false }: { eventId: string; eventTitle: string; venueName: string; initialDocument: VenueDocument; participantLimit: number; readOnly?: boolean }) {
  const [document, setDocument] = useState(() => structuredClone(initialDocument));
  const [selectedId, setSelectedId] = useState<string>();
  const [pendingKind, setPendingKind] = useState<TemporaryKind>();
  const [past, setPast] = useState<VenueDocument[]>([]);
  const [future, setFuture] = useState<VenueDocument[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState(readOnly ? "Allestimento congelato: puoi ispezionarlo, ma non modificarlo dopo la pubblicazione." : "La pianta originale è protetta. Aggiungi solo ciò che serve a questo evento.");
  const board = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; start: { x: number; y: number }; before: VenueDocument; polygon: VenueElement["polygon"] } | undefined>(undefined);
  const selected = document.elements.find((element) => element.id === selectedId);
  const selectedBounds = selected ? polygonBounds(selected.polygon) : undefined;
  const capacity = useMemo(() => countSeats(document), [document]);
  const temporaryCount = document.elements.filter(isTemporary).length;
  const closedCount = document.elements.filter((element) => !isTemporary(element) && element.hidden).length;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function worldPoint(event: Pick<ReactPointerEvent<Element>, "clientX" | "clientY">) {
    const matrix = board.current?.getScreenCTM();
    if (!matrix) return { x: document.widthM / 2, y: document.heightM / 2 };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: Math.round(point.x), y: Math.round(point.y) };
  }

  function commit(next: VenueDocument, nextMessage?: string) {
    setPast((items) => [...items.slice(-39), document]);
    setFuture([]);
    setDocument(next);
    setSaveState("idle");
    setDirty(true);
    if (nextMessage) setMessage(nextMessage);
  }

  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [document, ...items]);
    setDocument(previous);
    setSelectedId(undefined);
    setSaveState("idle");
    setDirty(true);
    setMessage("Ultima modifica annullata.");
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items, document]);
    setDocument(next);
    setSelectedId(undefined);
    setSaveState("idle");
    setDirty(true);
    setMessage("Modifica ripristinata.");
  }

  function addAt(point: { x: number; y: number }, kind: TemporaryKind) {
    if (readOnly) return;
    const size = elementSize(kind);
    const x = Math.max(0, Math.min(document.widthM - size.width, point.x - size.width / 2));
    const y = Math.max(0, Math.min(document.heightM - size.height, point.y - size.height / 2));
    const sameKind = document.elements.filter((element) => isTemporary(element) && element.kind === kind).length;
    const element: VenueElement = {
      id: `event-${kind}-${crypto.randomUUID()}`,
      kind,
      label: `${labels[kind]} ${sameKind + 1}`,
      scope: "shared",
      polygon: rectangle(x, y, size.width, size.height),
    };
    commit({ ...document, elements: [...document.elements, element] }, `${element.label} aggiunto soltanto all'allestimento di ${eventTitle}.`);
    setSelectedId(element.id);
    setPendingKind(undefined);
  }

  function boardPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (event.target !== event.currentTarget) return;
    if (pendingKind) addAt(worldPoint(event), pendingKind);
    else setSelectedId(undefined);
  }

  function startElementPointer(event: ReactPointerEvent<SVGGElement>, element: VenueElement) {
    event.stopPropagation();
    setSelectedId(element.id);
    if (readOnly || !isTemporary(element)) return;
    drag.current = { id: element.id, start: worldPoint(event), before: document, polygon: structuredClone(element.polygon) };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveElement(event: ReactPointerEvent<SVGGElement>) {
    const active = drag.current;
    if (!active) return;
    const point = worldPoint(event);
    const dx = point.x - active.start.x;
    const dy = point.y - active.start.y;
    setDocument((current) => ({ ...current, elements: current.elements.map((element) => element.id === active.id ? { ...element, polygon: active.polygon.map((vertex) => ({ x: vertex.x + dx, y: vertex.y + dy })) } : element) }));
    setSaveState("idle");
    setDirty(true);
  }

  function endElement() {
    const active = drag.current;
    if (!active) return;
    setPast((items) => [...items.slice(-39), active.before]);
    setFuture([]);
    setMessage("Elemento spostato. La struttura originale non è stata modificata.");
    drag.current = undefined;
  }

  function updateSelected(patch: Partial<VenueElement>) {
    if (readOnly || !selected) return;
    commit({ ...document, elements: document.elements.map((element) => element.id === selected.id ? { ...element, ...patch } : element) });
  }

  function updateBounds(key: "x" | "y" | "width" | "height", value: number) {
    if (!selected || !selectedBounds || !Number.isFinite(value) || !isTemporary(selected)) return;
    const previous = selectedBounds;
    const next = { ...previous, [key]: key === "width" || key === "height" ? Math.max(.5, value) : value };
    updateSelected({ polygon: selected.polygon.map((point) => ({ x: next.x + (point.x - previous.x) / (previous.width || 1) * next.width, y: next.y + (point.y - previous.y) / (previous.height || 1) * next.height })) });
  }

  function removeSelected() {
    if (readOnly || !selected || !isTemporary(selected)) return;
    commit({ ...document, elements: document.elements.filter((element) => element.id !== selected.id) }, `${selected.label} rimosso dall'evento.`);
    setSelectedId(undefined);
  }

  function toggleZone(element: VenueElement) {
    if (readOnly || isTemporary(element)) return;
    commit({ ...document, elements: document.elements.map((item) => item.id === element.id ? { ...item, hidden: !item.hidden } : item) }, element.hidden ? `${element.label} riaperto.` : `${element.label} chiuso per questo evento.`);
  }

  function resetSetup() {
    if (readOnly) return;
    commit({ ...document, elements: document.elements.filter((element) => !isTemporary(element)).map((element) => ({ ...element, hidden: false })) }, "Allestimento temporaneo rimosso. Puoi annullare questa operazione.");
    setSelectedId(undefined);
  }

  async function save() {
    if (readOnly || !dirty) return;
    setSaveState("saving");
    setMessage("Salvataggio dell'allestimento in corso…");
    try {
      const response = await fetch(`/api/control/v1/events/${eventId}/layout`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ document }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Allestimento non salvato");
      setSaveState("saved");
      setDirty(false);
      setMessage("Allestimento salvato. La pianta principale della struttura è rimasta invariata.");
    } catch (caught) {
      setSaveState("error");
      setMessage(caught instanceof Error ? caught.message : "Allestimento non salvato");
    }
  }

  return <Localized><div className="overflow-hidden rounded-[32px] border border-white/10 bg-[#0e1213] shadow-[0_28px_90px_-40px_rgba(0,0,0,.85)]">
    <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#d1e66a]">COPIA EVENTO · STRUTTURA PROTETTA</p><h2 className="mt-1 text-lg font-semibold tracking-[-.035em]">{eventTitle} · {venueName}</h2><p className="mt-1 text-[10px] text-[#737b79]">{temporaryCount} elementi temporanei · {closedCount} zone chiuse · {capacity.toLocaleString("it-IT")} posti attivi</p></div>
      <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={undo} disabled={readOnly || !past.length} className="editor-icon" aria-label="Annulla modifica"><ArrowUDownLeftIcon size={16} /></button><button type="button" onClick={redo} disabled={readOnly || !future.length} className="editor-icon" aria-label="Ripeti modifica"><ArrowUUpRightIcon size={16} /></button><button type="button" onClick={resetSetup} disabled={readOnly || (!temporaryCount && !closedCount)} className="h-10 rounded-full border border-white/10 px-4 text-[10px] text-[#9ba3a2] transition hover:text-white active:scale-[.98] disabled:opacity-25">Ripristina base</button><button type="button" onClick={() => void save()} disabled={readOnly || !dirty || saveState === "saving"} className="flex h-10 items-center gap-2 rounded-full bg-[#d1e66a] px-4 text-xs font-semibold text-[#101314] transition active:scale-[.98] disabled:bg-white/5 disabled:text-[#697170]"><FloppyDiskIcon size={16} />{readOnly ? "Allestimento congelato" : saveState === "saving" ? "Salvataggio…" : saveState === "saved" ? "Allestimento salvato" : saveState === "error" ? "Riprova salvataggio" : "Salva allestimento"}</button></div>
    </div>

    <div className="grid xl:grid-cols-[220px_minmax(0,1fr)_300px]">
      <aside className="border-b border-white/10 p-4 xl:border-b-0 xl:border-r">
        <p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#68716f]">AGGIUNGI ALL&apos;EVENTO</p><p className="mt-2 text-[10px] leading-4 text-[#747c7a]">Scegli un elemento, poi clicca il punto esatto sulla pianta.</p>
        <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-1">{tools.map(({ kind, label, note, icon: Icon }) => <button key={kind} type="button" disabled={readOnly} onClick={() => setPendingKind((current) => current === kind ? undefined : kind)} aria-pressed={pendingKind === kind} className={`min-h-16 rounded-2xl border p-3 text-left transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-35 ${pendingKind === kind ? "border-[#d1e66a]/40 bg-[#d1e66a]/9 text-[#d1e66a]" : "border-white/8 bg-white/[.02] text-[#aab1af] hover:border-white/16"}`}><span className="flex items-center gap-2 text-[11px] font-medium"><Icon size={16} />{label}</span><span className="mt-1 block text-[8px] leading-3 text-[#68716f]">{note}</span></button>)}</div>
      </aside>

      <section className="relative min-h-[520px] overflow-hidden bg-[#0a0d0e] surface-grid">
        <div className="absolute left-4 top-4 z-[1] max-w-[calc(100%-2rem)] rounded-2xl border border-white/10 bg-[#0b0e0f]/92 px-4 py-3 backdrop-blur-xl"><p className="text-[10px] leading-4 text-[#aab1af]">{pendingKind ? `Clicca sulla pianta per inserire ${labels[pendingKind].toLowerCase()}.` : "Seleziona una zona esistente per chiuderla, oppure un elemento temporaneo per modificarlo."}</p></div>
        <svg ref={board} viewBox={`0 0 ${document.widthM} ${document.heightM}`} preserveAspectRatio="xMidYMid meet" onPointerDown={boardPointerDown} className={`absolute inset-0 size-full touch-none p-5 ${pendingKind ? "cursor-crosshair" : ""}`} aria-label="Allestimento 2D dell'evento">
          {document.elements.map((element) => {
            const active = selectedId === element.id;
            const temporary = isTemporary(element);
            const bounds = polygonBounds(element.polygon);
            return <g key={element.id} transform={`rotate(${element.rotation ?? 0} ${bounds.x + bounds.width / 2} ${bounds.y + bounds.height / 2})`} onPointerDown={(event) => startElementPointer(event, element)} onPointerMove={moveElement} onPointerUp={endElement} onPointerCancel={endElement} className={temporary ? "cursor-move" : "cursor-pointer"}>
              <polygon points={element.polygon.map((point) => `${point.x},${point.y}`).join(" ")} fill={elementColor(element.kind, active, temporary)} fillOpacity={element.hidden ? .11 : active ? .96 : temporary ? .82 : .58} stroke={element.hidden ? "#e2a65a" : active ? "#f2f3ed" : temporary ? "rgba(255,255,255,.42)" : "rgba(255,255,255,.16)"} strokeDasharray={element.hidden ? "2 1.5" : temporary ? "1.5 1" : undefined} strokeWidth={active ? .9 : .45} vectorEffect="non-scaling-stroke" />
              <text x={bounds.x + bounds.width / 2} y={bounds.y + bounds.height / 2} textAnchor="middle" dominantBaseline="middle" fill={element.hidden ? "#e2a65a" : active ? "#101314" : "#e0e5e2"} fontSize={Math.max(2.4, Math.min(5, bounds.width / 6))} fontWeight="650" pointerEvents="none">{element.hidden ? `${element.label} · CHIUSA` : element.label}</text>
            </g>;
          })}
        </svg>
      </section>

      <aside className="border-t border-white/10 bg-[#101415] p-4 xl:border-l xl:border-t-0">
        <p className={`rounded-2xl border p-3 text-[10px] leading-4 ${saveState === "error" ? "border-[#e26d5a]/25 bg-[#e26d5a]/8 text-[#f1a193]" : saveState === "saved" ? "border-[#77a4a1]/25 bg-[#77a4a1]/8 text-[#9fc7c4]" : "border-white/8 bg-white/[.02] text-[#88918f]"}`} aria-live="polite">{message}</p>
        <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-2xl border border-white/8 p-3"><p className="font-mono text-lg text-white">{capacity.toLocaleString("it-IT")}</p><p className="mt-1 text-[9px] text-[#68716f]">posti attivi</p></div><div className={`rounded-2xl border p-3 ${capacity > participantLimit ? "border-[#e26d5a]/25" : "border-white/8"}`}><p className="font-mono text-lg text-white">{participantLimit.toLocaleString("it-IT")}</p><p className="mt-1 text-[9px] text-[#68716f]">limite evento</p></div></div>

        <div className="mt-6 border-t border-white/8 pt-5"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#68716f]">ELEMENTO SELEZIONATO</p>{selected && selectedBounds ? <div className="mt-3 space-y-4"><div className="flex items-center gap-3"><span className={`grid size-9 place-items-center rounded-xl ${isTemporary(selected) ? "bg-[#d1e66a]/10 text-[#d1e66a]" : "bg-white/5 text-[#9ba3a2]"}`}>{isTemporary(selected) ? <SelectionIcon size={16} /> : <CheckCircleIcon size={16} />}</span><div><p className="text-xs font-medium text-white">{selected.label}</p><p className="mt-0.5 text-[9px] text-[#68716f]">{isTemporary(selected) ? "Allestimento temporaneo" : "Elemento della struttura protetta"}</p></div></div>
          {isTemporary(selected) ? <><label className="editor-label">Nome<input value={selected.label} onChange={(event) => updateSelected({ label: event.target.value })} className="editor-input" /></label><div className="grid grid-cols-2 gap-2">{(["x", "y", "width", "height"] as const).map((key) => <label key={key} className="editor-label">{key === "width" ? "Larghezza" : key === "height" ? "Altezza" : key.toUpperCase()}<input type="number" step="0.5" value={Math.round(selectedBounds[key] * 10) / 10} onChange={(event) => updateBounds(key, Number(event.target.value))} className="editor-input font-mono" /></label>)}</div><label className="editor-label">Rotazione<input type="number" value={selected.rotation ?? 0} onChange={(event) => updateSelected({ rotation: Number(event.target.value) })} className="editor-input font-mono" /></label><button type="button" onClick={removeSelected} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#d17667]/25 text-[10px] text-[#e79082] transition hover:bg-[#d17667]/8 active:scale-[.98]"><TrashIcon size={14} />Rimuovi dall&apos;evento</button></> : <button type="button" onClick={() => toggleZone(selected)} className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-[10px] transition active:scale-[.98] ${selected.hidden ? "border-[#77a4a1]/25 bg-[#77a4a1]/8 text-[#9fc7c4]" : "border-[#e2a65a]/25 bg-[#e2a65a]/8 text-[#e2a65a]"}`}>{selected.hidden ? <EyeIcon size={15} /> : <EyeSlashIcon size={15} />}{selected.hidden ? "Riapri zona per l'evento" : "Chiudi zona per l'evento"}</button>}
        </div> : <div className="mt-3 rounded-2xl border border-dashed border-white/10 p-4"><WarningCircleIcon size={17} className="text-[#e2a65a]" /><p className="mt-2 text-[10px] leading-4 text-[#68716f]">Seleziona un elemento sulla pianta per modificarlo o chiuderlo.</p></div>}</div>
      </aside>
    </div>
  </div></Localized>;
}
