export const protocolVersion = 1 as const;

export type Locale = "it" | "en";
export type EventKind = "sport" | "concert" | "festival" | "demonstration" | "gathering" | "parade" | "fair" | "civic" | "temporary" | "other";
export type EventStatus = "draft" | "published" | "live" | "stopped" | "completed";

export type Point2D = { x: number; y: number };
export type GeoPoint = { lat: number; lng: number };
export type GeoPolygon = { type: "Polygon"; coordinates: number[][][] };
export type GeoMultiPolygon = { type: "MultiPolygon"; coordinates: number[][][][] };
export type GeoLineString = { type: "LineString"; coordinates: number[][] };
export type GeoGeometry = GeoPolygon | GeoMultiPolygon | GeoLineString;

export type ParadeRouteStop = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  trigger: "manual" | "schedule" | "arrival";
  offsetMinutes?: number;
  radiusM?: number;
  enabled: boolean;
  cue: {
    durationMs: number;
    zones: string[];
    color?: `#${string}`;
    text?: { it: string; en: string };
    audioAsset?: string;
    vibration?: number[];
    torch?: boolean;
  };
};

export type VenueElementKind =
  | "sector"
  | "stand"
  | "curve"
  | "block"
  | "field"
  | "stage"
  | "runway"
  | "entrance"
  | "exit"
  | "aisle"
  | "barrier"
  | "technical-area"
  | "standing-area"
  | "accessible-area"
  | "free-area";

export type VenuePlanShapeKind = "oval" | "circle" | "rounded-rectangle" | "custom";

export type VenuePlanShape = {
  kind: VenuePlanShapeKind;
  center: Point2D;
  outerWidthM: number;
  outerHeightM: number;
  cornerRadiusM?: number;
  fieldWidthM?: number;
  fieldHeightM?: number;
};

export type VenueRingDefinition = {
  index: number;
  capacity: number;
  sectorCount: number;
  innerOffsetM: number;
  outerOffsetM: number;
};

export type VenueElementGeometry = {
  type: "ring-sector";
  shape: VenuePlanShapeKind;
  center: Point2D;
  innerWidthM: number;
  innerHeightM: number;
  outerWidthM: number;
  outerHeightM: number;
  cornerRadiusM?: number;
  startAngleDeg: number;
  endAngleDeg: number;
};

export type VenueElement = {
  id: string;
  kind: VenueElementKind;
  label: string;
  polygon: Point2D[];
  levelId?: string;
  parentId?: string;
  rotation?: number;
  locked?: boolean;
  hidden?: boolean;
  scope?: "shared" | "level";
  geometry?: VenueElementGeometry;
  dimensionsM?: { width?: number; height?: number; radius?: number };
  rows?: number;
  seatsPerRow?: number;
  rowStyle?: "straight" | "curved";
  seatOverrides?: Array<{ id: string; row: string; number: string; x: number; y: number; accessible?: boolean; deleted?: boolean }>;
};

export type VenueLevel = {
  id: string;
  name: string;
  order: number;
  elevationM?: number;
  hidden?: boolean;
  locked?: boolean;
  role?: "ground" | "ring";
  ring?: VenueRingDefinition;
};

export type CadastralSource = {
  source: string;
  municipalityCode?: string;
  municipalityName?: string;
  province?: string;
  sheet?: string;
  parcel?: string;
  inspireId?: string;
  officialGeometry?: GeoGeometry;
  capturedAt: string;
};

type VenueDocumentBase = {
  unit: "m";
  widthM: number;
  heightM: number;
  levels: VenueLevel[];
  elements: VenueElement[];
  boundary?: GeoGeometry;
  cadastralSources?: CadastralSource[];
};

export type VenueDocumentV2 = VenueDocumentBase & {
  schemaVersion: 2;
};

export type VenueDocumentV3 = VenueDocumentBase & {
  schemaVersion: 3;
  planShape: VenuePlanShape;
};

export type VenueDocument = VenueDocumentV2 | VenueDocumentV3;

export const venueDocumentSchemaVersion = 3 as const;

function cloneVenueDocument<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function isVenueDocumentV3(document: VenueDocument): document is VenueDocumentV3 {
  return document.schemaVersion === venueDocumentSchemaVersion;
}

function migrateVenueLevel(level: VenueLevel, levelCount: number): VenueLevel {
  const looksLikeRing = /anell|ring/i.test(level.name);
  return {
    ...level,
    role: level.role ?? (looksLikeRing || levelCount > 1 ? "ring" : "ground"),
    ring: level.ring ? { ...level.ring } : undefined,
  };
}

function migrateVenueElement(element: VenueElement): VenueElement {
  return {
    ...element,
    scope: element.scope ?? (element.parentId === "__cadastral_boundary__" ? "shared" : "level"),
    polygon: element.polygon.map((point) => ({ ...point })),
    geometry: element.geometry ? { ...element.geometry, center: { ...element.geometry.center } } : undefined,
    dimensionsM: element.dimensionsM ? { ...element.dimensionsM } : undefined,
    seatOverrides: element.seatOverrides?.map((seat) => ({ ...seat })),
  };
}

/** Upgrades a venue without changing coordinates, seats or source metadata. */
export function migrateVenueDocument(document: VenueDocument): VenueDocumentV3 {
  const source = cloneVenueDocument(document);
  const levels = source.levels.map((level) => migrateVenueLevel(level, source.levels.length));
  const elements = source.elements.map(migrateVenueElement);

  if (source.schemaVersion === venueDocumentSchemaVersion) {
    return { ...source, levels, elements, planShape: { ...source.planShape, center: { ...source.planShape.center } } };
  }

  return {
    ...source,
    schemaVersion: venueDocumentSchemaVersion,
    planShape: {
      kind: "custom",
      center: { x: source.widthM / 2, y: source.heightM / 2 },
      outerWidthM: source.widthM,
      outerHeightM: source.heightM,
    },
    levels,
    elements,
  };
}

export function distributeVenueCapacity(total: number, weights: number[]): number[] {
  if (!Number.isInteger(total) || total < 0) throw new Error("VENUE_CAPACITY_INVALID");
  if (weights.length === 0 || weights.some((weight) => !Number.isFinite(weight) || weight < 0)) throw new Error("VENUE_CAPACITY_WEIGHTS_INVALID");
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  const normalized = weightTotal > 0 ? weights : weights.map(() => 1);
  const normalizedTotal = normalized.reduce((sum, weight) => sum + weight, 0);
  const exact = normalized.map((weight) => total * weight / normalizedTotal);
  const result = exact.map(Math.floor);
  let remainder = total - result.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, fraction: value - Math.floor(value) })).sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let index = 0; index < remainder; index += 1) result[order[index % order.length].index] += 1;
  return result;
}

export type VenueSeatGrid = {
  rows: number;
  seatsPerRow: number;
  excluded: Array<{ row: string; number: string }>;
};

export function venueSeatGridForCapacity(capacity: number, maximumSeatsPerRow = 40): VenueSeatGrid {
  if (!Number.isInteger(capacity) || capacity < 0) throw new Error("VENUE_SEAT_CAPACITY_INVALID");
  if (!Number.isInteger(maximumSeatsPerRow) || maximumSeatsPerRow < 1) throw new Error("VENUE_SEATS_PER_ROW_INVALID");
  if (capacity === 0) return { rows: 0, seatsPerRow: 0, excluded: [] };
  const seatsPerRow = Math.min(maximumSeatsPerRow, capacity);
  const rows = Math.ceil(capacity / seatsPerRow);
  const excluded: VenueSeatGrid["excluded"] = [];
  for (let index = capacity; index < rows * seatsPerRow; index += 1) {
    excluded.push({ row: String(Math.floor(index / seatsPerRow) + 1), number: String(index % seatsPerRow + 1) });
  }
  return { rows, seatsPerRow, excluded };
}

function signedPower(value: number, exponent: number): number {
  return Math.sign(value) * Math.abs(value) ** exponent;
}

function outlinePoint(shape: VenuePlanShapeKind, center: Point2D, widthM: number, heightM: number, angleDeg: number, cornerRadiusM?: number): Point2D {
  const radians = angleDeg * Math.PI / 180;
  const radiusX = Math.max(0, widthM / 2);
  const radiusY = Math.max(0, heightM / 2);
  if (shape === "rounded-rectangle") {
    const minimumRadius = Math.max(1e-6, Math.min(radiusX, radiusY));
    const roundedRatio = Math.min(1, Math.max(0, (cornerRadiusM ?? minimumRadius * .22) / minimumRadius));
    const exponent = 2 / (2 + (1 - roundedRatio) * 6);
    return { x: center.x + radiusX * signedPower(Math.cos(radians), exponent), y: center.y + radiusY * signedPower(Math.sin(radians), exponent) };
  }
  return { x: center.x + radiusX * Math.cos(radians), y: center.y + radiusY * Math.sin(radians) };
}

export function ringSectorPolygon(geometry: VenueElementGeometry, maximumStepDeg = 6): Point2D[] {
  const span = geometry.endAngleDeg - geometry.startAngleDeg;
  if (!(span > 0 && span <= 360)) throw new Error("VENUE_RING_SECTOR_ANGLE_INVALID");
  if (geometry.innerWidthM < 0 || geometry.innerHeightM < 0 || geometry.outerWidthM <= geometry.innerWidthM || geometry.outerHeightM <= geometry.innerHeightM) throw new Error("VENUE_RING_SECTOR_SIZE_INVALID");
  const steps = Math.max(2, Math.ceil(span / Math.max(1, maximumStepDeg)));
  const angles = Array.from({ length: steps + 1 }, (_, index) => geometry.startAngleDeg + span * index / steps);
  const outer = angles.map((angle) => outlinePoint(geometry.shape, geometry.center, geometry.outerWidthM, geometry.outerHeightM, angle, geometry.cornerRadiusM));
  const inner = [...angles].reverse().map((angle) => outlinePoint(geometry.shape, geometry.center, geometry.innerWidthM, geometry.innerHeightM, angle, geometry.cornerRadiusM));
  return [...outer, ...inner];
}

export function venuePolygonArea(polygon: Point2D[]): number {
  if (polygon.length < 3) return 0;
  let twiceArea = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    twiceArea += current.x * next.y - next.x * current.y;
  }
  return Math.abs(twiceArea) / 2;
}

export type VenueCapacityMode = "smart" | "equal" | "manual";

export type StadiumRingInput = {
  name?: string;
  capacity?: number;
  sectorCount?: number;
};

export type StadiumGenerationConfig = {
  shape: Exclude<VenuePlanShapeKind, "custom">;
  outerWidthM: number;
  outerHeightM: number;
  fieldWidthM: number;
  fieldHeightM: number;
  totalCapacity: number;
  ringCount: number;
  capacityMode?: VenueCapacityMode;
  rings?: StadiumRingInput[];
};

function finitePositive(value: number, code: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(code);
  return value;
}

function ellipsePerimeter(widthM: number, heightM: number): number {
  const a = widthM / 2;
  const b = heightM / 2;
  const h = ((a - b) ** 2) / ((a + b) ** 2);
  return Math.PI * (a + b) * (1 + 3 * h / (10 + Math.sqrt(4 - 3 * h)));
}

/** Builds deterministic, independently selectable concentric stadium sectors. */
export function generateStadiumVenueDocument(config: StadiumGenerationConfig): VenueDocumentV3 {
  const outerWidthM = finitePositive(config.outerWidthM, "VENUE_OUTER_WIDTH_INVALID");
  const outerHeightM = finitePositive(config.outerHeightM, "VENUE_OUTER_HEIGHT_INVALID");
  const fieldWidthM = finitePositive(config.fieldWidthM, "VENUE_FIELD_WIDTH_INVALID");
  const fieldHeightM = finitePositive(config.fieldHeightM, "VENUE_FIELD_HEIGHT_INVALID");
  if (!Number.isInteger(config.totalCapacity) || config.totalCapacity < 1) throw new Error("VENUE_TOTAL_CAPACITY_INVALID");
  if (!Number.isInteger(config.ringCount) || config.ringCount < 1 || config.ringCount > 12) throw new Error("VENUE_RING_COUNT_INVALID");
  if (config.totalCapacity < config.ringCount) throw new Error("VENUE_RING_CAPACITY_TOO_SMALL");

  const safetyM = 8;
  const innerWidthM = fieldWidthM + safetyM * 2;
  const innerHeightM = fieldHeightM + safetyM * 2;
  if (outerWidthM <= innerWidthM + config.ringCount * 2 || outerHeightM <= innerHeightM + config.ringCount * 2) throw new Error("VENUE_RING_SPACE_INVALID");

  const ringStepWidthM = (outerWidthM - innerWidthM) / config.ringCount;
  const ringStepHeightM = (outerHeightM - innerHeightM) / config.ringCount;
  const ringWeights = Array.from({ length: config.ringCount }, (_, index) => ellipsePerimeter(innerWidthM + ringStepWidthM * (index + .5), innerHeightM + ringStepHeightM * (index + .5)));
  const mode = config.capacityMode ?? "smart";
  let ringCapacities: number[];
  if (mode === "manual") {
    ringCapacities = Array.from({ length: config.ringCount }, (_, index) => config.rings?.[index]?.capacity ?? 0);
    if (ringCapacities.some((capacity) => !Number.isInteger(capacity) || capacity < 1) || ringCapacities.reduce((sum, capacity) => sum + capacity, 0) !== config.totalCapacity) throw new Error("VENUE_MANUAL_CAPACITY_MISMATCH");
  } else {
    ringCapacities = distributeVenueCapacity(config.totalCapacity, mode === "equal" ? ringWeights.map(() => 1) : ringWeights);
  }

  const marginM = Math.max(8, Math.min(20, Math.min(outerWidthM, outerHeightM) * .08));
  const widthM = outerWidthM + marginM * 2;
  const heightM = outerHeightM + marginM * 2;
  const center = { x: widthM / 2, y: heightM / 2 };
  const levels: VenueLevel[] = [];
  const elements: VenueElement[] = [{
    id: "stadium-field",
    kind: "field",
    label: "Campo",
    scope: "shared",
    polygon: [
      { x: center.x - fieldWidthM / 2, y: center.y - fieldHeightM / 2 },
      { x: center.x + fieldWidthM / 2, y: center.y - fieldHeightM / 2 },
      { x: center.x + fieldWidthM / 2, y: center.y + fieldHeightM / 2 },
      { x: center.x - fieldWidthM / 2, y: center.y + fieldHeightM / 2 },
    ],
    dimensionsM: { width: fieldWidthM, height: fieldHeightM },
  }];

  for (let ringIndex = 0; ringIndex < config.ringCount; ringIndex += 1) {
    const ringCapacity = ringCapacities[ringIndex];
    const suggestedSectors = Math.max(4, Math.min(32, Math.round(ringCapacity / 900)));
    const requestedSectors = config.rings?.[ringIndex]?.sectorCount ?? suggestedSectors;
    const sectorCount = Math.max(1, Math.min(ringCapacity, Math.round(requestedSectors)));
    if (!Number.isFinite(requestedSectors) || requestedSectors < 1 || requestedSectors > 64) throw new Error("VENUE_SECTOR_COUNT_INVALID");
    const levelId = `ring-${ringIndex + 1}`;
    const ringName = config.rings?.[ringIndex]?.name?.trim() || `Anello ${ringIndex + 1}`;
    const innerRingWidthM = innerWidthM + ringStepWidthM * ringIndex;
    const innerRingHeightM = innerHeightM + ringStepHeightM * ringIndex;
    const outerRingWidthM = innerWidthM + ringStepWidthM * (ringIndex + 1);
    const outerRingHeightM = innerHeightM + ringStepHeightM * (ringIndex + 1);
    levels.push({
      id: levelId,
      name: ringName,
      order: ringIndex,
      elevationM: ringIndex * 8,
      role: "ring",
      ring: { index: ringIndex, capacity: ringCapacity, sectorCount, innerOffsetM: ringIndex, outerOffsetM: ringIndex + 1 },
    });
    const sectorCapacities = distributeVenueCapacity(ringCapacity, Array.from({ length: sectorCount }, () => 1));
    for (let sectorIndex = 0; sectorIndex < sectorCount; sectorIndex += 1) {
      const startAngleDeg = -90 + 360 * sectorIndex / sectorCount;
      const endAngleDeg = -90 + 360 * (sectorIndex + 1) / sectorCount;
      const geometry: VenueElementGeometry = {
        type: "ring-sector",
        shape: config.shape,
        center,
        innerWidthM: innerRingWidthM,
        innerHeightM: innerRingHeightM,
        outerWidthM: outerRingWidthM,
        outerHeightM: outerRingHeightM,
        cornerRadiusM: config.shape === "rounded-rectangle" ? Math.min(outerWidthM, outerHeightM) * .16 : undefined,
        startAngleDeg,
        endAngleDeg,
      };
      const sectorCapacity = sectorCapacities[sectorIndex];
      const grid = venueSeatGridForCapacity(sectorCapacity);
      elements.push({
        id: `ring-${ringIndex + 1}-sector-${sectorIndex + 1}`,
        kind: "sector",
        label: `${ringName} · S${sectorIndex + 1}`,
        levelId,
        scope: "level",
        polygon: ringSectorPolygon(geometry),
        geometry,
        rows: grid.rows,
        seatsPerRow: grid.seatsPerRow,
        rowStyle: "curved",
        seatOverrides: grid.excluded.map((seat, index) => ({ id: `excluded-${ringIndex + 1}-${sectorIndex + 1}-${index + 1}`, ...seat, x: center.x, y: center.y, deleted: true })),
      });
    }
  }

  return {
    schemaVersion: venueDocumentSchemaVersion,
    unit: "m",
    widthM,
    heightM,
    planShape: { kind: config.shape, center, outerWidthM, outerHeightM, cornerRadiusM: config.shape === "rounded-rectangle" ? Math.min(outerWidthM, outerHeightM) * .16 : undefined, fieldWidthM, fieldHeightM },
    levels,
    elements,
  };
}

export type AccessMethod = "qr" | "fixed_geofence" | "mobile_radius";
export type EventAccessPolicy = {
  visibility: "public" | "private";
  methods: AccessMethod[];
  discoveryRadiusM: number;
  mobileRadiusM?: number;
  fixedGeometry?: GeoGeometry;
  route?: GeoLineString;
  routeStops?: ParadeRouteStop[];
  geoZones?: Array<{ id: string; label: string; geometry: GeoPolygon | GeoMultiPolygon; dwellSeconds: number }>;
};

export type TimelineCue = {
  id: string;
  atMs: number;
  durationMs: number;
  zones: string[];
  color?: `#${string}`;
  text?: { it: string; en: string };
  audioAsset?: string;
  vibration?: number[];
  torch?: boolean;
};

export type OfflineManifest = {
  protocolVersion: typeof protocolVersion;
  eventId: string;
  version: number;
  startsAt: string;
  serverTime: string;
  zoneId: string;
  seatId?: string;
  audioAllowed: boolean;
  torchAllowed: boolean;
  brand?: { organizationName: string; primary: `#${string}`; logo?: string | null };
  checksum: string;
  cues: TimelineCue[];
  assets: Array<{ url: string; sha256: string; bytes: number; mimeType: string }>;
};

export type LiveCommand = {
  protocolVersion: typeof protocolVersion;
  eventId: string;
  sequence: number;
  commandId: string;
  issuedAt: string;
  executeAt: string;
  type: "start" | "cue" | "stop" | "sync";
  cue?: TimelineCue;
  reason?: string;
};

export type PresenceHeartbeat = {
  sessionId: string;
  eventId: string;
  zoneId: string;
  packageVersion: number;
  clockOffsetMs: number;
  ready: boolean;
};
