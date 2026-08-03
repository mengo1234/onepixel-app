"use client";

import {
  ArchiveIcon,
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
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  HandIcon,
  PathIcon,
  PencilSimpleLineIcon,
  PlusIcon,
  SelectionIcon,
  StairsIcon,
  StarIcon,
  TrashIcon,
  UsersThreeIcon,
  XIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import type { GeoMultiPolygon, GeoPolygon, StadiumRingInput, VenueCapacityMode, VenuePlanShapeKind } from "@onepixel/protocol";
import { LocationPicker, type CadastralSelection } from "./location-picker";
import { countSeats, generateVenueDocument, parseVenueDocument, pointInLocalPolygon, polygonBounds, projectGeoBoundaryRings, rectangle, type ElementKind, type StoredLayout, type StoredVenue, type VenueDocument, type VenueElement } from "@/lib/venue-types";

type Tool = "select" | "pan" | "polygon" | "seat" | "place";
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
  return parseVenueDocument(layout.document);
}

function elementColor(kind: ElementKind, active: boolean) {
  if (active) return "#d1e66a";
  if (kind === "stage") return "#d98d6b";
  if (kind === "field") return "#6f8f74";
  if (kind === "entrance" || kind === "exit") return "#77a4a1";
  if (kind === "barrier" || kind === "aisle") return "#87908e";
  return "#30393a";
}

function rotatePoint(point: { x: number; y: number }, center: { x: number; y: number }, rotationDeg = 0) {
  if (!rotationDeg) return point;
  const radians = rotationDeg * Math.PI / 180;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return { x: center.x + dx * Math.cos(radians) - dy * Math.sin(radians), y: center.y + dx * Math.sin(radians) + dy * Math.cos(radians) };
}

function SeatLayer({ document, levelId, showAllRings, viewport }: { document: VenueDocument; levelId: string; showAllRings: boolean; viewport: { x: number; y: number; width: number; height: number } }) {
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
      const scale = Math.min(rect.width / viewport.width, rect.height / viewport.height);
      const offsetX = (rect.width - viewport.width * scale) / 2;
      const offsetY = (rect.height - viewport.height * scale) / 2;
      context.fillStyle = "rgba(209,230,106,.55)";
      const visibleLevels = new Set(document.levels.filter((level) => !level.hidden && (showAllRings || level.id === levelId)).map((level) => level.id));
      for (const element of document.elements.filter((item) => visibleLevels.has(item.levelId ?? "") && !item.hidden && (item.rows ?? 0) > 0 && (item.seatsPerRow ?? 0) > 0)) {
        const bounds = polygonBounds(element.polygon);
        const rows = Math.max(1, element.rows ?? 1);
        const seats = Math.max(1, element.seatsPerRow ?? 1);
        const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        const maxDots = 2400;
        const stride = Math.max(1, Math.ceil(rows * seats / maxDots));
        const deleted = new Set(element.seatOverrides?.filter((seat) => seat.deleted).map((seat) => `${seat.row}-${seat.number}`) ?? []);
        let dot = 0;
        for (let row = 0; row < rows; row += 1) {
          for (let seat = 0; seat < seats; seat += 1) {
            if (deleted.has(`${row + 1}-${seat + 1}`)) continue;
            if (dot++ % stride !== 0) continue;
            const curve = element.rowStyle === "curved" ? Math.sin((seat / Math.max(1, seats - 1)) * Math.PI) * bounds.height * 0.08 : 0;
            const local = { x: bounds.x + (seat + 0.5) * bounds.width / seats, y: bounds.y + (row + 0.5) * bounds.height / rows + curve };
            if (!pointInLocalPolygon(local, element.polygon)) continue;
            const rotated = rotatePoint(local, center, element.rotation);
            const x = offsetX + (rotated.x - viewport.x) * scale;
            const y = offsetY + (rotated.y - viewport.y) * scale;
            context.beginPath();
            context.arc(x, y, stride > 1 ? 0.65 : 1.1, 0, Math.PI * 2);
            context.fill();
          }
        }
        context.fillStyle = "rgba(242,243,237,.92)";
        for (const seat of element.seatOverrides?.filter((item) => !item.deleted) ?? []) {
          const rotated = rotatePoint(seat, center, element.rotation);
          context.beginPath();
          context.arc(offsetX + (rotated.x - viewport.x) * scale, offsetY + (rotated.y - viewport.y) * scale, seat.accessible ? 2.4 : 1.7, 0, Math.PI * 2);
          context.fill();
        }
        context.fillStyle = "rgba(209,230,106,.55)";
      }
    };
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    draw();
    return () => observer.disconnect();
  }, [document, levelId, showAllRings, viewport]);
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
  const initialLayout = initialLayouts.find((layout) => layout.is_default && !layout.archived_at) ?? initialLayouts.find((layout) => !layout.archived_at);
  const [name, setName] = useState(initialVenue?.name ?? "Nuova struttura");
  const [venueKind, setVenueKind] = useState<StoredVenue["kind"]>(initialVenue?.kind ?? "stadium");
  const [layouts, setLayouts] = useState(initialLayouts);
  const [layoutId, setLayoutId] = useState(initialLayout?.id);
  const [layoutName, setLayoutName] = useState(initialLayout?.name ?? "Configurazione principale");
  const [document, setDocument] = useState<VenueDocument>(() => initialLayout ? parseDocument(initialLayout) : generateVenueDocument("stadium", 12000, 2));
  const [activeLevelId, setActiveLevelId] = useState(document.levels[0].id);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [pendingElementKind, setPendingElementKind] = useState<ElementKind>();
  const [draftPolygon, setDraftPolygon] = useState<Array<{ x: number; y: number }>>([]);
  const [past, setPast] = useState<VenueDocument[]>([]);
  const [future, setFuture] = useState<VenueDocument[]>([]);
  const [saved, setSaved] = useState(true);
  const [layoutPending, setLayoutPending] = useState(false);
  const [layoutNotice, setLayoutNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showMap, setShowMap] = useState(false);
  const [showAdvancedElements, setShowAdvancedElements] = useState(false);
  const [pendingCadastre, setPendingCadastre] = useState<CadastralSelection>();
  const [mapPoint, setMapPoint] = useState({ latitude: 45.4781, longitude: 9.124 });
  const [setupComplete, setSetupComplete] = useState(Boolean(initialVenue));
  const [setupCapacity, setSetupCapacity] = useState(12000);
  const [setupLevels, setSetupLevels] = useState(2);
  const [setupShape, setSetupShape] = useState<Exclude<VenuePlanShapeKind, "custom">>("oval");
  const [setupCapacityMode, setSetupCapacityMode] = useState<VenueCapacityMode>("smart");
  const [setupOuterWidth, setSetupOuterWidth] = useState(205);
  const [setupOuterHeight, setSetupOuterHeight] = useState(155);
  const [setupFieldWidth, setSetupFieldWidth] = useState(105);
  const [setupFieldHeight, setSetupFieldHeight] = useState(68);
  const [setupRings, setSetupRings] = useState<StadiumRingInput[]>([{ name: "Anello 1", capacity: 5500, sectorCount: 8 }, { name: "Anello 2", capacity: 6500, sectorCount: 10 }]);
  const [showAllRings, setShowAllRings] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [viewport, setViewport] = useState({ x: 0, y: 0, width: document.widthM, height: document.heightM });
  const drag = useRef<{ startX: number; startY: number; before: VenueDocument; originals: Map<string, VenueElement>; moved: boolean } | null>(null);
  const vertexDrag = useRef<{ elementId: string; vertexIndex: number; before: VenueDocument } | null>(null);
  const pan = useRef<{ clientX: number; clientY: number; before: typeof viewport } | null>(null);
  const board = useRef<SVGSVGElement>(null);
  const selected = document.elements.find((element) => element.id === selectedIds[0]);
  const selectedBounds = selected ? polygonBounds(selected.polygon) : undefined;
  const totalSeats = useMemo(() => countSeats(document), [document]);
  const activeLayouts = useMemo(() => layouts.filter((layout) => !layout.archived_at), [layouts]);
  const archivedLayouts = useMemo(() => layouts.filter((layout) => Boolean(layout.archived_at)), [layouts]);
  const currentLayout = layouts.find((layout) => layout.id === layoutId);
  const cadastralPolygons = useMemo(() => document.elements.filter((element) => element.parentId === "__cadastral_boundary__").map((element) => element.polygon), [document.elements]);
  const outsideCount = useMemo(() => document.elements.filter((element) => element.parentId !== "__cadastral_boundary__" && element.polygon.some((point) => cadastralPolygons.length > 0 ? !cadastralPolygons.some((polygon) => pointInLocalPolygon(point, polygon)) : point.x < 0 || point.y < 0 || point.x > document.widthM || point.y > document.heightM)).length, [cadastralPolygons, document.elements, document.heightM, document.widthM]);
  const visibleElementTools = showAdvancedElements ? elementTools : elementTools.filter(({ kind }) => primaryElementKinds.has(kind));
  const toolHelp = tool === "polygon"
    ? "Disegna un'area: clicca almeno 3 punti sulla pianta, poi premi Completa."
    : tool === "seat"
      ? selected
        ? `Aggiungi posti a ${selected.label}: clicca sulla pianta nel punto desiderato.`
        : "Prima seleziona un settore con posti, poi usa questo strumento."
      : tool === "place" && pendingElementKind
        ? `Clicca sulla pianta dove vuoi inserire ${kindLabels[pendingElementKind].toLowerCase()}.`
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

  const duplicateSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const clones = document.elements.filter((element) => selectedIds.includes(element.id)).map((element) => {
      const id = `${element.kind}-${crypto.randomUUID()}`;
      return {
        ...structuredClone(element),
        id,
        label: `${element.label} copia`,
        polygon: element.polygon.map((point) => ({ x: point.x + 4, y: point.y + 4 })),
        geometry: element.geometry ? { ...element.geometry, center: { x: element.geometry.center.x + 4, y: element.geometry.center.y + 4 } } : undefined,
        seatOverrides: element.seatOverrides?.map((seat) => ({ ...seat, id: `${seat.id}-${id}`, x: seat.x + 4, y: seat.y + 4 })),
      } satisfies VenueElement;
    });
    commit({ ...document, elements: [...document.elements, ...clones] });
    setSelectedIds(clones.map((element) => element.id));
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
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d" && !isEditing) { event.preventDefault(); duplicateSelected(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a" && !isEditing) { event.preventDefault(); setSelectedIds(document.elements.filter((element) => element.levelId === activeLevelId && !element.hidden).map((element) => element.id)); }
      else if ((event.key === "Delete" || event.key === "Backspace") && !isEditing) removeSelected();
      else if (event.key === "Enter") completePolygon();
      else if (event.key === "Escape") { setDraftPolygon([]); setTool("select"); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [activeLevelId, completePolygon, document.elements, duplicateSelected, redo, removeSelected, undo]);

  useEffect(() => {
    if (saved) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [saved]);

  function worldPoint(event: Pick<ReactPointerEvent<Element>, "clientX" | "clientY">) {
    const matrix = board.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }

  function snappedPoint(point: { x: number; y: number }) {
    if (!snapEnabled) return point;
    return { x: Math.round(point.x), y: Math.round(point.y) };
  }

  function fitViewport(nextDocument = document) {
    setViewport({ x: 0, y: 0, width: nextDocument.widthM, height: nextDocument.heightM });
  }

  function zoomAt(clientX: number, clientY: number, factor: number) {
    const matrix = board.current?.getScreenCTM();
    if (!matrix) return;
    const anchor = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    setViewport((current) => {
      const width = Math.max(document.widthM * .15, Math.min(document.widthM * 2, current.width / factor));
      const height = width * document.heightM / document.widthM;
      const ratio = width / current.width;
      return { x: anchor.x - (anchor.x - current.x) * ratio, y: anchor.y - (anchor.y - current.y) * ratio, width, height };
    });
  }

  function zoomBy(factor: number) {
    setViewport((current) => {
      const width = Math.max(document.widthM * .15, Math.min(document.widthM * 2, current.width / factor));
      const height = width * document.heightM / document.widthM;
      return { x: current.x + (current.width - width) / 2, y: current.y + (current.height - height) / 2, width, height };
    });
  }

  function boardWheel(event: ReactWheelEvent<SVGSVGElement>) {
    event.preventDefault();
    zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.15 : 1 / 1.15);
  }

  function boardPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (tool === "pan") {
      pan.current = { clientX: event.clientX, clientY: event.clientY, before: viewport };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const point = snappedPoint(worldPoint(event));
    if (tool === "polygon") { setDraftPolygon((points) => [...points, point]); return; }
    if (tool === "seat" && selected) {
      const manualNumbers = selected.seatOverrides?.filter((seat) => seat.row === "M" && !seat.deleted).map((seat) => Number(seat.number)).filter(Number.isFinite) ?? [];
      const seat = { id: `seat-${crypto.randomUUID()}`, row: "M", number: String(Math.max(0, ...manualNumbers) + 1), x: point.x, y: point.y };
      commit({ ...document, elements: document.elements.map((element) => element.id === selected.id ? { ...element, seatOverrides: [...(element.seatOverrides ?? []), seat] } : element) });
      return;
    }
    if (tool === "place" && pendingElementKind) {
      const kind = pendingElementKind;
      const width = kind === "entrance" || kind === "exit" ? 8 : kind === "aisle" || kind === "barrier" ? 42 : 32;
      const height = kind === "entrance" || kind === "exit" ? 5 : kind === "aisle" || kind === "barrier" ? 4 : 18;
      const x = Math.max(0, Math.min(document.widthM - width, point.x - width / 2));
      const y = Math.max(0, Math.min(document.heightM - height, point.y - height / 2));
      const element: VenueElement = { id: `${kind}-${crypto.randomUUID()}`, kind, label: `${kindLabels[kind]} ${document.elements.filter((item) => item.kind === kind).length + 1}`, levelId: activeLevelId, scope: "level", polygon: rectangle(x, y, width, height), rows: seatedKinds.has(kind) ? 12 : undefined, seatsPerRow: seatedKinds.has(kind) ? 28 : undefined, rowStyle: kind === "curve" ? "curved" : "straight" };
      commit({ ...document, elements: [...document.elements, element] });
      setSelectedIds([element.id]);
      setPendingElementKind(undefined);
      setTool("select");
      return;
    }
    if (event.target === event.currentTarget) setSelectedIds([]);
  }

  function movePan(event: ReactPointerEvent<SVGSVGElement>) {
    const active = pan.current;
    const matrix = board.current?.getScreenCTM();
    if (!active || !matrix) return;
    const start = new DOMPoint(active.clientX, active.clientY).matrixTransform(matrix.inverse());
    const current = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    setViewport({ ...active.before, x: active.before.x - (current.x - start.x), y: active.before.y - (current.y - start.y) });
  }

  function endPan() {
    pan.current = null;
  }

  function startDrag(event: ReactPointerEvent<SVGPolygonElement>, element: VenueElement) {
    if (tool !== "select" || element.locked || document.levels.find((level) => level.id === element.levelId)?.locked) return;
    event.stopPropagation();
    const point = snappedPoint(worldPoint(event));
    const nextSelection = event.shiftKey ? (selectedIds.includes(element.id) ? selectedIds.filter((id) => id !== element.id) : [...selectedIds, element.id]) : selectedIds.includes(element.id) ? selectedIds : [element.id];
    setSelectedIds(nextSelection);
    const originals = new Map(document.elements.filter((item) => nextSelection.includes(item.id)).map((item) => [item.id, structuredClone(item)]));
    drag.current = { startX: point.x, startY: point.y, before: document, originals, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<SVGPolygonElement>) {
    const active = drag.current;
    if (!active) return;
    const point = snappedPoint(worldPoint(event));
    const dx = point.x - active.startX;
    const dy = point.y - active.startY;
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) active.moved = true;
    setDocument((current) => ({ ...current, elements: current.elements.map((element) => {
      const original = active.originals.get(element.id);
      return original ? {
        ...element,
        polygon: original.polygon.map((vertex) => ({ x: vertex.x + dx, y: vertex.y + dy })),
        geometry: original.geometry ? { ...original.geometry, center: { x: original.geometry.center.x + dx, y: original.geometry.center.y + dy } } : undefined,
        seatOverrides: original.seatOverrides?.map((seat) => ({ ...seat, x: seat.x + dx, y: seat.y + dy })),
      } : element;
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
    const point = snappedPoint(worldPoint(event));
    setDocument((current) => ({ ...current, elements: current.elements.map((element) => element.id === active.elementId ? { ...element, geometry: undefined, polygon: element.polygon.map((vertex, index) => index === active.vertexIndex ? point : vertex) } : element) }));
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
    setPendingElementKind(kind);
    setTool("place");
  }

  function updateElement(patch: Partial<VenueElement>) {
    if (!selected) return;
    commit({ ...document, elements: document.elements.map((element) => element.id === selected.id ? { ...element, ...patch } : element) });
  }

  function updateBounds(key: "x" | "y" | "width" | "height", value: number) {
    if (!selected || !selectedBounds || !Number.isFinite(value)) return;
    const old = selectedBounds;
    const next = { ...old, [key]: key === "width" || key === "height" ? Math.max(.5, value) : value };
    const transform = (point: { x: number; y: number }) => ({ x: next.x + (point.x - old.x) / (old.width || 1) * next.width, y: next.y + (point.y - old.y) / (old.height || 1) * next.height });
    const scaleX = next.width / (old.width || 1);
    const scaleY = next.height / (old.height || 1);
    updateElement({
      polygon: selected.polygon.map(transform),
      geometry: selected.geometry ? { ...selected.geometry, center: transform(selected.geometry.center), innerWidthM: selected.geometry.innerWidthM * scaleX, outerWidthM: selected.geometry.outerWidthM * scaleX, innerHeightM: selected.geometry.innerHeightM * scaleY, outerHeightM: selected.geometry.outerHeightM * scaleY, cornerRadiusM: selected.geometry.cornerRadiusM === undefined ? undefined : selected.geometry.cornerRadiusM * Math.min(scaleX, scaleY) } : undefined,
      seatOverrides: selected.seatOverrides?.map((seat) => ({ ...seat, ...transform(seat) })),
    });
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
    const next = generateVenueDocument(venueKind, capacity, document.levels.length, {
      shape: document.planShape.kind === "custom" ? undefined : document.planShape.kind,
      outerWidthM: document.planShape.outerWidthM,
      outerHeightM: document.planShape.outerHeightM,
      fieldWidthM: document.planShape.fieldWidthM,
      fieldHeightM: document.planShape.fieldHeightM,
      rings: document.levels.map((level) => ({ name: level.name, sectorCount: level.ring?.sectorCount })),
    });
    commit(next);
    fitViewport(next);
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
    setLayoutNotice("Copia creata. La configurazione originale resta invariata.");
  }

  function openLayout(layout: StoredLayout) {
    setLayoutId(layout.id);
    setLayoutName(layout.name);
    const next = parseDocument(layout);
    setDocument(next);
    fitViewport(next);
    setActiveLevelId(next.levels[0].id);
    setSelectedIds([]);
    setPast([]);
    setFuture([]);
    setError("");
    setSaved(true);
  }

  async function makeLayoutDefault() {
    if (!initialVenue || !layoutId) return;
    if (!saved) { setError("Salva le modifiche prima di cambiare la configurazione predefinita."); return; }
    setLayoutPending(true);
    setError("");
    setLayoutNotice("");
    try {
      const response = await fetch(`/api/control/v1/venues/${initialVenue.id}/layouts/${layoutId}/default`, { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Configurazione predefinita non aggiornata");
      setLayouts((items) => items.map((layout) => ({ ...layout, is_default: layout.id === layoutId })));
      setLayoutNotice("Questa configurazione verrà proposta per prima nei nuovi eventi.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Operazione non riuscita"); }
    finally { setLayoutPending(false); }
  }

  async function setLayoutArchived(target: StoredLayout, archived: boolean) {
    if (!initialVenue) return;
    if (archived && target.id === layoutId && !saved) { setError("Salva o annulla le modifiche prima di archiviare questa configurazione."); return; }
    if (archived && !window.confirm(`Archiviare ${target.name}? Gli eventi già creati manterranno la loro copia della pianta.`)) return;
    setLayoutPending(true);
    setError("");
    setLayoutNotice("");
    try {
      const response = await fetch(`/api/control/v1/venues/${initialVenue.id}/layouts/${target.id}/archive`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ archived }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Stato configurazione non aggiornato");
      const changedAt = archived ? new Date().toISOString() : null;
      setLayouts((items) => items.map((layout) => layout.id === target.id ? { ...layout, archived_at: changedAt, is_default: archived ? false : layout.is_default } : layout));
      if (archived && target.id === layoutId) {
        const fallback = layouts.find((layout) => layout.id !== target.id && layout.is_default && !layout.archived_at) ?? layouts.find((layout) => layout.id !== target.id && !layout.archived_at);
        if (fallback) openLayout(fallback);
      }
      setLayoutNotice(archived ? "Configurazione archiviata. Non verrà proposta nei nuovi eventi." : "Configurazione ripristinata e nuovamente disponibile.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Operazione non riuscita"); }
    finally { setLayoutPending(false); }
  }

  function applyCadastre(selection: CadastralSelection, combine: boolean) {
    const source = selection.source;
    const geometry = selection.selected?.geometry;
    if (!geometry?.coordinates) return;
    const previous = combine ? document.boundary : undefined;
    const polygons = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
    const previousPolygons = previous?.type === "MultiPolygon" ? previous.coordinates : previous?.type === "Polygon" ? [previous.coordinates] : [];
    const boundary: GeoPolygon | GeoMultiPolygon = previousPolygons.length > 0 || polygons.length > 1 ? { type: "MultiPolygon", coordinates: [...previousPolygons, ...polygons] } : { type: "Polygon", coordinates: polygons[0] };
    const rings = projectGeoBoundaryRings(boundary, document.widthM, document.heightM);
    const boundaryElements: VenueElement[] = rings.map((polygon, index) => ({ id: `cadastre-${crypto.randomUUID()}`, kind: "free-area", label: `Confine lotto ${index + 1}`, levelId: activeLevelId, parentId: "__cadastral_boundary__", polygon }));
    commit({ ...document, boundary, cadastralSources: combine ? [...(document.cadastralSources ?? []), source] : [source], elements: [...boundaryElements, ...document.elements.filter((element) => element.parentId !== "__cadastral_boundary__")] });
    setSelectedIds(boundaryElements.map((element) => element.id));
    setPendingCadastre(undefined);
    setShowMap(false);
  }

  function generateInitialVenue() {
    setError("");
    const manualTotal = setupRings.reduce((sum, ring) => sum + (ring.capacity ?? 0), 0);
    if ((venueKind === "stadium" || venueKind === "arena") && setupCapacityMode === "manual" && manualTotal !== setupCapacity) {
      setError(`Le capienze degli anelli sommano ${manualTotal.toLocaleString("it-IT")}, ma il totale richiesto è ${setupCapacity.toLocaleString("it-IT")}.`);
      return;
    }
    try {
      const next = generateVenueDocument(venueKind, setupCapacity, setupLevels, { shape: setupShape, capacityMode: setupCapacityMode, outerWidthM: setupOuterWidth, outerHeightM: setupOuterHeight, fieldWidthM: setupFieldWidth, fieldHeightM: setupFieldHeight, rings: setupRings });
      setDocument(next);
      fitViewport(next);
      setActiveLevelId(next.levels[0].id);
      setPast([]);
      setFuture([]);
      setSaved(false);
      setSetupComplete(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Configurazione dello stadio non valida.");
    }
  }

  function updateSetupRing(index: number, patch: StadiumRingInput) {
    setSetupRings((rings) => rings.map((ring, ringIndex) => ringIndex === index ? { ...ring, ...patch } : ring));
  }

  function changeSetupLevels(nextCount: number) {
    setSetupLevels(nextCount);
    setSetupRings((current) => Array.from({ length: nextCount }, (_, index) => current[index] ?? {
      name: `Anello ${index + 1}`,
      capacity: Math.floor(setupCapacity / nextCount) + (index < setupCapacity % nextCount ? 1 : 0),
      sectorCount: Math.max(4, Math.min(32, Math.round(setupCapacity / nextCount / 900))),
    }));
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
    const shapeOptions: Array<{ value: Exclude<VenuePlanShapeKind, "custom">; label: string; note: string }> = [
      { value: "oval", label: "Ovale", note: "Calcio e atletica" },
      { value: "circle", label: "Circolare", note: "Arene compatte" },
      { value: "rounded-rectangle", label: "Rettangolo stondato", note: "Tribune più lineari" },
    ];
    const manualTotal = setupRings.reduce((sum, ring) => sum + (ring.capacity ?? 0), 0);
    let previewRingCapacities: number[] = [];
    if ((venueKind === "stadium" || venueKind === "arena") && setupCapacityMode !== "manual") {
      try {
        previewRingCapacities = generateVenueDocument(venueKind, setupCapacity, setupLevels, { shape: setupShape, capacityMode: setupCapacityMode, outerWidthM: setupOuterWidth, outerHeightM: setupOuterHeight, fieldWidthM: setupFieldWidth, fieldHeightM: setupFieldHeight, rings: setupRings }).levels.map((level) => level.ring?.capacity ?? 0);
      } catch { previewRingCapacities = []; }
    }
    return <div className="overflow-hidden rounded-[34px] border border-white/10 bg-[#101415] shadow-[0_28px_90px_-40px_rgba(0,0,0,.85)]">
      <div className="border-b border-white/10 p-6 sm:p-8"><p className="font-mono text-[9px] uppercase tracking-[.2em] text-[#d1e66a]">CONFIGURAZIONE GUIDATA · PRIMA DELLA PIANTA</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.05em]">Com&apos;è fatto davvero lo stadio?</h2><p className="mt-3 max-w-3xl text-xs leading-5 text-[#858d8b]">Definisci forma, anelli, capienza e settori. onePixel costruirà bande concentriche reali, tutte visibili e selezionabili singolarmente.</p></div>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-8 p-6 sm:p-8">
          <section><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#68716f]">01 · TIPO DI SPAZIO</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{options.map((option) => <button type="button" key={option.value} onClick={() => setVenueKind(option.value)} className={`min-h-24 rounded-[20px] border p-4 text-left transition ${venueKind === option.value ? "border-[#d1e66a]/45 bg-[#d1e66a]/9" : "border-white/8 bg-white/[.02] hover:border-white/15"}`}><BuildingsIcon size={18} className={venueKind === option.value ? "text-[#d1e66a]" : "text-[#68706f]"} /><span className="mt-3 block text-xs font-semibold text-white">{option.label}</span><span className="mt-1 block text-[9px] text-[#707876]">{option.note}</span></button>)}</div></section>
          {(venueKind === "stadium" || venueKind === "arena") && <>
            <section><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#68716f]">02 · FORMA VISTA DALL&apos;ALTO</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{shapeOptions.map((shape) => <button type="button" key={shape.value} onClick={() => setSetupShape(shape.value)} className={`rounded-[20px] border p-4 text-left transition ${setupShape === shape.value ? "border-[#d1e66a]/45 bg-[#d1e66a]/9" : "border-white/8 bg-white/[.02]"}`}><span className="block text-xs font-semibold text-white">{shape.label}</span><span className="mt-1 block text-[9px] text-[#707876]">{shape.note}</span></button>)}</div><p className="mt-3 rounded-xl border border-white/8 bg-white/[.02] p-3 text-[10px] text-[#7f8886]">Forma personalizzata/importata: genera prima la base, poi usa <span className="text-[#d1e66a]">Importa da mappa</span> nell&apos;editor.</p></section>
            <section><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#68716f]">03 · ANELLI E SETTORI</p><p className="mt-2 text-xs text-[#929a98]">Ogni anello può avere nome, capienza e numero di settori diversi.</p></div><label className="editor-label w-32">Numero anelli<select value={setupLevels} onChange={(event) => changeSetupLevels(Number(event.target.value))} className="editor-input h-10">{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label></div>
              <div className="mt-4 grid gap-2">{setupRings.map((ring, index) => <div key={index} className="grid gap-2 rounded-2xl border border-white/8 bg-white/[.02] p-3 sm:grid-cols-[minmax(120px,1fr)_140px_120px]"><label className="editor-label">Nome<input value={ring.name ?? ""} onChange={(event) => updateSetupRing(index, { name: event.target.value })} className="editor-input" /></label><label className="editor-label">Capienza<input type="number" min="1" value={setupCapacityMode === "manual" ? ring.capacity ?? 0 : previewRingCapacities[index] ?? 0} disabled={setupCapacityMode !== "manual"} onChange={(event) => updateSetupRing(index, { capacity: Math.max(1, Number(event.target.value)) })} className="editor-input font-mono disabled:opacity-60" /></label><label className="editor-label">Settori<input type="number" min="1" max="64" value={ring.sectorCount ?? 1} onChange={(event) => updateSetupRing(index, { sectorCount: Math.max(1, Number(event.target.value)) })} className="editor-input font-mono" /></label></div>)}</div>
            </section>
          </>}
        </div>
        <aside className="border-t border-white/10 bg-[#0d1112] p-6 sm:p-8 xl:border-l xl:border-t-0"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#68716f]">04 · DIMENSIONAMENTO</p><div className="mt-6 space-y-5"><label className="editor-label">Nome struttura<input value={name} onChange={(event) => setName(event.target.value)} className="editor-input h-11" /></label><label className="editor-label">Capienza totale<input type="number" min={1} max={1000000} step={100} value={setupCapacity} onChange={(event) => setSetupCapacity(Math.max(1, Number(event.target.value)))} className="editor-input h-11 font-mono" /></label>
          {(venueKind === "stadium" || venueKind === "arena") && <><label className="editor-label">Distribuzione<select value={setupCapacityMode} onChange={(event) => setSetupCapacityMode(event.target.value as VenueCapacityMode)} className="editor-input h-11"><option value="smart">Intelligente, in base alla geometria</option><option value="equal">Uguale tra gli anelli</option><option value="manual">Manuale per anello</option></select></label><div className="grid grid-cols-2 gap-2"><label className="editor-label">Stadio larghezza<input type="number" min="60" value={setupOuterWidth} onChange={(event) => setSetupOuterWidth(Number(event.target.value))} className="editor-input font-mono" /></label><label className="editor-label">Stadio altezza<input type="number" min="60" value={setupOuterHeight} onChange={(event) => setSetupOuterHeight(Number(event.target.value))} className="editor-input font-mono" /></label><label className="editor-label">Campo larghezza<input type="number" min="20" value={setupFieldWidth} onChange={(event) => setSetupFieldWidth(Number(event.target.value))} className="editor-input font-mono" /></label><label className="editor-label">Campo altezza<input type="number" min="20" value={setupFieldHeight} onChange={(event) => setSetupFieldHeight(Number(event.target.value))} className="editor-input font-mono" /></label></div></>}
          <div className={`rounded-2xl border p-4 ${setupCapacityMode === "manual" && manualTotal !== setupCapacity ? "border-[#e2a65a]/30 bg-[#e2a65a]/8" : "border-[#d1e66a]/20 bg-[#d1e66a]/6"}`}><p className="font-mono text-2xl text-[#d1e66a]">{setupCapacity.toLocaleString("it-IT")}</p><p className="mt-1 text-[10px] text-[#89918f]">{setupCapacityMode === "manual" ? `Somma anelli: ${manualTotal.toLocaleString("it-IT")}` : `Distribuzione ${setupCapacityMode === "smart" ? "geometrica intelligente" : "uguale"}`}</p></div>{error && <p role="alert" className="rounded-xl border border-[#e26d5a]/25 bg-[#e26d5a]/10 p-3 text-xs text-[#f1a193]">{error}</p>}<button type="button" disabled={name.trim().length < 2 || setupCapacity < 1 || ((venueKind === "stadium" || venueKind === "arena") && setupCapacityMode === "manual" && manualTotal !== setupCapacity)} onClick={generateInitialVenue} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#d1e66a] text-sm font-semibold text-[#101314] disabled:opacity-30">Genera anelli e pianta <ArrowUUpRightIcon size={17} weight="bold" /></button></div></aside>
      </div>
    </div>;
  }

  return (
    <div className="overflow-hidden rounded-[34px] border border-white/10 bg-[#0e1213] shadow-[0_28px_90px_-40px_rgba(0,0,0,.85)]">
      <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#d1e66a] text-[#101314]"><BuildingsIcon size={20} weight="fill" /></span><div className="min-w-0"><input value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} className="w-full min-w-0 bg-transparent text-sm font-semibold text-white outline-none" aria-label="Nome struttura" /><p className="mt-0.5 font-mono text-[9px] uppercase tracking-[.15em] text-[#68716f]">{totalSeats.toLocaleString("it-IT")} POSTI · {document.levels.length} LIVELLI · {document.widthM} × {document.heightM} M</p></div></div>
        <div className="flex items-center gap-2"><button type="button" onClick={undo} disabled={!past.length} className="editor-icon" aria-label="Annulla ultima modifica" title="Annulla ultima modifica"><ArrowUDownLeftIcon size={17} /></button><button type="button" onClick={redo} disabled={!future.length} className="editor-icon" aria-label="Ripeti modifica" title="Ripeti modifica"><ArrowUUpRightIcon size={17} /></button><button type="button" onClick={duplicateSelected} disabled={!selectedIds.length} className="editor-icon" aria-label="Duplica selezione" title="Duplica selezione (Ctrl+D)"><CopyIcon size={16} /></button><button type="button" onClick={() => void save()} disabled={saving || saved} className="flex h-10 items-center gap-2 rounded-full bg-[#d1e66a] px-4 text-xs font-semibold text-[#101314] transition active:scale-[.98] disabled:bg-white/5 disabled:text-[#697170]"><FloppyDiskIcon size={16} weight="bold" />{saving ? "Salvataggio…" : saved ? "Modifiche salvate" : "Salva modifiche"}</button></div>
      </div>

      <div className="grid gap-2 border-b border-white/10 bg-[#0b0e0f] px-4 py-3 text-[10px] text-[#8e9794] sm:grid-cols-4 sm:px-5">
        {["1 · Scegli uno strumento", "2 · Tocca la pianta", "3 · Personalizza a destra", "4 · Salva le modifiche"].map((step) => <span key={step} className="rounded-lg border border-white/8 bg-white/[.025] px-3 py-2">{step}</span>)}
      </div>

      <div className="grid min-h-[720px] xl:grid-cols-[250px_minmax(0,1fr)_290px]">
        <aside className="border-b border-white/10 bg-[#101415] p-4 xl:border-b-0 xl:border-r">
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">
            <button type="button" onClick={() => setTool("select")} className={`editor-tool ${tool === "select" ? "editor-tool-active" : ""}`}><SelectionIcon size={18} />Seleziona e modifica</button>
            <button type="button" onClick={() => setTool("pan")} className={`editor-tool ${tool === "pan" ? "editor-tool-active" : ""}`}><HandIcon size={18} />Sposta la tavola</button>
            <button type="button" onClick={() => { setTool("polygon"); setDraftPolygon([]); }} className={`editor-tool ${tool === "polygon" ? "editor-tool-active" : ""}`}><PencilSimpleLineIcon size={18} />Disegna un&apos;area</button>
            <button type="button" onClick={() => setTool("seat")} disabled={!selected || !seatedKinds.has(selected.kind)} title={!selected || !seatedKinds.has(selected.kind) ? "Seleziona prima un settore, una tribuna o un blocco posti" : "Aggiungi singoli posti sulla pianta"} className={`editor-tool ${tool === "seat" ? "editor-tool-active" : ""}`}><ChairIcon size={18} />Aggiungi un posto</button>
            <button type="button" onClick={() => setShowMap(true)} className="editor-tool"><MapPinIcon size={18} />Importa da mappa</button>
          </div>
          <p className="mt-3 rounded-xl border border-[#d1e66a]/15 bg-[#d1e66a]/6 p-3 text-[10px] leading-4 text-[#b9c48b]" aria-live="polite">{toolHelp}</p>
          <p className="mb-2 mt-6 font-mono text-[9px] uppercase tracking-[.18em] text-[#616967]">AGGIUNGI ELEMENTO</p>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-1">{visibleElementTools.map(({ kind, label, icon: Icon }) => <button key={kind} type="button" onClick={() => addElement(kind)} title={`Scegli dove inserire ${label.toLowerCase()}`} className={`editor-tool ${tool === "place" && pendingElementKind === kind ? "editor-tool-active" : ""}`}><Icon size={17} />{label}</button>)}</div>
          <button type="button" onClick={() => setShowAdvancedElements((value) => !value)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/8 px-3 py-2.5 text-[10px] text-[#858d8b] transition hover:border-white/20 hover:text-white" aria-expanded={showAdvancedElements}><CaretDownIcon size={14} className={`transition ${showAdvancedElements ? "rotate-180" : ""}`} />{showAdvancedElements ? "Nascondi elementi avanzati" : "Mostra altri elementi"}</button>
          <div className="mt-6 border-t border-white/8 pt-4"><div className="flex items-center justify-between"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#616967]">OGGETTI · {document.levels.find((level) => level.id === activeLevelId)?.name}</p><button type="button" onClick={() => setSelectedIds(document.elements.filter((element) => element.levelId === activeLevelId && !element.hidden).map((element) => element.id))} className="text-[8px] text-[#d1e66a]">SELEZIONA TUTTI</button></div><div className="mt-2 max-h-44 space-y-1 overflow-y-auto">{document.elements.filter((element) => element.levelId === activeLevelId && element.parentId !== "__cadastral_boundary__").map((element) => <button type="button" key={element.id} onClick={(event) => setSelectedIds(event.shiftKey ? [...new Set([...selectedIds, element.id])] : [element.id])} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] ${selectedIds.includes(element.id) ? "bg-[#d1e66a]/10 text-[#d1e66a]" : "bg-white/[.02] text-[#969e9c] hover:bg-white/[.05]"}`}><span className="min-w-0 flex-1 truncate">{element.label}</span>{element.locked && <LockIcon size={11} />}</button>)}</div></div>
          <div className="mt-6 border-t border-white/8 pt-4"><label className="grid gap-2 text-[10px] text-[#858d8b]">Tipo struttura<select value={venueKind} onChange={(event) => setVenueKind(event.target.value as StoredVenue["kind"])} className="h-10 rounded-xl border border-white/10 bg-[#0b0e0f] px-3 text-xs text-white"><option value="stadium">Stadio</option><option value="arena">Palazzetto</option><option value="concert">Concerto</option><option value="square">Piazza</option><option value="outdoor">Area esterna</option><option value="fairground">Fiera</option><option value="custom">Personalizzata</option></select></label><button type="button" onClick={regenerate} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#e2a65a]/20 text-xs text-[#c7a56f] transition hover:bg-[#e2a65a]/8 hover:text-white" title="Sostituisce la pianta attuale con una nuova base automatica"><ArrowCounterClockwiseIcon size={16} />Rigenera tutta la pianta</button><p className="mt-2 text-[9px] leading-4 text-[#68716f]">Azione avanzata: sostituisce gli elementi attuali dopo una conferma.</p></div>
        </aside>

        <section className="relative min-h-[560px] overflow-hidden bg-[#0b0e0f] surface-grid">
          <div className="absolute left-4 top-4 z-[2] flex flex-wrap gap-2"><button type="button" onClick={() => setShowAllRings((value) => !value)} className={`rounded-full border px-3 py-1.5 font-mono text-[9px] backdrop-blur ${showAllRings ? "border-[#d1e66a]/30 bg-[#d1e66a]/10 text-[#d1e66a]" : "border-white/10 bg-[#0c1011]/90 text-[#aab1af]"}`}>{showAllRings ? "TUTTI GLI ANELLI" : `SOLO ${document.levels.find((level) => level.id === activeLevelId)?.name.toUpperCase()}`}</button>{document.boundary && <span className="rounded-full border border-[#d1e66a]/25 bg-[#d1e66a]/10 px-3 py-1.5 font-mono text-[9px] text-[#d1e66a]">CONFINE CATASTALE COLLEGATO</span>}{outsideCount > 0 && <span className="rounded-full border border-[#e2a65a]/25 bg-[#e2a65a]/10 px-3 py-1.5 font-mono text-[9px] text-[#e2a65a]">{outsideCount} FUORI CONFINE</span>}</div>
          <div className="absolute right-4 top-4 z-[3] flex items-center rounded-full border border-white/10 bg-[#0c1011]/90 p-1 backdrop-blur"><button type="button" onClick={() => setSnapEnabled((value) => !value)} className={`h-7 rounded-full px-2.5 font-mono text-[8px] ${snapEnabled ? "bg-[#d1e66a]/12 text-[#d1e66a]" : "text-[#7b8381]"}`} aria-pressed={snapEnabled}>SNAP {snapEnabled ? "ON" : "OFF"}</button><button type="button" onClick={() => zoomBy(1 / 1.2)} className="editor-mini" aria-label="Riduci zoom"><MagnifyingGlassMinusIcon size={13} /></button><button type="button" onClick={() => fitViewport()} className="h-7 rounded-full px-2 font-mono text-[8px] text-[#aab1af]">ADATTA</button><button type="button" onClick={() => zoomBy(1.2)} className="editor-mini" aria-label="Aumenta zoom"><MagnifyingGlassPlusIcon size={13} /></button></div>
          <div className="absolute inset-4 top-16 overflow-hidden rounded-[26px] border border-white/10 bg-[#111617] shadow-[inset_0_0_80px_rgba(0,0,0,.28)] sm:inset-6 sm:top-16">
            <svg ref={board} viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`} preserveAspectRatio="xMidYMid meet" onWheel={boardWheel} onPointerDown={boardPointerDown} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} className={`absolute inset-0 size-full touch-none ${tool === "place" ? "cursor-crosshair" : tool === "pan" ? "cursor-grab active:cursor-grabbing" : ""}`} aria-label="Tavola 2D della struttura">
              {document.elements.filter((element) => {
                const level = document.levels.find((item) => item.id === element.levelId);
                return !element.hidden && !level?.hidden && (element.scope === "shared" || element.parentId === "__cadastral_boundary__" || (showAllRings ? level?.role === "ring" : element.levelId === activeLevelId));
              }).map((element) => {
                const active = selectedIds.includes(element.id);
                const isBoundary = element.parentId === "__cadastral_boundary__";
                const bounds = polygonBounds(element.polygon);
                const points = element.polygon.map((point) => `${point.x},${point.y}`).join(" ");
                return <g key={element.id} transform={`rotate(${element.rotation ?? 0} ${bounds.x + bounds.width / 2} ${bounds.y + bounds.height / 2})`}><polygon points={points} fill={isBoundary ? "#d1e66a" : elementColor(element.kind, active)} fillOpacity={isBoundary ? (active ? .14 : .055) : active ? .95 : .78} stroke={isBoundary ? "#d1e66a" : active ? "#f2f3ed" : "rgba(255,255,255,.16)"} strokeDasharray={isBoundary ? "2 1.5" : undefined} strokeWidth={isBoundary ? .75 : active ? .8 : .35} vectorEffect="non-scaling-stroke" onPointerDown={(event) => startDrag(event, element)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} className="transition-[fill,stroke] duration-200" /><text x={bounds.x + bounds.width / 2} y={bounds.y + bounds.height / 2} textAnchor="middle" dominantBaseline="middle" fill={active && !isBoundary ? "#101314" : isBoundary ? "#d1e66a" : "#d7ddda"} fontSize={Math.max(2.5, Math.min(5, bounds.width / 6))} fontWeight="650" pointerEvents="none">{element.label}</text>{element.locked && <circle cx={bounds.x + 2} cy={bounds.y + 2} r="1.4" fill="#e2a65a" />}{active && element.polygon.map((vertex, vertexIndex) => <circle key={vertexIndex} cx={vertex.x} cy={vertex.y} r="1.8" fill="#f2f3ed" stroke="#101314" strokeWidth=".5" vectorEffect="non-scaling-stroke" onPointerDown={(event) => startVertexDrag(event, element, vertexIndex)} onPointerMove={moveVertexDrag} onPointerUp={endVertexDrag} onPointerCancel={endVertexDrag} />)}</g>;
              })}
              {draftPolygon.length > 0 && <polyline points={draftPolygon.map((point) => `${point.x},${point.y}`).join(" ")} fill="rgba(209,230,106,.08)" stroke="#d1e66a" strokeWidth=".7" strokeDasharray="2 2" />}
            </svg>
            <SeatLayer document={document} levelId={activeLevelId} showAllRings={showAllRings} viewport={viewport} />
          </div>
          {tool === "polygon" && <div className="absolute bottom-5 left-1/2 z-[3] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#0b0e0f]/95 p-1.5 pl-4 text-[10px] text-[#aab1af] backdrop-blur-xl"><span>Clicca i vertici, poi completa</span><button type="button" onClick={completePolygon} disabled={draftPolygon.length < 3} className="rounded-full bg-[#d1e66a] px-3 py-1.5 font-semibold text-[#101314] disabled:opacity-30">Completa</button><button type="button" onClick={() => { setDraftPolygon([]); setTool("select"); }} className="grid size-7 place-items-center rounded-full hover:bg-white/5" aria-label="Annulla forma"><XIcon size={14} /></button></div>}
        </section>

        <aside className="border-t border-white/10 bg-[#101415] p-4 xl:border-l xl:border-t-0">
          <div className="flex items-center justify-between"><div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-[#68716f]">VERSIONE DELLA PIANTA</p><p className="mt-1 text-[9px] text-[#68716f]">Crea varianti senza perdere l&apos;originale.</p></div>{initialVenue && <button type="button" onClick={() => void duplicateLayout()} disabled={layoutPending} className="editor-icon" aria-label="Crea una copia della configurazione" title="Crea una copia"><CopyIcon size={15} /></button>}</div>
          {activeLayouts.length > 0 && <select value={layoutId} aria-label="Configurazione da modificare" onChange={(event) => { const layout = activeLayouts.find((item) => item.id === event.target.value); if (!layout) return; if (!saved && !window.confirm("Hai modifiche non salvate. Vuoi cambiare configurazione e perderle?")) return; openLayout(layout); setLayoutNotice(""); }} className="mt-3 h-10 w-full rounded-xl border border-white/10 bg-[#0b0e0f] px-3 text-xs text-white">{activeLayouts.map((layout) => <option key={layout.id} value={layout.id}>{layout.name} · v{layout.version}{layout.is_default ? " · predefinita" : ""}</option>)}</select>}
          <input value={layoutName} onChange={(event) => { setLayoutName(event.target.value); setSaved(false); }} className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-[#0b0e0f] px-3 text-xs text-white" aria-label="Nome configurazione" />
          {currentLayout && <div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => void makeLayoutDefault()} disabled={layoutPending || currentLayout.is_default || !saved} className={`flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-[9px] transition disabled:opacity-45 ${currentLayout.is_default ? "border-[#d1e66a]/25 bg-[#d1e66a]/8 text-[#d1e66a]" : "border-white/10 text-[#aab1af] hover:border-[#d1e66a]/25 hover:text-white"}`}><StarIcon size={13} weight={currentLayout.is_default ? "fill" : "regular"} />{currentLayout.is_default ? "Predefinita" : "Imposta predefinita"}</button><button type="button" onClick={() => void setLayoutArchived(currentLayout, true)} disabled={layoutPending || currentLayout.is_default || activeLayouts.length <= 1} title={currentLayout.is_default ? "Scegli prima un'altra configurazione predefinita" : activeLayouts.length <= 1 ? "Deve restare almeno una configurazione attiva" : "Archivia configurazione"} className="grid size-9 place-items-center rounded-xl border border-white/10 text-[#e2a65a] transition hover:bg-[#e2a65a]/8 disabled:opacity-25" aria-label="Archivia configurazione"><ArchiveIcon size={14} /></button></div>}
          {layoutNotice && <p role="status" className="mt-2 rounded-xl border border-[#77a4a1]/20 bg-[#77a4a1]/8 p-2.5 text-[9px] leading-4 text-[#9fc7c4]">{layoutNotice}</p>}
          {archivedLayouts.length > 0 && <details className="mt-3 rounded-xl border border-white/8 bg-white/[.02] p-3"><summary className="cursor-pointer text-[9px] text-[#8f9795]">Archiviate · {archivedLayouts.length}</summary><div className="mt-2 space-y-1">{archivedLayouts.map((layout) => <div key={layout.id} className="flex items-center gap-2 rounded-lg border border-white/6 px-2.5 py-2"><div className="min-w-0 flex-1"><p className="truncate text-[9px] text-[#aab1af]">{layout.name}</p><p className="mt-0.5 font-mono text-[8px] text-[#616967]">v{layout.version} · {layout.capacity.toLocaleString("it-IT")} posti</p></div><button type="button" onClick={() => void setLayoutArchived(layout, false)} disabled={layoutPending} className="rounded-full border border-[#77a4a1]/20 px-2.5 py-1.5 text-[8px] text-[#9fc7c4]">Ripristina</button></div>)}</div></details>}

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
