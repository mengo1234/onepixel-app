"use client";

import {
  ArrowCounterClockwiseIcon,
  ArrowUDownLeftIcon,
  ArrowUUpRightIcon,
  BarricadeIcon,
  BoundingBoxIcon,
  BuildingsIcon,
  CaretDownIcon,
  ChairIcon,
  CopyIcon,
  DoorOpenIcon,
  EyeIcon,
  EyeSlashIcon,
  FloppyDiskIcon,
  GridFourIcon,
  LockIcon,
  MapPinIcon,
  PathIcon,
  PencilSimpleLineIcon,
  PlusIcon,
  SelectionIcon,
  StairsIcon,
  TrashIcon,
  UsersThreeIcon,
  XIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { LocationPicker, type CadastralSelection } from "./location-picker";
import { countSeats, generateVenueDocument, pointInLocalPolygon, polygonBounds, projectGeoBoundaryRings, rectangle, type ElementKind, type StoredLayout, type StoredVenue, type VenueDocument, type VenueElement } from "@/lib/venue-types";

type Tool = "select" | "polygon" | "seat";
const elementTools: Array<{ kind: ElementKind; label: string; icon: typeof BuildingsIcon }> = [
  { kind: "sector", label: "Settore", icon: GridFourIcon },
  { kind: "stand", label: "Tribuna", icon: StairsIcon },
  { kind: "curve", label: "Curva", icon: PathIcon },
  { kind: "block", label: "Blocco posti", icon: GridFourIcon },
  { kind: "stage", label: "Palco", icon: BoundingBoxIcon },
  { kind: "runway", label: "Passerella", icon: PathIcon },
  { kind: "field", label: "Campo", icon: SelectionIcon },
  { kind: "standing-area", label: "Area in piedi", icon: UsersThreeIcon },
  { kind: "accessible-area", label: "Area accessibile", icon: ChairIcon },
  { kind: "technical-area", label: "Area tecnica", icon: BuildingsIcon },
  { kind: "entrance", label: "Ingresso", icon: DoorOpenIcon },
  { kind: "exit", label: "Uscita", icon: DoorOpenIcon },
  { kind: "aisle", label: "Corridoio", icon: PathIcon },
  { kind: "barrier", label: "Transenna", icon: BarricadeIcon },
  { kind: "free-area", label: "Area libera", icon: BoundingBoxIcon },
];
const primaryElementKinds = new Set<ElementKind>(["sector", "stand", "stage", "entrance", "exit"]);

const kindLabels: Record<ElementKind, string> = {
  sector: "Settore", stand: "Tribuna", curve: "Curva", block: "Blocco", field: "Campo", stage: "Palco", runway: "Passerella", entrance: "Ingresso", exit: "Uscita", aisle: "Corridoio", barrier: "Transenna", "technical-area": "Area tecnica", "standing-area": "Area in piedi", "accessible-area": "Area accessibile", "free-area": "Area libera",
};
const seatedKinds = new Set<ElementKind>(["sector", "stand", "curve", "block", "accessible-area"]);

function parseDocument(layout: StoredLayout): VenueDocument {
  return typeof layout.document === "string" ? JSON.parse(layout.document) as VenueDocument : layout.document;
}

function elementColor(kind: ElementKind, active: boolean) {
  if (active) return "#d1e66a";
  if (kind === "stage") return "#d98d6b";
  if (kind === "field") return "#6f8f74";
  if (kind === "entrance" || kind === "exit") return "#77a4a1";
  if (kind === "barrier" || kind === "aisle") return "#87908e";
  return "#30393a";
}

function SeatLayer({ document, levelId }: { document: VenueDocument; levelId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(ratio, ratio);
      context.clearRect(0, 0, rect.width, rect.height);
      context.fillStyle = "rgba(209,230,106,.55)";
      for (const element of document.elements.filter((item) => item.levelId === levelId && !item.hidden && (item.rows ?? 0) > 0 && (item.seatsPerRow ?? 0) > 0)) {
        const bounds = polygonBounds(element.polygon);
        const rows = Math.max(1, element.rows ?? 1);
        const seats = Math.max(1, element.seatsPerRow ?? 1);
        const maxDots = 2400;
        const stride = Math.max(1, Math.ceil(rows * seats / maxDots));
        let dot = 0;
        for (let row = 0; row < rows; row += 1) {
          for (let seat = 0; seat < seats; seat += 1) {
            if (dot++ % stride !== 0) continue;
            const curve = element.rowStyle === "curved" ? Math.sin((seat / Math.max(1, seats - 1)) * Math.PI) * bounds.height * 0.08 : 0;
            const x = ((bounds.x + (seat + 0.5) * bounds.width / seats) / document.widthM) * rect.width;
            const y = ((bounds.y + (row + 0.5) * bounds.height / rows + curve) / document.heightM) * rect.height;
            context.beginPath();
            context.arc(x, y, stride > 1 ? 0.65 : 1.1, 0, Math.PI * 2);
            context.fill();
          }
        }
        context.fillStyle = "rgba(242,243,237,.92)";
        for (const seat of element.seatOverrides?.filter((item) => !item.deleted) ?? []) {
          context.beginPath();
          context.arc((seat.x / document.widthM) * rect.width, (seat.y / document.heightM) * rect.height, seat.accessible ? 2.4 : 1.7, 0, Math.PI * 2);
          context.fill();
        }
        context.fillStyle = "rgba(209,230,106,.55)";
      }
    };
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    draw();
    return () => observer.disconnect();
  }, [document, levelId]);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 size-full" aria-hidden />;
}

function SeatOverridesPanel({ element, onChange, onActivateTool }: { element: VenueElement; onChange: (seats: NonNullable<VenueElement["seatOverrides"]>) => void; onActivateTool: () => void }) {
  const [row, setRow] = useState("1");
  const [number, setNumber] = useState("1");
  const seats = element.seatOverrides ?? [];

  function upsertGenerated(deleted: boolean) {
    const rowNumber = Number(row);
    const seatNumber = Number(number);
    const rows = element.rows ?? 0;
    const seatsPerRow = element.seatsPerRow ?? 0;
    if (!Number.isInteger(rowNumber) || !Number.isInteger(seatNumber) || rowNumber < 1 || rowNumber > rows || seatNumber < 1 || seatNumber > seatsPerRow) return;
    const bounds = polygonBounds(element.polygon);
    const x = bounds.x + (seatNumber - .5) * bounds.width / Math.max(1, seatsPerRow);
    const curve = element.rowStyle === "curved" ? Math.sin((seatNumber - 1) / Math.max(1, seatsPerRow - 1) * Math.PI) * bounds.height * .08 : 0;
    const y = bounds.y + (rowNumber - .5) * bounds.height / Math.max(1, rows) + curve;
    const remaining = seats.filter((seat) => seat.row !== row || seat.number !== number);
    onChange([...remaining, { id: `seat-override-${crypto.randomUUID()}`, row, number, x, y, accessible: deleted ? undefined : true, deleted }]);
  }

  function updateSeat(id: string, patch: Partial<NonNullable<VenueElement["seatOverrides"]>[number]>) {
    onChange(seats.map((seat) => seat.id === id ? { ...seat, ...patch } : seat));
  }

  function removeSeat(id: string) {
    onChange(seats.filter((seat) => seat.id !== id));
  }

  return <div className="rounded-2xl border border-white/8 bg-[#0b0e0f] p-3">
    <div className="flex items-center justify-between gap-2"><div><p className="text-[10px] font-medium text-white">Singoli posti</p><p className="mt-0.5 text-[8px] text-[#68716f]">{seats.length} posti personalizzati</p></div><button type="button" onClick={onActivateTool} className="rounded-full border border-white/12 px-3 py-1.5 text-[9px] text-[#d1e66a]">Aggiungi sulla pianta</button></div>
    <div className="mt-3 grid grid-cols-2 gap-2"><label className="editor-label">Fila<input type="number" min="1" max={element.rows ?? 1} value={row} onChange={(event) => setRow(event.target.value)} className="editor-input font-mono" /></label><label className="editor-label">Posto<input type="number" min="1" max={element.seatsPerRow ?? 1} value={number} onChange={(event) => setNumber(event.target.value)} className="editor-input font-mono" /></label></div>
    <div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => upsertGenerated(false)} className="editor-secondary justify-center"><ChairIcon size={13} />Accessibile</button><button type="button" onClick={() => upsertGenerated(true)} className="editor-secondary justify-center text-[#e2a65a]"><XIcon size={13} />Escludi</button></div>
    {seats.length > 0 && <div className="mt-3 max-h-36 space-y-1 overflow-y-auto border-t border-white/8 pt-2">{seats.slice(-50).reverse().map((seat) => <div key={seat.id} className="flex items-center gap-2 rounded-lg bg-white/[.025] px-2 py-1.5"><span className="min-w-0 flex-1 truncate font-mono text-[8px] text-[#9ca4a2]">F {seat.row} · P {seat.number}</span><button type="button" onClick={() => updateSeat(seat.id, { accessible: !seat.accessible, deleted: false })} disabled={seat.deleted} className={`text-[8px] ${seat.accessible ? "text-[#d1e66a]" : "text-[#68716f]"}`}>{seat.deleted ? "ESCLUSO" : seat.accessible ? "ACCESS." : "STANDARD"}</button><button type="button" onClick={() => removeSeat(seat.id)} className="text-[#d17667]" aria-label={seat.deleted ? `Ripristina fila ${seat.row} posto ${seat.number}` : `Rimuovi override fila ${seat.row} posto ${seat.number}`}><TrashIcon size={12} /></button></div>)}</div>}
  </div>;
}

export function ArenaEditor({ initialVenue, initialLayouts = [] }: { initialVenue?: StoredVenue; initialLayouts?: StoredLayout[] }) {
  const initialLayout = initialLayouts.find((layout) => layout.is_default) ?? initialLayouts[0];
  const [name, setName] = useState(initialVenue?.name ?? "Nuova struttura");
  const [venueKind, setVenueKind] = useState<StoredVenue["kind"]>(initialVenue?.kind ?? "stadium");
  const [layouts, setLayouts] = useState(initialLayouts);
  const [layoutId, setLayoutId] = useState(initialLayout?.id);
  const [layoutName, setLayoutName] = useState(initialLayout?.name ?? "Configurazione principale");
  const [document, setDocument] = useState<VenueDocument>(() => initialLayout ? parseDocument(initialLayout) : generateVenueDocument("stadium", 12000, 2));
  const [activeLevelId, setActiveLevelId] = useState(document.levels[0].id);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [draftPolygon, setDraftPolygon] = useState<Array<{ x: number; y: number }>>([]);
  const [past, setPast] = useState<VenueDocument[]>([]);
  const [future, setFuture] = useState<VenueDocument[]>([]);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [showAdvancedElements, setShowAdvancedElements] = useState(false);
  const [pendingCadastre, setPendingCadastre] = useState<CadastralSelection>();
  const [mapPoint, setMapPoint] = useState({ latitude: 45.4781, longitude: 9.124 });
  const [setupComplete, setSetupComplete] = useState(Boolean(initialVenue));
  const [setupCapacity, setSetupCapacity] = useState(12000);
  const [setupLevels, setSetupLevels] = useState(2);
  const drag = useRef<{ startX: number; startY: number; before: VenueDocument; originals: Map<string, VenueElement["polygon"]>; moved: boolean } | null>(null);
  const vertexDrag = useRef<{ elementId: string; vertexIndex: number; before: VenueDocument } | null>(null);
  const board = useRef<SVGSVGElement>(null);
  const selected = document.elements.find((element) => element.id === selectedIds[0]);
  const selectedBounds = selected ? polygonBounds(selected.polygon) : undefined;
  const totalSeats = useMemo(() => countSeats(document), [document]);
  const cadastralPolygons = useMemo(() => document.elements.filter((element) => element.parentId === "__cadastral_boundary__").map((element) => element.polygon), [document.elements]);
  const outsideCount = useMemo(() => document.elements.filter((element) => element.parentId !== "__cadastral_boundary__" && element.polygon.some((point) => cadastralPolygons.length > 0 ? !cadastralPolygons.some((polygon) => pointInLocalPolygon(point, polygon)) : point.x < 0 || point.y < 0 || point.x > document.widthM || point.y > document.heightM)).length, [cadastralPolygons, document.elements, document.heightM, document.widthM]);
  const visibleElementTools = showAdvancedElements ? elementTools : elementTools.filter(({ kind }) => primaryElementKinds.has(kind));
  const toolHelp = tool === "polygon"
    ? "Disegna un'area: clicca almeno 3 punti sulla pianta, poi premi Completa."
    : tool === "seat"
      ? selected
        ? `Aggiungi posti a ${selected.label}: clicca sulla pianta nel punto desiderato.`
        : "Prima seleziona un settore con posti, poi usa questo strumento."
      : selected
        ? `Stai modificando ${selected.label}. Trascinalo sulla pianta o usa le proprietà a destra.`
        : "Seleziona un elemento sulla pianta per spostarlo o modificarlo.";

  const commit = useCallback((next: VenueDocument) => {
    setPast((history) => [...history.slice(-49), document]);
    setFuture([]);
    setDocument(next);
    setSaved(false);
  }, [document]);

  const undo = useCallback(() => {
    const previous = past.at(-1);
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [document, ...items]);
    setDocument(previous);
    setSaved(false);
  }, [document, past]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items, document]);
    setDocument(next);
    setSaved(false);
  }, [document, future]);

  const removeSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Eliminare ${selectedIds.length === 1 ? "l'elemento selezionato" : `${selectedIds.length} elementi selezionati`}? Puoi annullare subito dopo.`)) return;
    commit({ ...document, elements: document.elements.filter((element) => !selectedIds.includes(element.id)) });
    setSelectedIds([]);
  }, [commit, document, selectedIds]);

  const completePolygon = useCallback(() => {
    if (draftPolygon.length < 3) return;
    const element: VenueElement = { id: `free-${crypto.randomUUID()}`, kind: "free-area", label: "Area libera", levelId: activeLevelId, polygon: draftPolygon };
    commit({ ...document, elements: [...document.elements, element] });
    setSelectedIds([element.id]);
    setDraftPolygon([]);
    setTool("select");
  }, [activeLevelId, commit, document, draftPolygon]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        if (isEditing) return;
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      }
      else if ((event.key === "Delete" || event.key === "Backspace") && !isEditing) removeSelected();
      else if (event.key === "Enter") completePolygon();
      else if (event.key === "Escape") { setDraftPolygon([]); setTool("select"); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [completePolygon, redo, removeSelected, undo]);

  useEffect(() => {
    if (saved) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [saved]);

  function worldPoint(event: Pick<ReactPointerEvent<Element>, "clientX" | "clientY">) {
    const rect = board.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (event.clientX - rect.left) / rect.width * document.widthM, y: (event.clientY - rect.top) / rect.height * document.heightM };
  }

  function boardPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    const point = worldPoint(event);
    if (tool === "polygon") { setDraftPolygon((points) => [...points, point]); return; }
    if (tool === "seat" && selected) {
      const manualNumbers = selected.seatOverrides?.filter((seat) => seat.row === "M" && !seat.deleted).map((seat) => Number(seat.number)).filter(Number.isFinite) ?? [];
      const seat = { id: `seat-${crypto.randomUUID()}`, row: "M", number: String(Math.max(0, ...manualNumbers) + 1), x: point.x, y: point.y };
      commit({ ...document, elements: document.elements.map((element) => element.id === selected.id ? { ...element, seatOverrides: [...(element.seatOverrides ?? []), seat] } : element) });
      return;
    }
    if (event.target === event.currentTarget) setSelectedIds([]);
  }

  function startDrag(event: ReactPointerEvent<SVGPolygonElement>, element: VenueElement) {
    if (tool !== "select" || element.locked || document.levels.find((level) => level.id === element.levelId)?.locked) return;
    event.stopPropagation();
    const point = worldPoint(event);
    const nextSelection = event.shiftKey ? (selectedIds.includes(element.id) ? selectedIds.filter((id) => id !== element.id) : [...selectedIds, element.id]) : selectedIds.includes(element.id) ? selectedIds : [element.id];
    setSelectedIds(nextSelection);
    const originals = new Map(document.elements.filter((item) => nextSelection.includes(item.id)).map((item) => [item.id, item.polygon.map((vertex) => ({ ...vertex }))]));
    drag.current = { startX: point.x, startY: point.y, before: document, originals, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<SVGPolygonElement>) {
    const active = drag.current;
    if (!active) return;
    const point = worldPoint(event);
    const dx = point.x - active.startX;
    const dy = point.y - active.startY;
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) active.moved = true;
    setDocument((current) => ({ ...current, elements: current.elements.map((element) => {
      const original = active.originals.get(element.id);
      return original ? { ...element, polygon: original.map((vertex) => ({ x: vertex.x + dx, y: vertex.y + dy })) } : element;
    }) }));
    setSaved(false);
  }

  function endDrag() {
    const active = drag.current;
    if (!active) return;
    if (active.moved) {
      setPast((items) => [...items.slice(-49), active.before]);
      setFuture([]);
    }
    drag.current = null;
  }

  function startVertexDrag(event: ReactPointerEvent<SVGCircleElement>, element: VenueElement, vertexIndex: number) {
    event.stopPropagation();
    vertexDrag.current = { elementId: element.id, vertexIndex, before: document };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveVertexDrag(event: ReactPointerEvent<SVGCircleElement>) {
    const active = vertexDrag.current;
    if (!active) return;
    const point = worldPoint(event);
    setDocument((current) => ({ ...current, elements: current.elements.map((element) => element.id === active.elementId ? { ...element, polygon: element.polygon.map((vertex, index) => index === active.vertexIndex ? point : vertex) } : element) }));
    setSaved(false);
  }

  function endVertexDrag() {
    const active = vertexDrag.current;
    if (!active) return;
    setPast((items) => [...items.slice(-49), active.before]);
    setFuture([]);
    vertexDrag.current = null;
  }

  function addElement(kind: ElementKind) {
    const width = kind === "entrance" || kind === "exit" ? 8 : kind === "aisle" || kind === "barrier" ? 42 : 32;
    const height = kind === "entrance" || kind === "exit" ? 5 : kind === "aisle" || kind === "barrier" ? 4 : 18;
    const element: VenueElement = { id: `${kind}-${crypto.randomUUID()}`, kind, label: `${kindLabels[kind]} ${document.elements.filter((item) => item.kind === kind).length + 1}`, levelId: activeLevelId, polygon: rectangle(document.widthM / 2 - width / 2, document.heightM / 2 - height / 2, width, height), rows: seatedKinds.has(kind) ? 12 : undefined, seatsPerRow: seatedKinds.has(kind) ? 28 : undefined, rowStyle: kind === "curve" ? "curved" : "straight" };
    commit({ ...document, elements: [...document.elements, element] });
    setSelectedIds([element.id]);
    setTool("select");
  }

  function updateElement(patch: Partial<VenueElement>) {
    if (!selected) return;
    commit({ ...document, elements: document.elements.map((element) => element.id === selected.id ? { ...element, ...patch } : element) });
  }

  function updateBounds(key: "x" | "y" | "width" | "height", value: number) {
    if (!selected || !selectedBounds || !Number.isFinite(value)) return;
    const old = selectedBounds;
    const next = { ...old, [key]: value };
    const polygon = selected.polygon.map((point) => ({ x: next.x + (point.x - old.x) / (old.width || 1) * next.width, y: next.y + (point.y - old.y) / (old.height || 1) * next.height }));
    updateElement({ polygon });
  }

  function addLevel() {
    const id = `level-${crypto.randomUUID()}`;
    commit({ ...document, levels: [...document.levels, { id, name: `Livello ${document.levels.length + 1}`, order: document.levels.length, elevationM: document.levels.length * 8 }] });
    setActiveLevelId(id);
  }

  function updateLevel(levelId: string, patch: Partial<VenueDocument["levels"][number]>) {
    commit({ ...document, levels: document.levels.map((level) => level.id === levelId ? { ...level, ...patch } : level) });
  }

  function deleteLevel(levelId: string) {
    if (document.levels.length === 1) return;
    const level = document.levels.find((item) => item.id === levelId);
    if (!window.confirm(`Eliminare ${level?.name ?? "questo livello"} e tutti i suoi elementi?`)) return;
    const remaining = document.levels.filter((level) => level.id !== levelId);
    commit({ ...document, levels: remaining, elements: document.elements.filter((element) => element.levelId !== levelId || element.parentId === "__cadastral_boundary__").map((element) => element.parentId === "__cadastral_boundary__" && element.levelId === levelId ? { ...element, levelId: remaining[0].id } : element) });
    setActiveLevelId(remaining[0].id);
    setSelectedIds([]);
  }

  function regenerate() {
    if (!window.confirm("Rigenerare la pianta di base? Le modifiche attuali saranno sostituite, ma potrai usare Annulla.")) return;
    const capacity = Math.max(100, totalSeats || 12000);
    const next = generateVenueDocument(venueKind, capacity, document.levels.length);
    commit(next);
    setActiveLevelId(next.levels[0].id);
    setSelectedIds([]);
  }

  async function save() {
    if (name.trim().length < 2) {
      setError("Inserisci un nome di almeno 2 caratteri per la struttura.");
      return;
    }
    if (layoutName.trim().length < 2) {
      setError("Inserisci un nome di almeno 2 caratteri per la configurazione.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (!initialVenue) {
        const created = await fetch("/api/control/v1/venues", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, kind: venueKind, capacity: totalSeats, map: { width: document.widthM, height: document.heightM, elements: document.elements } }) });
        const payload = await created.json();
        if (!created.ok) throw new Error(payload.message ?? "Struttura non creata");
        const updated = await fetch(`/api/control/v1/venues/${payload.id}/layouts/${payload.layoutId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: layoutName, document, isDefault: true }) });
        if (!updated.ok) throw new Error("Configurazione non salvata");
        window.location.assign(`/venues/${payload.id}/edit`);
        return;
      }
      if (!layoutId) throw new Error("Configurazione mancante");
      const details = await fetch(`/api/control/v1/venues/${initialVenue.id}/details`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, kind: venueKind }) });
      if (!details.ok) throw new Error("Dettagli struttura non salvati");
      const response = await fetch(`/api/control/v1/venues/${initialVenue.id}/layouts/${layoutId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: layoutName, document, isDefault: layouts.find((layout) => layout.id === layoutId)?.is_default ?? true }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? "Configurazione non salvata");
      setLayouts((items) => items.map((layout) => layout.id === layoutId ? { ...layout, name: layoutName, capacity: totalSeats, document, version: payload.version } : layout));
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Salvataggio non riuscito");
    } finally { setSaving(false); }
  }

  async function duplicateLayout() {
    if (!initialVenue) return;
    const nextName = `${layoutName} copia`;
    const response = await fetch(`/api/control/v1/venues/${initialVenue.id}/layouts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: nextName, document, isDefault: false }) });
    const payload = await response.json();
    if (!response.ok) { setError(payload.message ?? "Duplicazione non riuscita"); return; }
    const layout = { id: payload.id, name: nextName, version: 1, is_default: false, capacity: payload.capacity, document };
    setLayouts((items) => [...items, layout]);
    setLayoutId(payload.id);
    setLayoutName(nextName);
    setSaved(true);
  }

  function applyCadastre(selection: CadastralSelection, combine: boolean) {
    const source = selection.source;
    const geometry = selection.selected?.geometry;
    if (!geometry?.coordinates) return;
    const previous = combine ? document.boundary : undefined;
    const polygons = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
    const previousPolygons = previous?.type === "MultiPolygon" ? previous.coordinates : previous?.type === "Polygon" ? [previous.coordinates] : [];
    const boundary = previousPolygons.length > 0 || polygons.length > 1 ? { type: "MultiPolygon", coordinates: [...previousPolygons, ...polygons] } : { type: "Polygon", coordinates: polygons[0] };
    const rings = projectGeoBoundaryRings(boundary, document.widthM, document.heightM);
    const boundaryElements: VenueElement[] = rings.map((polygon, index) => ({ id: `cadastre-${crypto.randomUUID()}`, kind: "free-area", label: `Confine lotto ${index + 1}`, levelId: activeLevelId, parentId: "__cadastral_boundary__", polygon }));
    commit({ ...document, boundary, cadastralSources: combine ? [...(document.cadastralSources ?? []), source] : [source], elements: [...boundaryElements, ...document.elements.filter((element) => element.parentId !== "__cadastral_boundary__")] });
    setSelectedIds(boundaryElements.map((element) => element.id));
    setPendingCadastre(undefined);
    setShowMap(false);
  }

  function generateInitialVenue() {
    const next = generateVenueDocument(venueKind, setupCapacity, setupLevels);
    setDocument(next);
    setActiveLevelId(next.levels[0].id);
    setPast([]);
    setFuture([]);
    setSaved(false);
    setSetupComplete(true);
  }

  if (!setupComplete) {
    const options: Array<{ value: StoredVenue["kind"]; label: string; note: string }> = [
      { value: "stadium", label: "Stadio", note: "Anelli, campo e settori" },
      { value: "arena", label: "Palazzetto", note: "Compatto e multilivello" },
      { value: "concert", label: "Concerto", note: "Palco e platea" },
      { value: "square", label: "Piazza", note: "Manifestazioni e raduni" },
      { value: "outdoor", label: "Area esterna", note: "Cortei e spazi liberi" },
      { value: "custom", label: "Da zero", note: "Tavola completamente libera" },
    ];
    return <div className="grid overflow-hidden rounded-[34px] border border-white/10 bg-[#101415] shadow-[0_28px_90px_-40px_rgba(0,0,0,.85)] xl:grid-cols-[minmax(0,1.15fr)_380px]"><section className="p-6 sm:p-8"><p className="font-mono text-[9px] uppercase tracking-[.2em] text-[#d1e66a]">PASSO 01 · BASE AUTOMATICA</p><h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-[-.05em]">Che spazio vuoi costruire?</h2><p className="mt-3 max-w-xl text-xs leading-5 text-[#858d8b]">onePixel genera una pianta dall&apos;alto proporzionata alla capienza. Dopo questo passo ogni vertice, fila, posto e livello rimane modificabile.</p><div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{options.map((option) => <button type="button" key={option.value} onClick={() => setVenueKind(option.value)} className={`min-h-28 rounded-[22px] border p-4 text-left transition ${venueKind === option.value ? "border-[#d1e66a]/45 bg-[#d1e66a]/9" : "border-white/8 bg-white/[.02] hover:border-white/15"}`}><BuildingsIcon size={20} className={venueKind === option.value ? "text-[#d1e66a]" : "text-[#68706f]"} /><span className="mt-4 block text-sm font-semibold text-white">{option.label}</span><span className="mt-1 block text-[10px] text-[#707876]">{option.note}</span></button>)}</div></section><aside className="border-t border-white/10 bg-[#0d1112] p-6 sm:p-8 xl:border-l xl:border-t-0"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#68716f]">DIMENSIONAMENTO</p><div className="mt-6 space-y-5"><label className="editor-label">Nome struttura<input value={name} onChange={(event) => setName(event.target.value)} className="editor-input h-11" /></label><label className="editor-label">Quanti posti?<input type="number" min={0} max={1000000} step={100} value={setupCapacity} onChange={(event) => setSetupCapacity(Math.max(0, Number(event.target.value)))} className="editor-input h-11 font-mono" /></label><label className="editor-label">Livelli / anelli<select value={setupLevels} onChange={(event) => setSetupLevels(Number(event.target.value))} className="editor-input h-11">{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} {index === 0 ? "livello" : "livelli"}</option>)}</select></label><div className="rounded-2xl border border-white/8 bg-white/[.025] p-4"><p className="font-mono text-2xl text-[#d1e66a]">{setupCapacity.toLocaleString("it-IT")}</p><p className="mt-1 text-[10px] text-[#707876]">posti distribuiti automaticamente su {setupLevels} {setupLevels === 1 ? "livello" : "livelli"}</p></div><button type="button" disabled={name.trim().length < 2} onClick={generateInitialVenue} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#d1e66a] text-sm font-semibold text-[#101314] disabled:opacity-30">Genera la pianta <ArrowUUpRightIcon size={17} weight="bold" /></button></div></aside></div>;
  }

  return (
    <div className="overflow-hidden rounded-[34px] border border-white/10 bg-[#0e1213] shadow-[0_28px_90px_-40px_rgba(0,0,0,.85)]">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#d1e66a] text-[#101314]"><BuildingsIcon size={20} weight="fill" /></span><div className="min-w-0"><input value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} className="w-full min-w-0 bg-transparent text-sm font-semibold text-white outline-none" aria-label="Nome struttura" /><p className="mt-0.5 font-mono text-[9px] uppercase tracking-[.15em] text-[#68716f]">{totalSeats.toLocaleString("it-IT")} POSTI · {document.levels.length} LIVELLI · {document.widthM} × {document.heightM} M</p></div></div>
        <div className="flex items-center gap-2"><button type="button" onClick={undo} disabled={!past.length} className="editor-icon" aria-label="Annulla ultima modifica" title="Annulla ultima modifica"><ArrowUDownLeftIcon size={17} /></button><button type="button" onClick={redo} disabled={!future.length} className="editor-icon" aria-label="Ripeti modifica" title="Ripeti modifica"><ArrowUUpRightIcon size={17} /></button><button type="button" onClick={() => void save()} disabled={saving || saved} className="flex h-10 items-center gap-2 rounded-full bg-[#d1e66a] px-4 text-xs font-semibold text-[#101314] transition active:scale-[.98] disabled:bg-white/5 disabled:text-[#697170]"><FloppyDiskIcon size={16} weight="bold" />{saving ? "Salvataggio…" : saved ? "Modifiche salvate" : "Salva modifiche"}</button></div>
      </div>

      <div className="grid gap-2 border-b border-white/10 bg-[#0b0e0f] px-4 py-3 text-[10px] text-[#8e9794] sm:grid-cols-4 sm:px-5">
        {["1 · Scegli uno strumento", "2 · Tocca la pianta", "3 · Personalizza a destra", "4 · Salva le modifiche"].map((step) => <span key={step} className="rounded-lg border border-white/8 bg-white/[.025] px-3 py-2">{step}</span>)}
      </div>

      <div className="grid min-h-[720px] xl:grid-cols-[250px_minmax(0,1fr)_290px]">
        <aside className="border-b border-white/10 bg-[#101415] p-4 xl:border-b-0 xl:border-r">
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
            <button type="button" onClick={() => setTool("select")} className={`editor-tool ${tool === "select" ? "editor-tool-active" : ""}`}><SelectionIcon size={18} />Seleziona e modifica</button>
            <button type="button" onClick={() => { setTool("polygon"); setDraftPolygon([]); }} className={`editor-tool ${tool === "polygon" ? "editor-tool-active" : ""}`}><PencilSimpleLineIcon size={18} />Disegna un&apos;area</button>
            <button type="button" onClick={() => setTool("seat")} disabled={!selected || !seatedKinds.has(selected.kind)} title={!selected || !seatedKinds.has(selected.kind) ? "Seleziona prima un settore, una tribuna o un blocco posti" : "Aggiungi singoli posti sulla pianta"} className={`editor-tool ${tool === "seat" ? "editor-tool-active" : ""}`}><ChairIcon size={18} />Aggiungi un posto</button>
            <button type="button" onClick={() => setShowMap(true)} className="editor-tool"><MapPinIcon size={18} />Importa da mappa</button>
          </div>
          <p className="mt-3 rounded-xl border border-[#d1e66a]/15 bg-[#d1e66a]/6 p-3 text-[10px] leading-4 text-[#b9c48b]" aria-live="polite">{toolHelp}</p>
          <p className="mb-2 mt-6 font-mono text-[9px] uppercase tracking-[.18em] text-[#616967]">AGGIUNGI ELEMENTO</p>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">{visibleElementTools.map(({ kind, label, icon: Icon }) => <button key={kind} type="button" onClick={() => addElement(kind)} title={`Aggiungi ${label.toLowerCase()} al centro della pianta`} className="editor-tool"><Icon size={17} />{label}</button>)}</div>
          <button type="button" onClick={() => setShowAdvancedElements((value) => !value)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/8 px-3 py-2.5 text-[10px] text-[#858d8b] transition hover:border-white/20 hover:text-white" aria-expanded={showAdvancedElements}><CaretDownIcon size={14} className={`transition ${showAdvancedElements ? "rotate-180" : ""}`} />{showAdvancedElements ? "Nascondi elementi avanzati" : "Mostra altri elementi"}</button>
          <div className="mt-6 border-t border-white/8 pt-4"><label className="grid gap-2 text-[10px] text-[#858d8b]">Tipo struttura<select value={venueKind} onChange={(event) => setVenueKind(event.target.value as StoredVenue["kind"])} className="h-10 rounded-xl border border-white/10 bg-[#0b0e0f] px-3 text-xs text-white"><option value="stadium">Stadio</option><option value="arena">Palazzetto</option><option value="concert">Concerto</option><option value="square">Piazza</option><option value="outdoor">Area esterna</option><option value="fairground">Fiera</option><option value="custom">Personalizzata</option></select></label><button type="button" onClick={regenerate} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#e2a65a]/20 text-xs text-[#c7a56f] transition hover:bg-[#e2a65a]/8 hover:text-white" title="Sostituisce la pianta attuale con una nuova base automatica"><ArrowCounterClockwiseIcon size={16} />Rigenera tutta la pianta</button><p className="mt-2 text-[9px] leading-4 text-[#68716f]">Azione avanzata: sostituisce gli elementi attuali dopo una conferma.</p></div>
        </aside>

        <section className="relative min-h-[560px] overflow-hidden bg-[#0b0e0f] surface-grid">
          <div className="absolute left-4 top-4 z-[2] flex flex-wrap gap-2"><span className="rounded-full border border-white/10 bg-[#0c1011]/90 px-3 py-1.5 font-mono text-[9px] text-[#aab1af] backdrop-blur">{document.levels.find((level) => level.id === activeLevelId)?.name}</span>{document.boundary && <span className="rounded-full border border-[#d1e66a]/25 bg-[#d1e66a]/10 px-3 py-1.5 font-mono text-[9px] text-[#d1e66a]">CONFINE CATASTALE COLLEGATO</span>}{outsideCount > 0 && <span className="rounded-full border border-[#e2a65a]/25 bg-[#e2a65a]/10 px-3 py-1.5 font-mono text-[9px] text-[#e2a65a]">{outsideCount} FUORI CONFINE</span>}</div>
          <div className="absolute inset-4 top-16 overflow-hidden rounded-[26px] border border-white/10 bg-[#111617] shadow-[inset_0_0_80px_rgba(0,0,0,.28)] sm:inset-6 sm:top-16">
            <svg ref={board} viewBox={`0 0 ${document.widthM} ${document.heightM}`} preserveAspectRatio="none" onPointerDown={boardPointerDown} className="absolute inset-0 size-full touch-none" aria-label="Tavola 2D della struttura">
              {document.elements.filter((element) => (element.levelId === activeLevelId || element.parentId === "__cadastral_boundary__") && !element.hidden).map((element) => {
                const active = selectedIds.includes(element.id);
                const isBoundary = element.parentId === "__cadastral_boundary__";
                const bounds = polygonBounds(element.polygon);
                const points = element.polygon.map((point) => `${point.x},${point.y}`).join(" ");
                return <g key={element.id} transform={`rotate(${element.rotation ?? 0} ${bounds.x + bounds.width / 2} ${bounds.y + bounds.height / 2})`}><polygon points={points} fill={isBoundary ? "#d1e66a" : elementColor(element.kind, active)} fillOpacity={isBoundary ? (active ? .14 : .055) : active ? .95 : .78} stroke={isBoundary ? "#d1e66a" : active ? "#f2f3ed" : "rgba(255,255,255,.16)"} strokeDasharray={isBoundary ? "2 1.5" : undefined} strokeWidth={isBoundary ? .75 : active ? .8 : .35} vectorEffect="non-scaling-stroke" onPointerDown={(event) => startDrag(event, element)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} className="transition-[fill,stroke] duration-200" /><text x={bounds.x + bounds.width / 2} y={bounds.y + bounds.height / 2} textAnchor="middle" dominantBaseline="middle" fill={active && !isBoundary ? "#101314" : isBoundary ? "#d1e66a" : "#d7ddda"} fontSize={Math.max(2.5, Math.min(5, bounds.width / 6))} fontWeight="650" pointerEvents="none">{element.label}</text>{element.locked && <circle cx={bounds.x + 2} cy={bounds.y + 2} r="1.4" fill="#e2a65a" />}{active && element.polygon.map((vertex, vertexIndex) => <circle key={vertexIndex} cx={vertex.x} cy={vertex.y} r="1.8" fill="#f2f3ed" stroke="#101314" strokeWidth=".5" vectorEffect="non-scaling-stroke" onPointerDown={(event) => startVertexDrag(event, element, vertexIndex)} onPointerMove={moveVertexDrag} onPointerUp={endVertexDrag} onPointerCancel={endVertexDrag} />)}</g>;
              })}
              {draftPolygon.length > 0 && <polyline points={draftPolygon.map((point) => `${point.x},${point.y}`).join(" ")} fill="rgba(209,230,106,.08)" stroke="#d1e66a" strokeWidth=".7" strokeDasharray="2 2" />}
            </svg>
            <SeatLayer document={document} levelId={activeLevelId} />
          </div>
          {tool === "polygon" && <div className="absolute bottom-5 left-1/2 z-[3] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#0b0e0f]/95 p-1.5 pl-4 text-[10px] text-[#aab1af] backdrop-blur-xl"><span>Clicca i vertici, poi completa</span><button type="button" onClick={completePolygon} disabled={draftPolygon.length < 3} className="rounded-full bg-[#d1e66a] px-3 py-1.5 font-semibold text-[#101314] disabled:opacity-30">Completa</button><button type="button" onClick={() => { setDraftPolygon([]); setTool("select"); }} className="grid size-7 place-items-center rounded-full hover:bg-white/5" aria-label="Annulla forma"><XIcon size={14} /></button></div>}
        </section>

        <aside className="border-t border-white/10 bg-[#101415] p-4 xl:border-l xl:border-t-0">
          <div className="flex items-center justify-between"><div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#68716f]">VERSIONE DELLA PIANTA</p><p className="mt-1 text-[9px] text-[#68716f]">Crea varianti senza perdere l&apos;originale.</p></div>{initialVenue && <button type="button" onClick={() => void duplicateLayout()} className="editor-icon" aria-label="Crea una copia della configurazione" title="Crea una copia"><CopyIcon size={15} /></button>}</div>
          {layouts.length > 0 && <select value={layoutId} aria-label="Configurazione da modificare" onChange={(event) => { const layout = layouts.find((item) => item.id === event.target.value); if (!layout) return; if (!saved && !window.confirm("Hai modifiche non salvate. Vuoi cambiare configurazione e perderle?")) return; setLayoutId(layout.id); setLayoutName(layout.name); const next = parseDocument(layout); setDocument(next); setActiveLevelId(next.levels[0].id); setSelectedIds([]); setPast([]); setFuture([]); setError(""); setSaved(true); }} className="mt-3 h-10 w-full rounded-xl border border-white/10 bg-[#0b0e0f] px-3 text-xs text-white">{layouts.map((layout) => <option key={layout.id} value={layout.id}>{layout.name} · v{layout.version}</option>)}</select>}
          <input value={layoutName} onChange={(event) => { setLayoutName(event.target.value); setSaved(false); }} className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-[#0b0e0f] px-3 text-xs text-white" aria-label="Nome configurazione" />

          <div className="mt-6 flex items-center justify-between"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#68716f]">LIVELLI</p><button type="button" onClick={addLevel} className="editor-icon" aria-label="Aggiungi livello"><PlusIcon size={14} /></button></div>
          <div className="mt-2 space-y-1">{[...document.levels].sort((a, b) => a.order - b.order).map((level) => <div key={level.id} className={`group flex items-center gap-1 rounded-xl border p-1 ${activeLevelId === level.id ? "border-[#d1e66a]/30 bg-[#d1e66a]/8" : "border-transparent"}`}><button type="button" onClick={() => { setActiveLevelId(level.id); setSelectedIds([]); }} className="grid size-8 shrink-0 place-items-center rounded-lg text-[#9ba3a2] hover:bg-white/5" aria-label={`Apri ${level.name}`} aria-pressed={activeLevelId === level.id}><SelectionIcon size={13} /></button><input value={level.name} onChange={(event) => updateLevel(level.id, { name: event.target.value })} className="min-w-0 flex-1 bg-transparent px-1 text-xs text-white outline-none" aria-label="Nome livello" /><button type="button" onClick={() => updateLevel(level.id, { hidden: !level.hidden })} className="editor-mini" aria-label={level.hidden ? "Mostra livello" : "Nascondi livello"}>{level.hidden ? <EyeSlashIcon size={13} /> : <EyeIcon size={13} />}</button><button type="button" onClick={() => updateLevel(level.id, { locked: !level.locked })} className="editor-mini" aria-label={level.locked ? "Sblocca livello" : "Blocca livello"}><LockIcon size={13} /></button><button type="button" onClick={() => deleteLevel(level.id)} disabled={document.levels.length === 1} className="editor-mini text-[#d17667]" aria-label="Elimina livello"><TrashIcon size={13} /></button></div>)}</div>

          <div className="mt-6 border-t border-white/8 pt-5"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#68716f]">MODIFICA ELEMENTO</p>{selected && selectedBounds ? <div className="mt-3 space-y-4"><label className="editor-label">Nome<input value={selected.label} onChange={(event) => updateElement({ label: event.target.value })} className="editor-input" /></label><div className="grid grid-cols-2 gap-2">{(["x", "y", "width", "height"] as const).map((key) => <label key={key} className="editor-label">{key === "width" ? "Larghezza" : key === "height" ? "Altezza" : key.toUpperCase()}<input type="number" step="0.5" value={Math.round(selectedBounds[key] * 10) / 10} onChange={(event) => updateBounds(key, Number(event.target.value))} className="editor-input font-mono" /></label>)}</div><label className="editor-label">Rotazione (gradi)<input type="number" value={Math.round(selected.rotation ?? 0)} onChange={(event) => updateElement({ rotation: Number(event.target.value) })} className="editor-input font-mono" /></label>{seatedKinds.has(selected.kind) && <><div className="grid grid-cols-2 gap-2"><label className="editor-label">Numero di righe<input type="number" min="1" max="2000" value={selected.rows ?? 1} onChange={(event) => updateElement({ rows: Number(event.target.value) })} className="editor-input font-mono" /></label><label className="editor-label">Posti per riga<input type="number" min="1" max="2000" value={selected.seatsPerRow ?? 1} onChange={(event) => updateElement({ seatsPerRow: Number(event.target.value) })} className="editor-input font-mono" /></label></div><label className="editor-label">Forma delle righe<select value={selected.rowStyle ?? "straight"} onChange={(event) => updateElement({ rowStyle: event.target.value as "straight" | "curved" })} className="editor-input"><option value="straight">Dritte</option><option value="curved">Curve</option></select></label><SeatOverridesPanel element={selected} onChange={(seatOverrides) => updateElement({ seatOverrides })} onActivateTool={() => setTool("seat")} /></>}<div className="flex gap-2"><button type="button" onClick={() => updateElement({ locked: !selected.locked })} className="editor-secondary"><LockIcon size={14} />{selected.locked ? "Sblocca" : "Blocca posizione"}</button><button type="button" onClick={removeSelected} className="editor-secondary text-[#e58a7c]"><TrashIcon size={14} />Elimina elemento</button></div></div> : <div className="mt-3 rounded-2xl border border-dashed border-white/10 p-4 text-xs leading-5 text-[#68716f]">Clicca un elemento sulla pianta. Qui compariranno nome, dimensioni, righe, posti e rotazione.</div>}</div>
          {error && <p role="alert" className="mt-4 rounded-2xl border border-[#e26d5a]/25 bg-[#e26d5a]/10 p-3 text-xs text-[#f1a193]">{error}</p>}
        </aside>
      </div>

      <AnimatePresence>{showMap && <motion.div className="fixed inset-0 z-[1000] grid place-items-center bg-[#07090a]/80 p-3 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div className="max-h-[96dvh] w-full max-w-4xl overflow-y-auto rounded-[34px] border border-white/10 bg-[#101415] shadow-2xl" initial={{ opacity: 0, scale: .97, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .98 }} transition={{ type: "spring", stiffness: 150, damping: 22 }}><div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#d1e66a]">MAPPA E CATASTO</p><h2 className="mt-1 text-lg font-semibold">Collega il confine reale</h2></div><button type="button" onClick={() => setShowMap(false)} className="editor-icon" aria-label="Chiudi mappa"><XIcon size={18} /></button></div><div className="p-4"><LocationPicker latitude={mapPoint.latitude} longitude={mapPoint.longitude} onChange={(latitude, longitude) => setMapPoint({ latitude, longitude })} onCadastre={setPendingCadastre} /></div><div className="flex flex-col gap-3 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center"><p className="mr-auto max-w-xl text-[11px] leading-5 text-[#78817f]">Il dato ufficiale resta tra le fonti; nell&apos;editor puoi spostare e modificare ogni vertice della copia 2D.</p>{document.boundary && <button type="button" disabled={!pendingCadastre?.selected} onClick={() => pendingCadastre && applyCadastre(pendingCadastre, true)} className="rounded-full border border-white/12 px-4 py-2.5 text-xs text-[#c5cbc9] disabled:opacity-30">Aggiungi al lotto</button>}<button type="button" disabled={!pendingCadastre?.selected} onClick={() => pendingCadastre && applyCadastre(pendingCadastre, false)} className="rounded-full bg-[#d1e66a] px-5 py-2.5 text-xs font-semibold text-[#101314] disabled:opacity-30">{document.boundary ? "Sostituisci confine" : "Usa nell'editor"}</button></div></motion.div></motion.div>}</AnimatePresence>
    </div>
  );
}
