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

export type VenueDocument = {
  schemaVersion: 2;
  unit: "m";
  widthM: number;
  heightM: number;
  levels: VenueLevel[];
  elements: VenueElement[];
  boundary?: GeoGeometry;
  cadastralSources?: CadastralSource[];
};

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
