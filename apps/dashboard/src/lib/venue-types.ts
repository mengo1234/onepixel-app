import {
  generateStadiumVenueDocument,
  migrateVenueDocument,
  type Point2D as ProtocolPoint2D,
  type VenueDocument as ProtocolVenueDocument,
  type VenueDocumentV3,
  type VenueElement as ProtocolVenueElement,
  type VenueElementKind,
  type VenueLevel as ProtocolVenueLevel,
  type StadiumRingInput,
  type VenueCapacityMode,
  type VenuePlanShapeKind,
} from "@onepixel/protocol";

export type Point2D = ProtocolPoint2D;
export type VenueKind = "stadium" | "arena" | "concert" | "square" | "outdoor" | "fairground" | "custom";
export type PhysicalVenueKind = Exclude<VenueKind, "concert">;
export type ElementKind = VenueElementKind;
export type VenueLevel = ProtocolVenueLevel;
export type VenueElement = ProtocolVenueElement;
export type VenueDocument = VenueDocumentV3;
export type StoredLayout = { id: string; name: string; version: number; is_default: boolean; capacity: number; document: ProtocolVenueDocument | string; archived_at?: string | null };
export type StoredVenue = { id: string; name: string; kind: VenueKind; capacity: number; map: unknown };
export type VenueGenerationOptions = {
  shape?: Exclude<VenuePlanShapeKind, "custom">;
  capacityMode?: VenueCapacityMode;
  outerWidthM?: number;
  outerHeightM?: number;
  fieldWidthM?: number;
  fieldHeightM?: number;
  rings?: StadiumRingInput[];
};

export function parseVenueDocument(value: ProtocolVenueDocument | string): VenueDocument {
  const parsed = typeof value === "string" ? JSON.parse(value) as ProtocolVenueDocument : value;
  return migrateVenueDocument(parsed);
}

export function polygonBounds(polygon: Point2D[]) {
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

export function polygonCentroid(polygon: Point2D[]): Point2D {
  if (polygon.length === 0) return { x: 0, y: 0 };
  let twiceArea = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const cross = current.x * next.y - next.x * current.y;
    twiceArea += cross;
    weightedX += (current.x + next.x) * cross;
    weightedY += (current.y + next.y) * cross;
  }
  if (Math.abs(twiceArea) < 1e-8) {
    return {
      x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
      y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length,
    };
  }
  return { x: weightedX / (3 * twiceArea), y: weightedY / (3 * twiceArea) };
}

export function rectangle(x: number, y: number, width: number, height: number): Point2D[] {
  return [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
}

function geographicRings(boundary?: VenueDocument["boundary"]): number[][][] {
  if (!boundary || !Array.isArray(boundary.coordinates)) return [];
  if (boundary.type === "Polygon") return [((boundary.coordinates as unknown[])[0] as number[][] | undefined) ?? []];
  if (boundary.type === "MultiPolygon") return (boundary.coordinates as unknown[]).map((polygon) => ((polygon as unknown[])[0] as number[][] | undefined) ?? []);
  return [];
}

export function projectGeoBoundaryRings(boundary: VenueDocument["boundary"], widthM: number, heightM: number): Point2D[][] {
  const rings = geographicRings(boundary).filter((ring) => ring.length >= 3);
  const coordinates = rings.flat();
  if (coordinates.length === 0) return [];
  const averageLatitude = coordinates.reduce((sum, coordinate) => sum + coordinate[1], 0) / coordinates.length;
  const scaleLongitude = Math.max(.2, Math.cos(averageLatitude * Math.PI / 180));
  const xs = coordinates.map((coordinate) => coordinate[0] * scaleLongitude);
  const ys = coordinates.map((coordinate) => coordinate[1]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const rawWidth = Math.max(1e-9, maxX - minX); const rawHeight = Math.max(1e-9, maxY - minY);
  const scale = Math.min(widthM * .86 / rawWidth, heightM * .86 / rawHeight);
  const renderedWidth = rawWidth * scale; const renderedHeight = rawHeight * scale;
  const offsetX = (widthM - renderedWidth) / 2; const offsetY = (heightM - renderedHeight) / 2;
  return rings.map((ring) => ring.map((coordinate) => ({ x: offsetX + (coordinate[0] * scaleLongitude - minX) * scale, y: offsetY + (maxY - coordinate[1]) * scale })));
}

export function pointInLocalPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index]; const previousPoint = polygon[previous];
    const crosses = (currentPoint.y > point.y) !== (previousPoint.y > point.y) && point.x < (previousPoint.x - currentPoint.x) * (point.y - currentPoint.y) / ((previousPoint.y - currentPoint.y) || Number.EPSILON) + currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function generateVenueDocument(kind: VenueKind, capacity: number, levelsCount = 1, options: VenueGenerationOptions = {}): VenueDocument {
  const widthM = kind === "stadium" ? 220 : kind === "arena" ? 130 : options.outerWidthM ?? 180;
  const heightM = kind === "stadium" ? 170 : kind === "arena" ? 100 : options.outerHeightM ?? 130;
  if (kind === "stadium" || kind === "arena") {
    return generateStadiumVenueDocument({
      shape: options.shape ?? (kind === "arena" ? "circle" : "oval"),
      outerWidthM: options.outerWidthM ?? (kind === "stadium" ? 205 : 112),
      outerHeightM: options.outerHeightM ?? (kind === "stadium" ? 155 : 92),
      fieldWidthM: options.fieldWidthM ?? (kind === "stadium" ? 105 : 54),
      fieldHeightM: options.fieldHeightM ?? (kind === "stadium" ? 68 : 32),
      totalCapacity: Math.max(1, Math.round(capacity)),
      ringCount: Math.max(1, Math.round(levelsCount)),
      capacityMode: options.capacityMode,
      rings: options.rings,
    });
  }
  // Non-stadium venues describe the reusable physical place only. Stages,
  // runways, barriers and temporary audience areas belong to the event setup.
  const physicalLevelsCount = kind === "concert" ? 1 : Math.max(1, levelsCount);
  const levels: VenueLevel[] = Array.from({ length: physicalLevelsCount }, (_, index) => ({ id: `template-level-${index + 1}`, name: physicalLevelsCount === 1 ? "Piano terra" : `Livello ${index + 1}`, order: index, elevationM: index * 8, role: index === 0 ? "ground" : "ring" }));
  if (kind === "custom") {
    const seatsPerRow = Math.max(1, Math.min(2000, Math.ceil(Math.sqrt(capacity))));
    const rows = Math.max(1, Math.ceil(capacity / seatsPerRow));
    const surplus = rows * seatsPerRow - capacity;
    const seatOverrides = Array.from({ length: surplus }, (_, index) => ({ id: `template-custom-deleted-${index + 1}`, row: String(rows), number: String(seatsPerRow - index), x: widthM / 2, y: heightM / 2, deleted: true }));
    const audience: VenueElement = { id: "template-custom-audience", kind: "sector", label: "Area pubblico da configurare", levelId: levels[0].id, scope: "level", polygon: rectangle(widthM * .15, heightM * .15, widthM * .7, heightM * .7), rows, seatsPerRow, seatOverrides: seatOverrides.length ? seatOverrides : undefined, rowStyle: "straight" };
    return { schemaVersion: 3, unit: "m", widthM, heightM, planShape: { kind: "custom", center: { x: widthM / 2, y: heightM / 2 }, outerWidthM: widthM * .9, outerHeightM: heightM * .9 }, levels: [levels[0]], elements: [audience] };
  }
  const sectorCount = Math.max(4, Math.min(32, Math.ceil(Math.max(capacity, 200) / 900)));
  const perLevel = Math.ceil(sectorCount / levels.length);
  const elements: VenueElement[] = [];
  levels.forEach((level, levelIndex) => {
    const count = Math.min(perLevel, sectorCount - levelIndex * perLevel);
    for (let index = 0; index < count; index += 1) {
      const globalSectorIndex = levelIndex * perLevel + index;
      const angle = (index / Math.max(1, count)) * Math.PI * 2;
      const cx = widthM / 2 + Math.cos(angle) * widthM * 0.37;
      const cy = heightM / 2 + Math.sin(angle) * heightM * 0.37;
      const width = 34;
      const height = 18;
      const seats = Math.floor(capacity / sectorCount) + (globalSectorIndex < capacity % sectorCount ? 1 : 0);
      const seatsPerRow = seats === 0 ? 0 : Math.min(40, seats);
      const rows = seats === 0 ? 0 : Math.ceil(seats / seatsPerRow);
      const surplus = rows * seatsPerRow - seats;
      const seatOverrides = Array.from({ length: surplus }, (_, deletedIndex) => ({ id: `template-deleted-${levelIndex + 1}-${index + 1}-${deletedIndex + 1}`, row: String(rows), number: String(seatsPerRow - deletedIndex), x: cx, y: cy, deleted: true }));
      elements.push({ id: `template-sector-${levelIndex + 1}-${index + 1}`, kind: "sector", label: `Settore ${levelIndex + 1}.${index + 1}`, levelId: level.id, scope: "level", polygon: rectangle(cx - width / 2, cy - height / 2, width, height), rotation: angle * 180 / Math.PI + 90, rows, seatsPerRow, seatOverrides: seatOverrides.length ? seatOverrides : undefined, rowStyle: "curved" });
    }
  });
  elements.push({ id: "template-central-area", kind: "free-area", label: "Area centrale disponibile", scope: "shared", polygon: rectangle(widthM * 0.34, heightM * 0.34, widthM * 0.32, heightM * 0.32) });
  elements.push({ id: "template-main-entrance", kind: "entrance", label: "Ingresso principale", scope: "shared", polygon: rectangle(widthM * .47, heightM * .92, widthM * .06, heightM * .035) });
  const shape = "rounded-rectangle";
  return { schemaVersion: 3, unit: "m", widthM, heightM, planShape: { kind: shape, center: { x: widthM / 2, y: heightM / 2 }, outerWidthM: widthM * .9, outerHeightM: heightM * .9, cornerRadiusM: shape === "rounded-rectangle" ? Math.min(widthM, heightM) * .12 : undefined }, levels, elements };
}

export function countSeats(document: VenueDocument): number {
  return document.elements.reduce((total, element) => {
    if (element.hidden) return total;
    const generated = new Set<string>();
    for (let row = 1; row <= Math.max(0, element.rows ?? 0); row += 1) {
      for (let seat = 1; seat <= Math.max(0, element.seatsPerRow ?? 0); seat += 1) generated.add(`${row}-${seat}`);
    }
    const active = new Set(element.seatOverrides?.filter((seat) => !seat.deleted).map((seat) => `${seat.row}-${seat.number}`) ?? []);
    const deleted = new Set(element.seatOverrides?.filter((seat) => seat.deleted).map((seat) => `${seat.row}-${seat.number}`) ?? []);
    for (const key of deleted) if (!active.has(key)) generated.delete(key);
    for (const key of active) generated.add(key);
    return total + generated.size;
  }, 0);
}
