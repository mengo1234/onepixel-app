import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import rawBody from "fastify-raw-body";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import WebSocket from "ws";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { get as getBlob, put as putBlob } from "@vercel/blob";
import { migrateVenueDocument, type EventAccessPolicy, type GeoGeometry, type LiveCommand, type OfflineManifest, type TimelineCue, type VenueDocument, type VenueDocumentV2, type VenueDocumentV3, type VenueElement } from "../../../packages/protocol/src/index.js";
import { applyStripeWebhook, confirmEventCheckout, createEventCheckout, eventTiers } from "./billing.js";
import { lookupCadastre } from "./cadastre.js";
import { many, one, type Database } from "./database.js";
import { countVenueSeats, pointInGeometry, venueElementSeatIds, zoneAtLocation } from "./geometry.js";
import { canonicalJson, hashPassword, sha256, signPayload, verifyPassword, verifyPayload, type AccessClaims, type JoinClaims, type ParticipantClaims, type QrClaims } from "./security.js";
import { seedDemo } from "./seed.js";
import { compileMedia } from "./media-compiler.js";

const protocolVersion = 1 as const;

export type AssetStore = {
  put(pathname: string, body: Buffer, contentType: string): Promise<void>;
  get(pathname: string): Promise<{ stream: Readable; contentType: string; size: number } | null>;
};

type AppOptions = {
  database: Database;
  secret: string;
  seed?: boolean;
  storageRoot?: string;
  persistDatabase?: () => Promise<void>;
  assetStore?: AssetStore;
};

type EventRow = {
  id: string;
  organization_id: string;
  venue_id: string;
  title: string;
  kind: string;
  status: string;
  starts_at: string | Date;
  ends_at: string | Date;
  latitude: number;
  longitude: number;
  discovery_radius_m: number;
  audio_allowed: boolean;
  torch_allowed: boolean;
  package_version: number;
  access_policy?: EventAccessPolicy | string;
  participant_limit?: number;
  description?: string;
  program?: unknown;
  location_name?: string;
  cover_url?: string;
  layout_snapshot?: VenueDocument | string;
};

type ParadeRouteStop = NonNullable<EventAccessPolicy["routeStops"]>[number];
type RouteStopRunStatus = "pending" | "scheduled" | "executed" | "cancelled" | "missed";
type RouteStopRunRow = {
  event_id: string;
  stop_id: string;
  status: RouteStopRunStatus;
  scheduled_for?: string | Date;
  command_id?: string;
  triggered_by?: string;
  triggered_at?: string | Date;
  updated_at: string | Date;
};

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8).max(200) });
const organizerRegistrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  organizationName: z.string().trim().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(10).max(200),
});
const participantRegistrationSchema = z.object({ name: z.string().trim().min(2).max(80), email: z.string().email(), password: z.string().min(10).max(200) });
const participantProfileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  avatarUrl: z.string().url().nullable().optional(),
  locale: z.enum(["it", "en"]),
  theme: z.enum(["system", "light", "dark"]),
});
const installationSchema = z.object({
  installationId: z.string().min(8).max(120),
  pushToken: z.string().max(500).nullable().optional(),
  locale: z.enum(["it", "en"]).default("it"),
  notificationsEnabled: z.boolean().default(false),
  locationEnabled: z.boolean().default(false),
});
const organizationSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().regex(/^[a-z0-9-]+$/).min(2).max(60),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(10).max(200),
  expiresAt: z.string().datetime(),
  maxEvents: z.number().int().positive().max(10000),
  maxDevices: z.number().int().positive().max(1_000_000),
  maxCapacity: z.number().int().positive().max(1_000_000),
  brand: z.object({ primary: z.string().regex(/^#[0-9a-fA-F]{6}$/), logo: z.string().url().nullable().optional() }),
});
const venueSchema = z.object({
  name: z.string().min(2).max(120),
  kind: z.enum(["stadium", "arena", "concert", "square", "outdoor", "fairground", "custom"]),
  capacity: z.number().int().min(0).max(1_000_000),
  map: z.record(z.string(), z.unknown()).optional(),
});
const point2dSchema = z.object({ x: z.number(), y: z.number() });
const geoGeometrySchema = z.object({
  type: z.enum(["Polygon", "MultiPolygon", "LineString"]),
  coordinates: z.array(z.unknown()),
});
const geoLineStringSchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(2).max(500),
});
const routeStopSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  trigger: z.enum(["manual", "schedule", "arrival"]),
  offsetMinutes: z.number().int().min(0).max(10_080).optional(),
  radiusM: z.number().int().min(10).max(5000).optional(),
  enabled: z.boolean().default(true),
  cue: z.object({
    durationMs: z.number().int().positive().max(3_600_000),
    zones: z.array(z.string().min(1)).min(1),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    text: z.object({ it: z.string().max(500), en: z.string().max(500) }).optional(),
    audioAsset: z.string().max(2000).optional(),
    vibration: z.array(z.number().int().nonnegative().max(10_000)).max(40).optional(),
    torch: z.boolean().optional(),
  }),
}).superRefine((value, context) => {
  if (value.trigger === "schedule" && value.offsetMinutes === undefined) context.addIssue({ code: "custom", path: ["offsetMinutes"], message: "offsetMinutes is required for scheduled stops" });
  if (value.trigger === "arrival" && value.radiusM === undefined) context.addIssue({ code: "custom", path: ["radiusM"], message: "radiusM is required for arrival stops" });
});
const venueElementSchema = z.object({
  id: z.string().min(1).max(120),
  kind: z.enum(["sector", "stand", "curve", "block", "field", "stage", "runway", "entrance", "exit", "aisle", "barrier", "technical-area", "standing-area", "accessible-area", "free-area"]),
  label: z.string().min(1).max(160),
  polygon: z.array(point2dSchema).min(2).max(2000),
  levelId: z.string().optional(),
  parentId: z.string().optional(),
  rotation: z.number().optional(),
  locked: z.boolean().optional(),
  hidden: z.boolean().optional(),
  scope: z.enum(["shared", "level"]).optional(),
  geometry: z.object({
    type: z.literal("ring-sector"),
    shape: z.enum(["oval", "circle", "rounded-rectangle", "custom"]),
    center: point2dSchema,
    innerWidthM: z.number().nonnegative().max(100_000),
    innerHeightM: z.number().nonnegative().max(100_000),
    outerWidthM: z.number().positive().max(100_000),
    outerHeightM: z.number().positive().max(100_000),
    cornerRadiusM: z.number().nonnegative().max(50_000).optional(),
    startAngleDeg: z.number().min(-3600).max(3600),
    endAngleDeg: z.number().min(-3600).max(3600),
  }).optional(),
  dimensionsM: z.object({ width: z.number().positive().optional(), height: z.number().positive().optional(), radius: z.number().positive().optional() }).optional(),
  rows: z.number().int().min(0).max(2000).optional(),
  seatsPerRow: z.number().int().min(0).max(2000).optional(),
  rowStyle: z.enum(["straight", "curved"]).optional(),
  seatOverrides: z.array(z.object({ id: z.string(), row: z.string(), number: z.string(), x: z.number(), y: z.number(), accessible: z.boolean().optional(), deleted: z.boolean().optional() })).max(250_000).optional(),
});
const venueLevelSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(120),
  order: z.number().int(),
  elevationM: z.number().optional(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
  role: z.enum(["ground", "ring"]).optional(),
  ring: z.object({
    index: z.number().int().nonnegative().max(199),
    capacity: z.number().int().nonnegative().max(2_000_000),
    sectorCount: z.number().int().positive().max(500),
    innerOffsetM: z.number().nonnegative().max(50_000),
    outerOffsetM: z.number().nonnegative().max(50_000),
  }).optional(),
});
const venueDocumentV2Schema = z.object({
  schemaVersion: z.literal(2),
  unit: z.literal("m"),
  widthM: z.number().positive().max(100_000),
  heightM: z.number().positive().max(100_000),
  levels: z.array(venueLevelSchema).min(1).max(200),
  elements: z.array(venueElementSchema).max(20_000),
  boundary: geoGeometrySchema.optional(),
  cadastralSources: z.array(z.record(z.string(), z.unknown())).max(100).optional(),
});
const venueDocumentV3Schema = z.object({
  schemaVersion: z.literal(3),
  unit: z.literal("m"),
  widthM: z.number().positive().max(100_000),
  heightM: z.number().positive().max(100_000),
  planShape: z.object({
    kind: z.enum(["oval", "circle", "rounded-rectangle", "custom"]),
    center: point2dSchema,
    outerWidthM: z.number().positive().max(100_000),
    outerHeightM: z.number().positive().max(100_000),
    cornerRadiusM: z.number().nonnegative().max(50_000).optional(),
    fieldWidthM: z.number().positive().max(100_000).optional(),
    fieldHeightM: z.number().positive().max(100_000).optional(),
  }),
  levels: z.array(venueLevelSchema).min(1).max(200),
  elements: z.array(venueElementSchema).max(20_000),
  boundary: geoGeometrySchema.optional(),
  cadastralSources: z.array(z.record(z.string(), z.unknown())).max(100).optional(),
});
const venueDocumentSchema = z.discriminatedUnion("schemaVersion", [venueDocumentV2Schema, venueDocumentV3Schema]).transform((document) => migrateVenueDocument(document as VenueDocument));
const layoutSchema = z.object({ name: z.string().trim().min(2).max(120), document: venueDocumentSchema, isDefault: z.boolean().default(false) });
const accessPolicySchema = z.object({
  visibility: z.enum(["public", "private"]).default("public"),
  methods: z.array(z.enum(["qr", "fixed_geofence", "mobile_radius"])).min(1),
  discoveryRadiusM: z.number().int().min(100).max(50_000).default(3000),
  mobileRadiusM: z.number().int().min(20).max(20_000).optional(),
  fixedGeometry: geoGeometrySchema.optional(),
  route: geoLineStringSchema.optional(),
  routeStops: z.array(routeStopSchema).max(100).optional(),
  geoZones: z.array(z.object({ id: z.string().min(1).max(80), label: z.string().min(1).max(120), geometry: geoGeometrySchema, dwellSeconds: z.number().int().min(2).max(60).default(8) })).max(200).optional(),
});
const routePlanSchema = z.object({
  route: geoLineStringSchema.nullable(),
  routeStops: z.array(routeStopSchema).max(100).default([]),
}).superRefine((value, context) => {
  if (!value.route && value.routeStops.length > 0) context.addIssue({ code: "custom", path: ["routeStops"], message: "routeStops require a route" });
  const ids = new Set<string>();
  value.routeStops.forEach((stop, index) => {
    if (ids.has(stop.id)) context.addIssue({ code: "custom", path: ["routeStops", index, "id"], message: "route stop ids must be unique" });
    ids.add(stop.id);
  });
});
const routeStopActionSchema = z.object({
  action: z.enum(["schedule", "trigger", "cancel", "reset"]),
  executeAt: z.string().datetime().optional(),
  force: z.boolean().default(false),
}).superRefine((value, context) => {
  if (value.action !== "schedule" && value.executeAt) context.addIssue({ code: "custom", path: ["executeAt"], message: "executeAt is only valid for schedule" });
});
const routeActivateSchema = z.object({ replaceExisting: z.boolean().default(false) });
const eventSchema = z.object({
  venueId: z.string().min(1),
  layoutId: z.string().min(1).optional(),
  paymentId: z.string().min(1),
  title: z.string().min(2).max(160),
  description: z.string().max(4000).default(""),
  program: z.array(z.object({ at: z.string(), title: z.string().min(1).max(160) })).max(100).default([]),
  locationName: z.string().max(200).default(""),
  coverUrl: z.string().url().nullable().optional(),
  kind: z.enum(["sport", "concert", "festival", "demonstration", "gathering", "parade", "fair", "civic", "temporary", "other"]),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  discoveryRadiusM: z.number().int().min(100).max(50_000).default(3000),
  audioAllowed: z.boolean().default(false),
  torchAllowed: z.boolean().default(false),
  accessPolicy: accessPolicySchema,
});
const eventUpdateSchema = z.object({
  title: z.string().min(2).max(160).optional(),
  description: z.string().max(4000).optional(),
  program: z.array(z.object({ at: z.string(), title: z.string().min(1).max(160) })).max(100).optional(),
  locationName: z.string().max(200).optional(),
  coverUrl: z.string().url().nullable().optional(),
  kind: z.enum(["sport", "concert", "festival", "demonstration", "gathering", "parade", "fair", "civic", "temporary", "other"]).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  discoveryRadiusM: z.number().int().min(100).max(50_000).optional(),
  audioAllowed: z.boolean().optional(),
  torchAllowed: z.boolean().optional(),
  accessPolicy: accessPolicySchema.optional(),
}).refine((value) => Object.keys(value).length > 0, "Indica almeno una modifica");
const cueSchema = z.object({
  id: z.string().min(1),
  atMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive().max(3_600_000),
  zones: z.array(z.string().min(1)).min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  text: z.object({ it: z.string(), en: z.string() }).optional(),
  audioAsset: z.string().optional(),
  vibration: z.array(z.number().int().nonnegative().max(10_000)).max(40).optional(),
  torch: z.boolean().optional(),
});
const timelineSchema = z.object({
  cues: z.array(cueSchema).max(10_000),
  assets: z.array(z.object({ url: z.string(), sha256: z.string().length(64), bytes: z.number().int().nonnegative(), mimeType: z.string() })).max(500).default([]),
  publish: z.boolean().default(false),
});
const qrSchema = z.object({ zoneId: z.string().min(1).max(80), seatId: z.string().min(1).max(80).optional(), expiresAt: z.string().datetime().optional() });
const locationJoinSchema = z.object({ installationId: z.string().min(8).max(120), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), participantToken: z.string().optional() });
const leaderLocationSchema = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), accuracyM: z.number().min(0).max(5000).default(0) });
const commandSchema = z.object({
  type: z.enum(["start", "cue", "stop", "sync"]),
  executeAt: z.string().datetime().optional(),
  cue: cueSchema.optional(),
  reason: z.string().max(300).optional(),
}).superRefine((value, context) => {
  if (value.type === "cue" && !value.cue) context.addIssue({ code: "custom", path: ["cue"], message: "cue is required" });
});
const heartbeatSchema = z.object({
  type: z.literal("heartbeat"),
  sessionId: z.union([
    z.string().uuid(),
    z.string().regex(/^join_[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  ]),
  zoneId: z.string().min(1),
  packageVersion: z.number().int().positive(),
  clockOffsetMs: z.number().int().min(-60_000).max(60_000),
  ready: z.boolean(),
});

class HttpError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
  }
}

class RealtimeHub {
  private clients = new Map<string, Set<WebSocket>>();

  add(eventId: string, socket: WebSocket): void {
    const eventClients = this.clients.get(eventId) ?? new Set<WebSocket>();
    eventClients.add(socket);
    this.clients.set(eventId, eventClients);
    socket.once("close", () => {
      eventClients.delete(socket);
      if (eventClients.size === 0) this.clients.delete(eventId);
    });
  }

  broadcast(eventId: string, payload: unknown): number {
    const serialized = JSON.stringify(payload);
    let delivered = 0;
    for (const client of this.clients.get(eventId) ?? []) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(serialized);
        delivered += 1;
      }
    }
    return delivered;
  }

  count(eventId: string): number {
    return this.clients.get(eventId)?.size ?? 0;
  }

  closeAll(): void {
    for (const clients of this.clients.values()) for (const client of clients) client.close(1001, "server shutdown");
    this.clients.clear();
  }
}

function jsonValue<T>(value: T | string): T {
  return typeof value === "string" ? JSON.parse(value) as T : value;
}

function iso(value: string | Date): string {
  return new Date(value).toISOString();
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLat = radians(lat2 - lat1);
  const deltaLon = radians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceToRouteMeters(latitude: number, longitude: number, coordinates: number[][]): number {
  const latitudeRadians = latitude * Math.PI / 180;
  const metersPerLongitudeDegree = 111_320 * Math.cos(latitudeRadians);
  const metersPerLatitudeDegree = 110_540;
  let shortest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < coordinates.length; index += 1) {
    const [startLongitude, startLatitude] = coordinates[index - 1];
    const [endLongitude, endLatitude] = coordinates[index];
    const segmentX = (endLongitude - startLongitude) * metersPerLongitudeDegree;
    const segmentY = (endLatitude - startLatitude) * metersPerLatitudeDegree;
    const pointX = (longitude - startLongitude) * metersPerLongitudeDegree;
    const pointY = (latitude - startLatitude) * metersPerLatitudeDegree;
    const lengthSquared = segmentX ** 2 + segmentY ** 2;
    const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (pointX * segmentX + pointY * segmentY) / lengthSquared));
    shortest = Math.min(shortest, Math.hypot(pointX - ratio * segmentX, pointY - ratio * segmentY));
  }
  return shortest;
}

function generateVenueMap(kind: "stadium" | "arena" | "concert" | "square" | "outdoor" | "fairground" | "custom", capacity: number): { width: number; height: number; elements: VenueElement[] } {
  const sectorCount = Math.max(4, Math.min(32, Math.ceil(capacity / 2600)));
  const rows = Math.max(4, Math.ceil(sectorCount / 4));
  const elements: VenueElement[] = Array.from({ length: sectorCount }, (_, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const seats = Math.ceil(capacity / sectorCount);
    return {
      id: `S${String(index + 1).padStart(2, "0")}`,
      kind: "sector",
      label: `Settore ${String(index + 1).padStart(2, "0")}`,
      polygon: [
        { x: 4 + column * 24, y: 4 + row * (90 / rows) },
        { x: 24 + column * 24, y: 4 + row * (90 / rows) },
        { x: 24 + column * 24, y: 4 + (row + 0.8) * (90 / rows) },
        { x: 4 + column * 24, y: 4 + (row + 0.8) * (90 / rows) },
      ],
      rows: Math.max(1, Math.ceil(seats / 80)),
      seatsPerRow: Math.min(80, seats),
    };
  });
  const showStage = kind === "concert" || kind === "square" || kind === "outdoor" || kind === "fairground";
  elements.push({ id: showStage ? "stage" : "field", kind: showStage ? "stage" : "field", label: showStage ? "Palco" : "Campo", polygon: [{ x: 32, y: 37 }, { x: 68, y: 37 }, { x: 68, y: 63 }, { x: 32, y: 63 }] });
  elements.push({ id: "entrance-a", kind: "entrance", label: "Ingresso A", polygon: [{ x: 47, y: 94 }, { x: 53, y: 94 }, { x: 53, y: 99 }, { x: 47, y: 99 }] });
  return { width: 100, height: 100, elements };
}

function venueDocumentFromLegacy(map: { width?: number; height?: number; elements?: VenueElement[] }, capacity: number): VenueDocumentV3 {
  const widthM = 180;
  const heightM = 140;
  const elements = (map.elements ?? []).map((element) => ({
    ...element,
    levelId: element.levelId ?? "level-ground",
    polygon: element.polygon.map((point) => ({ x: point.x * widthM / (map.width ?? 100), y: point.y * heightM / (map.height ?? 100) })),
  }));
  if (elements.length === 0 && capacity === 0) {
    elements.push({ id: "stage", kind: "stage", label: "Palco", levelId: "level-ground", polygon: [{ x: 65, y: 48 }, { x: 115, y: 48 }, { x: 115, y: 92 }, { x: 65, y: 92 }] });
  }
  const legacy: VenueDocumentV2 = { schemaVersion: 2, unit: "m", widthM, heightM, levels: [{ id: "level-ground", name: "Piano terra", order: 0, elevationM: 0 }], elements };
  return migrateVenueDocument(legacy);
}

function slugify(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "organizzazione";
}

export async function createApp(options: AppOptions): Promise<FastifyInstance> {
  const { database, secret } = options;
  const storageRoot = resolve(options.storageRoot ?? process.env.ONEPIXEL_STORAGE ?? ".data/storage");
  const usesBlobAssets = Boolean(options.assetStore || process.env.VERCEL);
  const workingStorageRoot = usesBlobAssets ? resolve(tmpdir(), "onepixel-assets") : storageRoot;
  if (secret.length < 32) throw new Error("ONEPIXEL_QR_SECRET must contain at least 32 characters");
  if (options.seed) await seedDemo(database);

  const app = Fastify({ logger: process.env.NODE_ENV !== "test", bodyLimit: 12 * 1024 * 1024 });
  const hub = new RealtimeHub();
  const scheduledCommands = new Map<string, { eventId: string; timer: ReturnType<typeof setTimeout> }>();

  const assetPathname = (eventId: string, filename: string) => `onepixel/assets/${eventId}/${filename}`;
  async function persistAsset(eventId: string, filename: string, body: Buffer, contentType: string): Promise<void> {
    if (!usesBlobAssets) return;
    const pathname = assetPathname(eventId, filename);
    try {
      if (options.assetStore) await options.assetStore.put(pathname, body, contentType);
      else await putBlob(pathname, body, { access: "private", addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 31_536_000, contentType, multipart: body.byteLength > 4 * 1024 * 1024 });
    } catch (error) {
      app.log.error({ err: error, pathname }, "asset blob write failed");
      throw new HttpError(503, "ASSET_STORAGE_UNAVAILABLE", "Archivio media temporaneamente non disponibile");
    }
  }

  async function retrieveAsset(eventId: string, filename: string): Promise<{ stream: Readable; contentType: string; size: number } | null> {
    if (!usesBlobAssets) return null;
    const pathname = assetPathname(eventId, filename);
    try {
      if (options.assetStore) return options.assetStore.get(pathname);
      const result = await getBlob(pathname, { access: "private" });
      if (!result || result.statusCode !== 200) return null;
      return { stream: Readable.fromWeb(result.stream as never), contentType: result.blob.contentType, size: result.blob.size };
    } catch (error) {
      app.log.error({ err: error, pathname }, "asset blob read failed");
      throw new HttpError(503, "ASSET_STORAGE_UNAVAILABLE", "Archivio media temporaneamente non disponibile");
    }
  }

  function cancelScheduledCommands(eventId: string) {
    for (const [commandId, scheduled] of scheduledCommands) {
      if (scheduled.eventId !== eventId) continue;
      clearTimeout(scheduled.timer);
      scheduledCommands.delete(commandId);
    }
  }

  function cancelScheduledCommand(commandId: string): void {
    const scheduled = scheduledCommands.get(commandId);
    if (!scheduled) return;
    clearTimeout(scheduled.timer);
    scheduledCommands.delete(commandId);
  }

  function dispatchCommand(command: LiveCommand, allowScheduling: boolean, routeStopId?: string): { delivered: number; scheduled: boolean } {
    const delay = new Date(command.executeAt).getTime() - Date.now();
    if (!allowScheduling || delay <= 75) return { delivered: hub.broadcast(command.eventId, { type: "command", command }), scheduled: false };
    const timer = setTimeout(() => {
      scheduledCommands.delete(command.commandId);
      hub.broadcast(command.eventId, { type: "command", command });
      if (routeStopId) void (async () => {
        await database.query("UPDATE parade_route_stop_runs SET status = 'executed', triggered_at = now(), updated_at = now() WHERE event_id = $1 AND stop_id = $2 AND command_id = $3 AND status = 'scheduled'", [command.eventId, routeStopId, command.commandId]);
        hub.broadcast(command.eventId, { type: "route_stop", eventId: command.eventId, stopId: routeStopId, status: "executed", commandId: command.commandId, triggeredAt: new Date().toISOString() });
        await options.persistDatabase?.();
      })().catch((error) => app.log.error(error));
    }, delay);
    scheduledCommands.set(command.commandId, { eventId: command.eventId, timer });
    return { delivered: 0, scheduled: true };
  }

  const expiredRouteStops = await many<{ event_id: string; stop_id: string; command_id?: string }>(database, "SELECT event_id, stop_id, command_id FROM parade_route_stop_runs WHERE status = 'scheduled' AND scheduled_for <= now()");
  for (const expired of expiredRouteStops) {
    await database.query("UPDATE parade_route_stop_runs SET status = 'missed', updated_at = now() WHERE event_id = $1 AND stop_id = $2 AND status = 'scheduled'", [expired.event_id, expired.stop_id]);
    if (expired.command_id) await database.query("UPDATE live_commands SET payload = payload || '{\"cancelled\":true}'::jsonb WHERE id = $1", [expired.command_id]);
  }
  if (expiredRouteStops.length > 0) await options.persistDatabase?.();

  const pendingCommands = await many<{
    id: string;
    event_id: string;
    sequence: number;
    type: LiveCommand["type"];
    payload: { cue?: TimelineCue; reason?: string; cancelled?: boolean; routeStopId?: string } | string;
    issued_at: string | Date;
    execute_at: string | Date;
  }>(database, "SELECT id, event_id, sequence, type, payload, issued_at, execute_at FROM live_commands WHERE execute_at > now() AND COALESCE(payload->>'scheduled', 'false') = 'true' ORDER BY execute_at ASC");
  for (const pending of pendingCommands) {
    const payload = jsonValue(pending.payload);
    if (payload.cancelled) continue;
    dispatchCommand({ protocolVersion, eventId: pending.event_id, sequence: pending.sequence, commandId: pending.id, issuedAt: iso(pending.issued_at), executeAt: iso(pending.execute_at), type: pending.type, cue: payload.cue, reason: payload.reason }, true, payload.routeStopId);
  }
  const configuredOrigins = process.env.ONEPIXEL_ALLOWED_ORIGINS?.split(",").map((value) => value.trim()).filter(Boolean);
  await app.register(cors, { origin: configuredOrigins?.length ? configuredOrigins : true, credentials: false });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: 600, timeWindow: "1 minute" });
  await app.register(websocket);
  await app.register(rawBody, { field: "rawBody", global: false, encoding: "utf8", runFirst: true });
  await app.register(multipart, { limits: { files: 1, fileSize: 60 * 1024 * 1024, fields: 4 } });

  app.addHook("onSend", async (request, reply, payload) => {
    if (options.persistDatabase && reply.statusCode < 400 && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      await options.persistDatabase();
    }
    return payload;
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError) return reply.code(400).send({ error: "VALIDATION_ERROR", issues: error.issues });
    if (error instanceof HttpError) return reply.code(error.statusCode).send({ error: error.code, message: error.message });
    if (error instanceof Error && "statusCode" in error) {
      const transportError = error as Error & { statusCode: number; code?: string };
      if (transportError.statusCode >= 400 && transportError.statusCode < 500) {
        return reply.code(transportError.statusCode).send({ error: transportError.code ?? "REQUEST_REJECTED", message: transportError.message });
      }
    }
    app.log.error(error);
    return reply.code(500).send({ error: "INTERNAL_ERROR" });
  });

  app.addHook("preClose", async () => {
    for (const scheduled of scheduledCommands.values()) clearTimeout(scheduled.timer);
    scheduledCommands.clear();
    hub.closeAll();
  });

  function access(request: FastifyRequest): AccessClaims {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) throw new HttpError(401, "AUTH_REQUIRED", "Accesso richiesto");
    try {
      const claims = verifyPayload<AccessClaims>(authorization.slice(7), secret);
      if (claims.purpose !== "access") throw new Error("TOKEN_INVALID");
      return claims;
    } catch {
      throw new HttpError(401, "AUTH_INVALID", "Token non valido o scaduto");
    }
  }

  function requireSuperAdmin(request: FastifyRequest): AccessClaims {
    const claims = access(request);
    if (claims.role !== "super_admin") throw new HttpError(403, "FORBIDDEN", "Solo il super amministratore può eseguire questa operazione");
    return claims;
  }

  async function ownedEvent(request: FastifyRequest, eventId: string): Promise<{ claims: AccessClaims; event: EventRow }> {
    const claims = access(request);
    const event = await one<EventRow>(database, "SELECT * FROM events WHERE id = $1", [eventId]);
    if (!event) throw new HttpError(404, "EVENT_NOT_FOUND", "Evento non trovato");
    if (claims.role !== "super_admin" && claims.organizationId !== event.organization_id) throw new HttpError(403, "FORBIDDEN", "Evento fuori dalla propria organizzazione");
    return { claims, event };
  }

  async function ownedVenue(request: FastifyRequest, venueId: string): Promise<{ claims: AccessClaims; venue: { id: string; organization_id: string; capacity: number; map: { elements?: VenueElement[] } | string } }> {
    const claims = access(request);
    const venue = await one<{ id: string; organization_id: string; capacity: number; map: { elements?: VenueElement[] } | string }>(database, "SELECT id, organization_id, capacity, map FROM venues WHERE id = $1", [venueId]);
    if (!venue || (claims.role !== "super_admin" && claims.organizationId !== venue.organization_id)) throw new HttpError(404, "VENUE_NOT_FOUND", "Struttura non trovata");
    return { claims, venue };
  }

  async function ensureDefaultLayout(venue: { id: string; organization_id: string; capacity: number; map: { elements?: VenueElement[] } | string }): Promise<{ id: string; document: VenueDocument | string; capacity: number }> {
    const existing = await one<{ id: string; document: VenueDocument | string; capacity: number }>(database, "SELECT id, document, capacity FROM venue_layouts WHERE venue_id = $1 AND archived_at IS NULL ORDER BY is_default DESC, updated_at DESC LIMIT 1", [venue.id]);
    if (existing) return existing;
    const document = venueDocumentFromLegacy(jsonValue(venue.map), venue.capacity);
    const id = `layout_${randomUUID()}`;
    await database.query("INSERT INTO venue_layouts (id, venue_id, organization_id, name, is_default, capacity, document) VALUES ($1, $2, $3, 'Configurazione principale', true, $4, $5)", [id, venue.id, venue.organization_id, venue.capacity, JSON.stringify(document)]);
    return { id, document, capacity: venue.capacity };
  }

  async function participantFromToken(token: string | undefined): Promise<ParticipantClaims | undefined> {
    if (!token) return undefined;
    try {
      const claims = verifyPayload<ParticipantClaims>(token, secret);
      return claims.purpose === "participant_access" ? claims : undefined;
    } catch {
      return undefined;
    }
  }

  async function participantAccess(request: FastifyRequest): Promise<ParticipantClaims> {
    const authorization = request.headers.authorization;
    const claims = await participantFromToken(authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined);
    if (!claims) throw new HttpError(401, "PARTICIPANT_AUTH_REQUIRED", "Accedi al profilo partecipante");
    return claims;
  }

  async function registerJoin(event: EventRow, installationId: string, method: JoinClaims["method"], zoneId: string, seatId?: string, participantUserId?: string): Promise<{ joinId: string; token: string; method: JoinClaims["method"]; zoneId: string; seatId?: string }> {
    const existing = await one<{ id: string; method: JoinClaims["method"]; zone_id: string; seat_id?: string }>(database, "SELECT id, method, zone_id, seat_id FROM event_joins WHERE event_id = $1 AND installation_id = $2", [event.id, installationId]);
    let joinId: string;
    if (!existing) {
      const totals = await one<{ count: number }>(database, "SELECT count(*)::int AS count FROM event_joins WHERE event_id = $1", [event.id]);
      if ((totals?.count ?? 0) >= (event.participant_limit ?? 1_000_000)) throw new HttpError(409, "EVENT_CAPACITY_REACHED", "Limite partecipanti raggiunto");
      joinId = `join_${randomUUID()}`;
      await database.query("INSERT INTO event_joins (id, event_id, installation_id, participant_user_id, method, zone_id, seat_id) VALUES ($1, $2, $3, $4, $5, $6, $7)", [joinId, event.id, installationId, participantUserId ?? null, method, zoneId, seatId ?? null]);
    } else if (method === "qr") {
      joinId = existing.id;
      // A QR is the authoritative assignment: it replaces a previous coarse GPS
      // zone and keeps the exact sector/seat locked for subsequent updates.
      await database.query("UPDATE event_joins SET method = 'qr', zone_id = $2, seat_id = $3, participant_user_id = COALESCE($4, participant_user_id), candidate_zone_id = NULL, candidate_since = NULL, last_seen_at = now() WHERE id = $1", [joinId, zoneId, seatId ?? null, participantUserId ?? null]);
    } else if (existing.method === "qr") {
      joinId = existing.id;
      // Once an exact QR assignment exists, a later GPS refresh cannot demote it.
      method = "qr";
      zoneId = existing.zone_id;
      seatId = existing.seat_id;
      await database.query("UPDATE event_joins SET participant_user_id = COALESCE($2, participant_user_id), last_seen_at = now() WHERE id = $1", [joinId, participantUserId ?? null]);
    } else {
      joinId = existing.id;
      method = existing.method;
      zoneId = existing.zone_id;
      seatId = existing.seat_id;
      await database.query("UPDATE event_joins SET participant_user_id = COALESCE($2, participant_user_id), last_seen_at = now() WHERE id = $1", [joinId, participantUserId ?? null]);
    }
    if (participantUserId) await database.query("INSERT INTO participant_event_state (participant_user_id, event_id, joined_at) VALUES ($1, $2, now()) ON CONFLICT (participant_user_id, event_id) DO UPDATE SET joined_at = COALESCE(participant_event_state.joined_at, now())", [participantUserId, event.id]);
    const claims: JoinClaims = { purpose: "event_join", joinId, installationId, eventId: event.id, zoneId, seatId, method, exp: Math.floor(new Date(event.ends_at).getTime() / 1000) + 4 * 60 * 60 };
    return { joinId, token: signPayload(claims, secret), method, zoneId, seatId };
  }

  async function audit(claims: AccessClaims, action: string, targetType: string, targetId: string, metadata: unknown = {}): Promise<void> {
    await database.query("INSERT INTO audit_logs (id, organization_id, actor_id, action, target_type, target_id, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)", [randomUUID(), claims.organizationId ?? null, claims.sub, action, targetType, targetId, JSON.stringify(metadata)]);
  }

  function routeRunState(row?: RouteStopRunRow) {
    return {
      status: row?.status ?? "pending",
      scheduledFor: row?.scheduled_for ? iso(row.scheduled_for) : null,
      commandId: row?.command_id ?? null,
      triggeredBy: row?.triggered_by ?? null,
      triggeredAt: row?.triggered_at ? iso(row.triggered_at) : null,
      updatedAt: row?.updated_at ? iso(row.updated_at) : null,
    };
  }

  async function routePlanFor(event: EventRow) {
    const policy = jsonValue<EventAccessPolicy>(event.access_policy ?? { visibility: "public", methods: ["qr"], discoveryRadiusM: event.discovery_radius_m });
    const runs = await many<RouteStopRunRow>(database, "SELECT event_id, stop_id, status, scheduled_for, command_id, triggered_by, triggered_at, updated_at FROM parade_route_stop_runs WHERE event_id = $1", [event.id]);
    const runByStop = new Map(runs.map((run) => [run.stop_id, run]));
    const routeStops = (policy.routeStops ?? []).map((stop) => ({ ...stop, operation: routeRunState(runByStop.get(stop.id)) }));
    const summary = routeStops.reduce<Record<RouteStopRunStatus, number>>((totals, stop) => {
      totals[stop.operation.status] += 1;
      return totals;
    }, { pending: 0, scheduled: 0, executed: 0, cancelled: 0, missed: 0 });
    const leader = await one<{ latitude: number; longitude: number; accuracy_m: number; updated_at: string | Date }>(database, "SELECT latitude, longitude, accuracy_m, updated_at FROM event_leader_location WHERE event_id = $1", [event.id]);
    return {
      eventId: event.id,
      route: policy.route ?? null,
      routeStops,
      summary,
      leaderLocation: leader ? { latitude: leader.latitude, longitude: leader.longitude, accuracyM: leader.accuracy_m, updatedAt: iso(leader.updated_at) } : null,
    };
  }

  async function issueRouteStop(event: EventRow, claims: AccessClaims, stop: ParadeRouteStop, executeAt?: string, force = false) {
    const existing = await one<RouteStopRunRow>(database, "SELECT event_id, stop_id, status, scheduled_for, command_id, triggered_by, triggered_at, updated_at FROM parade_route_stop_runs WHERE event_id = $1 AND stop_id = $2", [event.id, stop.id]);
    if (!force && (existing?.status === "scheduled" || existing?.status === "executed")) {
      return { stopId: stop.id, operation: routeRunState(existing), reused: true };
    }
    if (existing?.command_id) {
      cancelScheduledCommand(existing.command_id);
      await database.query("UPDATE live_commands SET payload = payload || '{\"cancelled\":true}'::jsonb WHERE id = $1 AND execute_at > now()", [existing.command_id]);
    }
    const executionTime = executeAt ? new Date(executeAt) : new Date(Date.now() + 350);
    if (executionTime > new Date(event.ends_at)) throw new HttpError(400, "ROUTE_STOP_AFTER_EVENT", "La tappa non può essere programmata dopo la fine dell'evento");
    const scheduled = Boolean(executeAt) && executionTime.getTime() - Date.now() > 75;
    if (executeAt && !scheduled) throw new HttpError(409, "ROUTE_STOP_TIME_PASSED", "Scegli un orario futuro per programmare la tappa");
    const previous = await one<{ sequence: number }>(database, "SELECT sequence FROM live_commands WHERE event_id = $1 ORDER BY sequence DESC LIMIT 1", [event.id]);
    const command: LiveCommand = {
      protocolVersion,
      eventId: event.id,
      sequence: (previous?.sequence ?? 0) + 1,
      commandId: randomUUID(),
      issuedAt: new Date().toISOString(),
      executeAt: executionTime.toISOString(),
      type: "cue",
      cue: { id: `route:${stop.id}`, atMs: 0, ...stop.cue },
      reason: `Tappa percorso: ${stop.label}`,
    };
    const status: RouteStopRunStatus = scheduled ? "scheduled" : "executed";
    await database.transaction(async (transaction) => {
      await transaction.query("INSERT INTO live_commands (id, event_id, sequence, type, payload, issued_at, execute_at) VALUES ($1, $2, $3, 'cue', $4, $5, $6)", [command.commandId, event.id, command.sequence, JSON.stringify({ cue: command.cue, reason: command.reason, scheduled, cancelled: false, routeStopId: stop.id }), command.issuedAt, command.executeAt]);
      await transaction.query("INSERT INTO parade_route_stop_runs (event_id, stop_id, status, scheduled_for, command_id, triggered_by, triggered_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $3 = 'executed' THEN now() ELSE NULL END, now()) ON CONFLICT (event_id, stop_id) DO UPDATE SET status = EXCLUDED.status, scheduled_for = EXCLUDED.scheduled_for, command_id = EXCLUDED.command_id, triggered_by = EXCLUDED.triggered_by, triggered_at = EXCLUDED.triggered_at, updated_at = now()", [event.id, stop.id, status, scheduled ? command.executeAt : null, command.commandId, claims.sub]);
    });
    const delivery = dispatchCommand(command, scheduled, stop.id);
    const operation = routeRunState(await one<RouteStopRunRow>(database, "SELECT event_id, stop_id, status, scheduled_for, command_id, triggered_by, triggered_at, updated_at FROM parade_route_stop_runs WHERE event_id = $1 AND stop_id = $2", [event.id, stop.id]));
    hub.broadcast(event.id, { type: "route_stop", eventId: event.id, stopId: stop.id, label: stop.label, trigger: stop.trigger, latitude: stop.latitude, longitude: stop.longitude, cue: command.cue, ...operation });
    await audit(claims, scheduled ? "event.route.stop.scheduled" : "event.route.stop.triggered", "event", event.id, { stopId: stop.id, commandId: command.commandId, executeAt: command.executeAt, force, ...delivery });
    return { stopId: stop.id, operation, command, ...delivery, reused: false };
  }

  async function manifestFor(event: EventRow, zoneId: string, seatId?: string): Promise<OfflineManifest> {
    const choreography = await one<{ version: number; cues: TimelineCue[] | string; assets: OfflineManifest["assets"] | string }>(database, "SELECT version, cues, assets FROM choreography_versions WHERE event_id = $1 AND published_at IS NOT NULL ORDER BY version DESC LIMIT 1", [event.id]);
    if (!choreography) throw new HttpError(409, "PACKAGE_NOT_PUBLISHED", "La coreografia non è ancora pubblicata");
    const allCues = jsonValue<TimelineCue[]>(choreography.cues);
    const cues = allCues.filter((cue) => cue.zones.includes("*") || cue.zones.includes(zoneId));
    const assets = jsonValue<OfflineManifest["assets"]>(choreography.assets);
    const organization = await one<{ name: string; brand: { primary?: string; logo?: string | null } | string }>(database, "SELECT name, brand FROM organizations WHERE id = $1", [event.organization_id]);
    const organizationBrand = organization ? jsonValue<{ primary?: string; logo?: string | null }>(organization.brand) : {};
    const brand = {
      organizationName: organization?.name ?? "onePixel",
      primary: (organizationBrand.primary ?? "#D1E66A") as `#${string}`,
      logo: organizationBrand.logo ?? null,
    };
    const payload = { protocolVersion, eventId: event.id, version: choreography.version, startsAt: iso(event.starts_at), zoneId, seatId, audioAllowed: event.audio_allowed, torchAllowed: event.torch_allowed, brand, cues, assets };
    return { ...payload, serverTime: new Date().toISOString(), checksum: sha256(canonicalJson(payload)) };
  }

  async function eventQrElements(event: EventRow): Promise<VenueElement[]> {
    const document = event.layout_snapshot ? jsonValue<VenueDocument>(event.layout_snapshot) : undefined;
    let elements = document?.elements ?? [];
    if (elements.length === 0) {
      const venue = await one<{ map: { elements?: VenueElement[] } | string }>(database, "SELECT map FROM venues WHERE id = $1", [event.venue_id]);
      elements = venue ? jsonValue<{ elements?: VenueElement[] }>(venue.map).elements ?? [] : [];
    }
    return elements.filter((element) => ["sector", "stand", "curve", "block", "standing-area", "accessible-area"].includes(element.kind));
  }

  async function issueQr(event: EventRow, zoneId: string, seatId?: string, expiresAtInput?: string) {
    const qrId = randomUUID();
    const expiresAt = expiresAtInput ? new Date(expiresAtInput) : new Date(new Date(event.ends_at).getTime() + 4 * 60 * 60_000);
    const payload: QrClaims = { purpose: "qr", qrId, eventId: event.id, zoneId, seatId, exp: Math.floor(expiresAt.getTime() / 1000) };
    const token = signPayload(payload, secret);
    await database.query("INSERT INTO qr_codes (id, event_id, zone_id, seat_id, token_hash, expires_at) VALUES ($1, $2, $3, $4, $5, $6)", [qrId, event.id, zoneId, seatId ?? null, sha256(token), expiresAt.toISOString()]);
    return { qrId, token, deepLink: `onepixel://join?token=${encodeURIComponent(token)}`, eventId: event.id, zoneId, seatId: seatId ?? null, expiresAt: expiresAt.toISOString() };
  }

  async function findNearbyEvents(latitude: number, longitude: number, radiusM: number) {
    const events = await many<EventRow & { venue_name: string; organization_name: string; organization_brand: unknown; leader_latitude?: number; leader_longitude?: number }>(database, "SELECT e.*, v.name AS venue_name, o.name AS organization_name, o.brand AS organization_brand, l.latitude AS leader_latitude, l.longitude AS leader_longitude FROM events e JOIN venues v ON v.id = e.venue_id JOIN organizations o ON o.id = e.organization_id LEFT JOIN event_leader_location l ON l.event_id = e.id WHERE e.status IN ('published', 'live') AND e.ends_at > now() AND e.starts_at < now() + interval '24 hours'");
    return events.map((event) => {
      const policy = jsonValue<EventAccessPolicy>(event.access_policy ?? { visibility: "public", methods: ["qr"], discoveryRadiusM: event.discovery_radius_m });
      const eventLatitude = policy.methods.includes("mobile_radius") && event.leader_latitude != null ? event.leader_latitude : event.latitude;
      const eventLongitude = policy.methods.includes("mobile_radius") && event.leader_longitude != null ? event.leader_longitude : event.longitude;
      return { ...event, access_policy: policy, starts_at: iso(event.starts_at), ends_at: iso(event.ends_at), distanceM: Math.round(haversineMeters(latitude, longitude, eventLatitude, eventLongitude)) };
    }).filter((event) => event.access_policy.visibility === "public" && event.distanceM <= Math.min(radiusM, event.access_policy.discoveryRadiusM ?? event.discovery_radius_m)).sort((left, right) => left.distanceM - right.distanceM);
  }

  app.get("/health", async () => {
    const databaseStatus = await one<{ value: number }>(database, "SELECT 1::int AS value");
    return { status: databaseStatus?.value === 1 ? "ok" : "degraded", protocolVersion, serverTime: new Date().toISOString() };
  });

  app.post("/v1/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request) => {
    const body = loginSchema.parse(request.body);
    const user = await one<{ id: string; organization_id?: string; email: string; password_hash: string; role: AccessClaims["role"]; enabled: boolean }>(database, "SELECT * FROM users WHERE lower(email) = lower($1)", [body.email]);
    if (!user || !user.enabled || !(await verifyPassword(body.password, user.password_hash))) throw new HttpError(401, "CREDENTIALS_INVALID", "Credenziali non valide");
    await database.query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
    const exp = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
    const claims: AccessClaims = { purpose: "access", sub: user.id, role: user.role, organizationId: user.organization_id, exp };
    return { token: signPayload(claims, secret), expiresAt: new Date(exp * 1000).toISOString(), user: { id: user.id, email: user.email, role: user.role, organizationId: user.organization_id ?? null } };
  });

  app.post("/v1/auth/register", { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = organizerRegistrationSchema.parse(request.body);
    const duplicate = await one<{ id: string }>(database, "SELECT id FROM users WHERE lower(email) = lower($1)", [body.email]);
    if (duplicate) throw new HttpError(409, "EMAIL_ALREADY_USED", "Email già registrata");
    const organizationId = `org_${randomUUID()}`;
    const userId = randomUUID();
    const baseSlug = slugify(body.organizationName);
    const existingSlug = await one<{ id: string }>(database, "SELECT id FROM organizations WHERE slug = $1", [baseSlug]);
    const slug = existingSlug ? `${baseSlug}-${randomUUID().slice(0, 6)}` : baseSlug;
    const passwordHash = await hashPassword(body.password);
    const expiry = new Date(Date.now() + 100 * 365 * 24 * 60 * 60_000).toISOString();
    await database.transaction(async (transaction) => {
      await transaction.query("INSERT INTO organizations (id, slug, name, status, brand) VALUES ($1, $2, $3, 'active', $4)", [organizationId, slug, body.organizationName, JSON.stringify({ primary: "#D1E66A", logo: null })]);
      await transaction.query("INSERT INTO licenses (organization_id, starts_at, expires_at, max_events, max_devices, max_capacity, notes) VALUES ($1, now(), $2, 10000, 1000000, 1000000, 'Pagamento per singolo evento')", [organizationId, expiry]);
      await transaction.query("INSERT INTO users (id, organization_id, email, password_hash, role, name) VALUES ($1, $2, $3, $4, 'organization_admin', $5)", [userId, organizationId, body.email, passwordHash, body.name]);
    });
    const exp = Math.floor(Date.now() / 1000) + 8 * 60 * 60;
    const claims: AccessClaims = { purpose: "access", sub: userId, role: "organization_admin", organizationId, exp };
    return reply.code(201).send({ token: signPayload(claims, secret), expiresAt: new Date(exp * 1000).toISOString(), user: { id: userId, email: body.email, name: body.name, role: "organization_admin", organizationId }, organization: { id: organizationId, name: body.organizationName, slug } });
  });

  app.get("/v1/auth/me", async (request) => {
    const claims = access(request);
    const user = await one<{ id: string; organization_id?: string; email: string; name: string; avatar_url?: string; role: AccessClaims["role"] }>(database, "SELECT id, organization_id, email, name, avatar_url, role FROM users WHERE id = $1 AND enabled = true", [claims.sub]);
    if (!user) throw new HttpError(401, "AUTH_INVALID", "Utente non disponibile");
    const organization = user.organization_id ? await one<{ id: string; name: string; brand: unknown }>(database, "SELECT id, name, brand FROM organizations WHERE id = $1", [user.organization_id]) : undefined;
    return { user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatar_url ?? null, role: user.role, organizationId: user.organization_id ?? null }, organization: organization ?? null };
  });

  app.patch("/v1/auth/organization", async (request) => {
    const claims = access(request);
    if (!claims.organizationId) throw new HttpError(400, "ORGANIZATION_REQUIRED", "Organizzazione richiesta");
    const body = z.object({ name: z.string().trim().min(2).max(120), brand: z.object({ primary: z.string().regex(/^#[0-9a-fA-F]{6}$/), logo: z.string().url().nullable().optional() }) }).parse(request.body);
    await database.query("UPDATE organizations SET name = $2, brand = $3 WHERE id = $1", [claims.organizationId, body.name, JSON.stringify(body.brand)]);
    await audit(claims, "organization.brand.updated", "organization", claims.organizationId, body.brand);
    return { id: claims.organizationId, name: body.name, brand: body.brand, saved: true };
  });

  app.get("/v1/billing/tiers", async () => Object.entries(eventTiers).map(([id, tier]) => ({ id, participantLimit: tier.participantLimit, amountCents: tier.amountCents, currency: "eur", label: tier.label })));

  app.post("/v1/billing/checkout", async (request, reply) => {
    const claims = access(request);
    if (!claims.organizationId) throw new HttpError(400, "ORGANIZATION_REQUIRED", "Organizzazione richiesta");
    const body = z.object({ tier: z.enum(["small", "medium", "large"]), successUrl: z.string().url(), cancelUrl: z.string().url() }).parse(request.body);
    try {
      const checkout = await createEventCheckout({ database, organizationId: claims.organizationId, ...body });
      await audit(claims, "payment.checkout.created", "payment", checkout.paymentId, { tier: body.tier, mock: checkout.mock });
      return reply.code(201).send(checkout);
    } catch (error) {
      if (error instanceof Error && error.message === "STRIPE_NOT_CONFIGURED") throw new HttpError(503, "PAYMENTS_NOT_CONFIGURED", "Configura Stripe per accettare pagamenti");
      throw error;
    }
  });

  app.get("/v1/billing/payments", async (request) => {
    const claims = access(request);
    if (!claims.organizationId) return [];
    return many(database, "SELECT id, tier, participant_limit, amount_cents, currency, provider, provider_session_id, status, consumed_event_id, created_at, paid_at, consumed_at FROM event_payments WHERE organization_id = $1 ORDER BY created_at DESC", [claims.organizationId]);
  });

  app.post("/v1/billing/confirm", async (request) => {
    const claims = access(request);
    if (!claims.organizationId) throw new HttpError(400, "ORGANIZATION_REQUIRED", "Organizzazione richiesta");
    const body = z.object({ paymentId: z.string().min(1), sessionId: z.string().min(1) }).parse(request.body);
    try {
      const result = await confirmEventCheckout({ database, organizationId: claims.organizationId, paymentId: body.paymentId, providerSessionId: body.sessionId });
      if (result.status === "not_found") throw new HttpError(404, "PAYMENT_NOT_FOUND", "Pagamento non trovato");
      if (result.confirmed) await audit(claims, "payment.checkout.confirmed", "payment", body.paymentId, { sessionId: body.sessionId, status: result.status });
      return { paymentId: body.paymentId, ...result };
    } catch (error) {
      if (error instanceof Error && error.message === "STRIPE_NOT_CONFIGURED") throw new HttpError(503, "PAYMENTS_NOT_CONFIGURED", "Configura Stripe per verificare il pagamento");
      throw error;
    }
  });

  app.post("/v1/billing/webhook", { config: { rawBody: true } }, async (request) => {
    const signature = request.headers["stripe-signature"];
    const raw = (request as FastifyRequest & { rawBody?: string }).rawBody;
    if (typeof signature !== "string" || !raw) throw new HttpError(400, "STRIPE_SIGNATURE_MISSING", "Firma Stripe mancante");
    try {
      const eventId = await applyStripeWebhook(database, raw, signature);
      return { received: true, eventId };
    } catch {
      throw new HttpError(400, "STRIPE_SIGNATURE_INVALID", "Webhook Stripe non valido");
    }
  });

  app.post("/v1/participant/auth/register", { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = participantRegistrationSchema.parse(request.body);
    const existing = await one<{ id: string }>(database, "SELECT id FROM participant_users WHERE lower(email) = lower($1)", [body.email]);
    if (existing) throw new HttpError(409, "EMAIL_ALREADY_USED", "Email già registrata");
    const id = `participant_${randomUUID()}`;
    await database.query("INSERT INTO participant_users (id, email, password_hash, provider, name) VALUES ($1, $2, $3, 'password', $4)", [id, body.email, await hashPassword(body.password), body.name]);
    const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const claims: ParticipantClaims = { purpose: "participant_access", sub: id, email: body.email, exp };
    return reply.code(201).send({ token: signPayload(claims, secret), user: { id, email: body.email, name: body.name, avatarUrl: null } });
  });

  app.post("/v1/participant/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request) => {
    const body = loginSchema.parse(request.body);
    const user = await one<{ id: string; email: string; password_hash?: string; name: string; avatar_url?: string }>(database, "SELECT id, email, password_hash, name, avatar_url FROM participant_users WHERE lower(email) = lower($1) AND provider = 'password'", [body.email]);
    if (!user?.password_hash || !(await verifyPassword(body.password, user.password_hash))) throw new HttpError(401, "CREDENTIALS_INVALID", "Credenziali non valide");
    const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const claims: ParticipantClaims = { purpose: "participant_access", sub: user.id, email: user.email, exp };
    return { token: signPayload(claims, secret), user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatar_url ?? null } };
  });

  app.post("/v1/participant/auth/google", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { idToken } = z.object({ idToken: z.string().min(100) }).parse(request.body);
    const audience = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!audience) throw new HttpError(503, "GOOGLE_AUTH_NOT_CONFIGURED", "Configura il client OAuth Google di onePixel");
    let google;
    try {
      const ticket = await new OAuth2Client(audience).verifyIdToken({ idToken, audience });
      google = ticket.getPayload();
    } catch {
      throw new HttpError(401, "GOOGLE_TOKEN_INVALID", "Accesso Google non valido");
    }
    if (!google?.sub || !google.email || google.email_verified !== true) throw new HttpError(401, "GOOGLE_EMAIL_UNVERIFIED", "L'account Google deve avere un'email verificata");
    let user = await one<{ id: string; email: string; name: string; avatar_url?: string }>(database, "SELECT id, email, name, avatar_url FROM participant_users WHERE provider_subject = $1 OR lower(email) = lower($2)", [google.sub, google.email]);
    if (!user) {
      const id = `participant_${randomUUID()}`;
      await database.query("INSERT INTO participant_users (id, email, provider, provider_subject, name, avatar_url) VALUES ($1, $2, 'google', $3, $4, $5)", [id, google.email, google.sub, google.name ?? google.email.split("@")[0], google.picture ?? null]);
      user = { id, email: google.email, name: google.name ?? google.email.split("@")[0], avatar_url: google.picture };
    } else {
      await database.query("UPDATE participant_users SET provider_subject = COALESCE(provider_subject, $2), name = CASE WHEN name = '' THEN $3 ELSE name END, avatar_url = COALESCE(avatar_url, $4), updated_at = now() WHERE id = $1", [user.id, google.sub, google.name ?? user.name, google.picture ?? null]);
    }
    const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    const claims: ParticipantClaims = { purpose: "participant_access", sub: user.id, email: user.email, exp };
    return reply.send({ token: signPayload(claims, secret), user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatar_url ?? google.picture ?? null } });
  });

  app.get("/v1/participant/me", async (request) => {
    const claims = await participantAccess(request);
    const user = await one<{ id: string; email: string; name: string; avatar_url?: string; locale: string; theme: string; provider: string }>(database, "SELECT id, email, name, avatar_url, locale, theme, provider FROM participant_users WHERE id = $1", [claims.sub]);
    if (!user) throw new HttpError(404, "PARTICIPANT_NOT_FOUND", "Profilo non trovato");
    return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatar_url ?? null, locale: user.locale, theme: user.theme, provider: user.provider };
  });

  app.patch("/v1/participant/me", async (request) => {
    const claims = await participantAccess(request);
    const body = participantProfileSchema.parse(request.body);
    const result = await database.query<{ id: string; email: string; name: string; avatar_url?: string; locale: string; theme: string }>("UPDATE participant_users SET name = $2, avatar_url = $3, locale = $4, theme = $5, updated_at = now() WHERE id = $1 RETURNING id, email, name, avatar_url, locale, theme", [claims.sub, body.name, body.avatarUrl ?? null, body.locale, body.theme]);
    const user = result.rows[0];
    return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatar_url ?? null, locale: user.locale, theme: user.theme };
  });

  app.get("/v1/participant/events", async (request) => {
    const claims = await participantAccess(request);
    return many(database, "SELECT e.id, e.title, e.kind, e.status, e.starts_at, e.ends_at, e.location_name, e.cover_url, v.name AS venue_name, s.saved, s.ticket_token, s.joined_at FROM participant_event_state s JOIN events e ON e.id = s.event_id JOIN venues v ON v.id = e.venue_id WHERE s.participant_user_id = $1 ORDER BY COALESCE(s.joined_at, e.starts_at) DESC", [claims.sub]);
  });

  app.put("/v1/participant/events/:eventId/state", async (request) => {
    const claims = await participantAccess(request);
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const { saved } = z.object({ saved: z.boolean() }).parse(request.body);
    const event = await one<{ id: string }>(database, "SELECT id FROM events WHERE id = $1", [eventId]);
    if (!event) throw new HttpError(404, "EVENT_NOT_FOUND", "Evento non trovato");
    await database.query("INSERT INTO participant_event_state (participant_user_id, event_id, saved) VALUES ($1, $2, $3) ON CONFLICT (participant_user_id, event_id) DO UPDATE SET saved = EXCLUDED.saved", [claims.sub, eventId, saved]);
    return { eventId, saved };
  });

  app.put("/v1/public/installations", async (request) => {
    const body = installationSchema.parse(request.body);
    const authorization = request.headers.authorization;
    const participant = await participantFromToken(authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined);
    await database.query("INSERT INTO app_installations (id, participant_user_id, push_token, locale, notifications_enabled, location_enabled, last_seen_at) VALUES ($1, $2, $3, $4, $5, $6, now()) ON CONFLICT (id) DO UPDATE SET participant_user_id = COALESCE(EXCLUDED.participant_user_id, app_installations.participant_user_id), push_token = EXCLUDED.push_token, locale = EXCLUDED.locale, notifications_enabled = EXCLUDED.notifications_enabled, location_enabled = EXCLUDED.location_enabled, last_seen_at = now()", [body.installationId, participant?.sub ?? null, body.pushToken ?? null, body.locale, body.notificationsEnabled, body.locationEnabled]);
    return { id: body.installationId, registered: true };
  });

  app.get("/v1/public/installations/:installationId/notifications", async (request) => {
    const { installationId } = z.object({ installationId: z.string().min(8).max(120) }).parse(request.params);
    return many(database, "SELECT id, event_id, kind, title_it, title_en, body_it, body_en, read_at, created_at FROM app_notifications WHERE installation_id = $1 ORDER BY created_at DESC LIMIT 100", [installationId]);
  });

  app.patch("/v1/public/installations/:installationId/notifications/:notificationId", async (request) => {
    const { installationId, notificationId } = z.object({ installationId: z.string().min(8).max(120), notificationId: z.string() }).parse(request.params);
    const result = await database.query("UPDATE app_notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND installation_id = $2 RETURNING id, read_at", [notificationId, installationId]);
    if (result.rows.length === 0) throw new HttpError(404, "NOTIFICATION_NOT_FOUND", "Notifica non trovata");
    return result.rows[0];
  });

  app.get("/v1/admin/organizations", async (request) => {
    requireSuperAdmin(request);
    return many(database, "SELECT o.id, o.slug, o.name, o.status, o.brand, o.created_at, l.expires_at, l.max_events, l.max_devices, l.max_capacity FROM organizations o JOIN licenses l ON l.organization_id = o.id ORDER BY o.created_at DESC");
  });

  app.post("/v1/admin/organizations", async (request, reply) => {
    const claims = requireSuperAdmin(request);
    const body = organizationSchema.parse(request.body);
    const organizationId = `org_${randomUUID()}`;
    const passwordHash = await hashPassword(body.adminPassword);
    await database.transaction(async (transaction) => {
      await transaction.query("INSERT INTO organizations (id, slug, name, status, brand) VALUES ($1, $2, $3, 'active', $4)", [organizationId, body.slug, body.name, JSON.stringify(body.brand)]);
      await transaction.query("INSERT INTO licenses (organization_id, starts_at, expires_at, max_events, max_devices, max_capacity) VALUES ($1, now(), $2, $3, $4, $5)", [organizationId, body.expiresAt, body.maxEvents, body.maxDevices, body.maxCapacity]);
      await transaction.query("INSERT INTO users (id, organization_id, email, password_hash, role) VALUES ($1, $2, $3, $4, 'organization_admin')", [randomUUID(), organizationId, body.adminEmail, passwordHash]);
    });
    await audit(claims, "organization.created", "organization", organizationId, { slug: body.slug });
    return reply.code(201).send({ id: organizationId, status: "active" });
  });

  app.patch("/v1/admin/organizations/:organizationId/status", async (request) => {
    const claims = requireSuperAdmin(request);
    const { organizationId } = z.object({ organizationId: z.string() }).parse(request.params);
    const { status } = z.object({ status: z.enum(["active", "suspended"]) }).parse(request.body);
    const result = await database.query("UPDATE organizations SET status = $2 WHERE id = $1 RETURNING id", [organizationId, status]);
    if (result.rows.length === 0) throw new HttpError(404, "ORGANIZATION_NOT_FOUND", "Organizzazione non trovata");
    await audit(claims, `organization.${status}`, "organization", organizationId);
    return { id: organizationId, status };
  });

  app.get("/v1/admin/users", async (request) => {
    requireSuperAdmin(request);
    return many(database, "SELECT u.id, u.email, u.name, u.role, u.enabled, u.last_login_at, u.created_at, o.name AS organization_name FROM users u LEFT JOIN organizations o ON o.id = u.organization_id ORDER BY u.created_at DESC");
  });

  app.patch("/v1/admin/users/:userId", async (request) => {
    const claims = requireSuperAdmin(request);
    const { userId } = z.object({ userId: z.string().min(1) }).parse(request.params);
    const body = z.object({ enabled: z.boolean() }).parse(request.body);
    if (userId === claims.sub && !body.enabled) throw new HttpError(409, "CANNOT_DISABLE_SELF", "Non puoi disabilitare il tuo account mentre lo stai usando");
    const result = await database.query<{ id: string; enabled: boolean }>("UPDATE users SET enabled = $2 WHERE id = $1 RETURNING id, enabled", [userId, body.enabled]);
    if (result.rows.length === 0) throw new HttpError(404, "USER_NOT_FOUND", "Utente non trovato");
    await audit(claims, body.enabled ? "user.enabled" : "user.disabled", "user", userId);
    return result.rows[0];
  });

  app.get("/v1/admin/payments", async (request) => {
    requireSuperAdmin(request);
    return many(database, "SELECT p.*, o.name AS organization_name, e.title AS event_title FROM event_payments p JOIN organizations o ON o.id = p.organization_id LEFT JOIN events e ON e.id = p.consumed_event_id ORDER BY p.created_at DESC");
  });

  app.get("/v1/admin/events", async (request) => {
    requireSuperAdmin(request);
    return many(database, "SELECT e.id, e.title, e.kind, e.status, e.starts_at, e.ends_at, e.participant_limit, o.name AS organization_name, v.name AS venue_name, count(j.id)::int AS joined FROM events e JOIN organizations o ON o.id = e.organization_id JOIN venues v ON v.id = e.venue_id LEFT JOIN event_joins j ON j.event_id = e.id GROUP BY e.id, o.name, v.name ORDER BY e.starts_at DESC");
  });

  app.patch("/v1/admin/events/:eventId/status", async (request) => {
    const claims = requireSuperAdmin(request);
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const { status } = z.object({ status: z.enum(["draft", "published", "live", "stopped"]) }).parse(request.body);
    const result = await database.query("UPDATE events SET status = $2, updated_at = now() WHERE id = $1 RETURNING id", [eventId, status]);
    if (result.rows.length === 0) throw new HttpError(404, "EVENT_NOT_FOUND", "Evento non trovato");
    await audit(claims, `event.${status}`, "event", eventId);
    return { id: eventId, status };
  });

  app.get("/v1/venues", async (request) => {
    const claims = access(request);
    if (claims.role === "super_admin") return many(database, "SELECT * FROM venues ORDER BY created_at DESC");
    return many(database, "SELECT * FROM venues WHERE organization_id = $1 ORDER BY created_at DESC", [claims.organizationId]);
  });

  app.post("/v1/venues", async (request, reply) => {
    const claims = access(request);
    if (!claims.organizationId) throw new HttpError(400, "ORGANIZATION_REQUIRED", "Seleziona un'organizzazione");
    const body = venueSchema.parse(request.body);
    const license = await one<{ max_capacity: number; expires_at: string | Date }>(database, "SELECT max_capacity, expires_at FROM licenses WHERE organization_id = $1", [claims.organizationId]);
    if (!license || new Date(license.expires_at) <= new Date()) throw new HttpError(402, "LICENSE_EXPIRED", "Licenza scaduta");
    if (body.capacity > license.max_capacity) throw new HttpError(409, "LICENSE_CAPACITY_EXCEEDED", `Capienza massima ${license.max_capacity}`);
    const id = `venue_${randomUUID()}`;
    const map = body.map ?? generateVenueMap(body.kind, body.capacity);
    const layoutId = `layout_${randomUUID()}`;
    const document = venueDocumentFromLegacy(map as { width?: number; height?: number; elements?: VenueElement[] }, body.capacity);
    await database.transaction(async (transaction) => {
      await transaction.query("INSERT INTO venues (id, organization_id, name, kind, capacity, map) VALUES ($1, $2, $3, $4, $5, $6)", [id, claims.organizationId, body.name, body.kind, body.capacity, JSON.stringify(map)]);
      await transaction.query("INSERT INTO venue_layouts (id, venue_id, organization_id, name, is_default, capacity, document) VALUES ($1, $2, $3, 'Configurazione principale', true, $4, $5)", [layoutId, id, claims.organizationId, body.capacity, JSON.stringify(document)]);
    });
    await audit(claims, "venue.created", "venue", id, { capacity: body.capacity });
    return reply.code(201).send({ id, name: body.name, kind: body.kind, capacity: body.capacity, map, layoutId, document });
  });

  app.put("/v1/venues/:venueId/map", async (request) => {
    const claims = access(request);
    const { venueId } = z.object({ venueId: z.string() }).parse(request.params);
    const { map } = z.object({ map: z.record(z.string(), z.unknown()) }).parse(request.body);
    const result = await database.query("UPDATE venues SET map = $2, updated_at = now() WHERE id = $1 AND ($3::text IS NULL OR organization_id = $3) RETURNING id", [venueId, JSON.stringify(map), claims.role === "super_admin" ? null : claims.organizationId]);
    if (result.rows.length === 0) throw new HttpError(404, "VENUE_NOT_FOUND", "Struttura non trovata");
    await audit(claims, "venue.map.updated", "venue", venueId);
    return { id: venueId, saved: true };
  });

  app.put("/v1/venues/:venueId", async (request) => {
    const claims = access(request);
    const { venueId } = z.object({ venueId: z.string() }).parse(request.params);
    const body = venueSchema.parse(request.body);
    const current = await one<{ organization_id: string }>(database, "SELECT organization_id FROM venues WHERE id = $1", [venueId]);
    if (!current || (claims.role !== "super_admin" && current.organization_id !== claims.organizationId)) throw new HttpError(404, "VENUE_NOT_FOUND", "Struttura non trovata");
    const license = await one<{ max_capacity: number; expires_at: string | Date }>(database, "SELECT max_capacity, expires_at FROM licenses WHERE organization_id = $1", [current.organization_id]);
    if (!license || new Date(license.expires_at) <= new Date()) throw new HttpError(402, "LICENSE_EXPIRED", "Licenza scaduta");
    if (body.capacity > license.max_capacity) throw new HttpError(409, "LICENSE_CAPACITY_EXCEEDED", `Capienza massima ${license.max_capacity}`);
    const map = body.map ?? generateVenueMap(body.kind, body.capacity);
    await database.query("UPDATE venues SET name = $2, kind = $3, capacity = $4, map = $5, updated_at = now() WHERE id = $1", [venueId, body.name, body.kind, body.capacity, JSON.stringify(map)]);
    await audit(claims, "venue.updated", "venue", venueId, { capacity: body.capacity });
    return { id: venueId, name: body.name, kind: body.kind, capacity: body.capacity, map, saved: true };
  });

  app.patch("/v1/venues/:venueId/details", async (request) => {
    const { venueId } = z.object({ venueId: z.string() }).parse(request.params);
    const { claims } = await ownedVenue(request, venueId);
    const body = z.object({ name: z.string().min(2).max(120), kind: z.enum(["stadium", "arena", "concert", "square", "outdoor", "fairground", "custom"]) }).parse(request.body);
    await database.query("UPDATE venues SET name = $2, kind = $3, updated_at = now() WHERE id = $1", [venueId, body.name, body.kind]);
    await audit(claims, "venue.details.updated", "venue", venueId, body);
    return { id: venueId, ...body, saved: true };
  });

  app.get("/v1/venues/:venueId/layouts", async (request) => {
    const { venueId } = z.object({ venueId: z.string() }).parse(request.params);
    const { venue } = await ownedVenue(request, venueId);
    const query = z.object({ includeArchived: z.enum(["true", "false"]).optional() }).parse(request.query);
    const includeArchived = query.includeArchived === "true";
    await ensureDefaultLayout(venue);
    return many(database, `SELECT id, venue_id, name, version, is_default, capacity, document, archived_at, created_at, updated_at
      FROM venue_layouts
      WHERE venue_id = $1 AND ($2::boolean = true OR archived_at IS NULL)
      ORDER BY (archived_at IS NULL) DESC, is_default DESC, updated_at DESC`, [venueId, includeArchived]);
  });

  app.post("/v1/venues/:venueId/layouts", async (request, reply) => {
    const { venueId } = z.object({ venueId: z.string() }).parse(request.params);
    const { claims, venue } = await ownedVenue(request, venueId);
    const body = layoutSchema.parse(request.body);
    const id = `layout_${randomUUID()}`;
    const capacity = countVenueSeats(body.document as VenueDocument);
    await database.transaction(async (transaction) => {
      if (body.isDefault) await transaction.query("UPDATE venue_layouts SET is_default = false WHERE venue_id = $1", [venueId]);
      await transaction.query("INSERT INTO venue_layouts (id, venue_id, organization_id, name, is_default, capacity, document) VALUES ($1, $2, $3, $4, $5, $6, $7)", [id, venueId, venue.organization_id, body.name, body.isDefault, capacity, JSON.stringify(body.document)]);
      await transaction.query("UPDATE venues SET capacity = GREATEST(capacity, $2), updated_at = now() WHERE id = $1", [venueId, capacity]);
    });
    await audit(claims, "venue.layout.created", "venue", venueId, { layoutId: id, capacity });
    return reply.code(201).send({ id, venueId, name: body.name, isDefault: body.isDefault, capacity, document: body.document });
  });

  app.put("/v1/venues/:venueId/layouts/:layoutId", async (request) => {
    const { venueId, layoutId } = z.object({ venueId: z.string(), layoutId: z.string() }).parse(request.params);
    const { claims } = await ownedVenue(request, venueId);
    const body = layoutSchema.parse(request.body);
    const capacity = countVenueSeats(body.document as VenueDocument);
    const result = await database.transaction(async (transaction) => {
      if (body.isDefault) await transaction.query("UPDATE venue_layouts SET is_default = false WHERE venue_id = $1", [venueId]);
      return transaction.query("UPDATE venue_layouts SET name = $3, is_default = $4, capacity = $5, document = $6, version = version + 1, updated_at = now() WHERE id = $1 AND venue_id = $2 AND archived_at IS NULL RETURNING id, version", [layoutId, venueId, body.name, body.isDefault, capacity, JSON.stringify(body.document)]);
    });
    if (result.rows.length === 0) throw new HttpError(404, "LAYOUT_NOT_FOUND", "Configurazione non trovata");
    await audit(claims, "venue.layout.updated", "venue", venueId, { layoutId, capacity });
    return { id: layoutId, venueId, capacity, document: body.document, version: (result.rows[0] as { version: number }).version, saved: true };
  });

  app.patch("/v1/venues/:venueId/layouts/:layoutId/default", async (request) => {
    const { venueId, layoutId } = z.object({ venueId: z.string(), layoutId: z.string() }).parse(request.params);
    const { claims } = await ownedVenue(request, venueId);
    const layout = await one<{ id: string }>(database, "SELECT id FROM venue_layouts WHERE id = $1 AND venue_id = $2 AND archived_at IS NULL", [layoutId, venueId]);
    if (!layout) throw new HttpError(404, "LAYOUT_NOT_FOUND", "Configurazione attiva non trovata");
    await database.transaction(async (transaction) => {
      await transaction.query("UPDATE venue_layouts SET is_default = false WHERE venue_id = $1", [venueId]);
      await transaction.query("UPDATE venue_layouts SET is_default = true, updated_at = now() WHERE id = $1 AND venue_id = $2", [layoutId, venueId]);
    });
    await audit(claims, "venue.layout.defaulted", "venue", venueId, { layoutId });
    return { id: layoutId, venueId, isDefault: true };
  });

  app.patch("/v1/venues/:venueId/layouts/:layoutId/archive", async (request) => {
    const { venueId, layoutId } = z.object({ venueId: z.string(), layoutId: z.string() }).parse(request.params);
    const { claims } = await ownedVenue(request, venueId);
    const { archived } = z.object({ archived: z.boolean() }).parse(request.body);
    const layout = await one<{ id: string; is_default: boolean; archived_at?: string | Date }>(database, "SELECT id, is_default, archived_at FROM venue_layouts WHERE id = $1 AND venue_id = $2", [layoutId, venueId]);
    if (!layout) throw new HttpError(404, "LAYOUT_NOT_FOUND", "Configurazione non trovata");
    if (archived) {
      if (layout.archived_at) return { id: layoutId, venueId, archived: true };
      if (layout.is_default) throw new HttpError(409, "LAYOUT_DEFAULT_CANNOT_ARCHIVE", "Imposta prima un'altra configurazione come predefinita");
      const active = await one<{ count: number }>(database, "SELECT count(*)::int AS count FROM venue_layouts WHERE venue_id = $1 AND archived_at IS NULL", [venueId]);
      if ((active?.count ?? 0) <= 1) throw new HttpError(409, "LAYOUT_LAST_ACTIVE", "Deve rimanere almeno una configurazione attiva");
    }
    await database.query("UPDATE venue_layouts SET archived_at = CASE WHEN $3 THEN now() ELSE NULL END, is_default = CASE WHEN $3 THEN false ELSE is_default END, updated_at = now() WHERE id = $1 AND venue_id = $2", [layoutId, venueId, archived]);
    await audit(claims, archived ? "venue.layout.archived" : "venue.layout.restored", "venue", venueId, { layoutId });
    return { id: layoutId, venueId, archived };
  });

  app.post("/v1/geo/cadastre", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request) => {
    access(request);
    const { latitude, longitude } = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).parse(request.body);
    try {
      return await lookupCadastre(latitude, longitude);
    } catch (error) {
      const code = error instanceof Error ? error.message : "CATASTRE_UNAVAILABLE";
      if (code === "CATASTRE_ROAD") throw new HttpError(404, "CATASTRE_ROAD", "Il punto è su una strada: spostalo dentro una particella");
      if (code === "CATASTRE_NOT_FOUND") throw new HttpError(404, "CATASTRE_NOT_FOUND", "Nessuna particella trovata");
      throw new HttpError(502, "CATASTRE_UNAVAILABLE", "Servizio catastale temporaneamente non disponibile");
    }
  });

  app.get("/v1/events", async (request) => {
    const claims = access(request);
    if (claims.role === "super_admin") return many(database, "SELECT e.*, v.name AS venue_name, v.capacity AS venue_capacity, p.tier AS payment_tier, p.status AS payment_status FROM events e JOIN venues v ON v.id = e.venue_id LEFT JOIN event_payments p ON p.id = e.payment_id ORDER BY e.starts_at DESC");
    return many(database, "SELECT e.*, v.name AS venue_name, v.capacity AS venue_capacity, p.tier AS payment_tier, p.status AS payment_status FROM events e JOIN venues v ON v.id = e.venue_id LEFT JOIN event_payments p ON p.id = e.payment_id WHERE e.organization_id = $1 ORDER BY e.starts_at DESC", [claims.organizationId]);
  });

  app.get("/v1/events/:eventId", async (request) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const { event } = await ownedEvent(request, eventId);
    const venue = await one<{ venue_name: string }>(database, "SELECT name AS venue_name FROM venues WHERE id = $1", [event.venue_id]);
    return { ...event, venue_name: venue?.venue_name ?? "" };
  });

  app.patch("/v1/events/:eventId", async (request) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const { claims, event } = await ownedEvent(request, eventId);
    const body = eventUpdateSchema.parse(request.body);
    if (["live", "stopped", "completed"].includes(event.status)) throw new HttpError(409, "EVENT_NOT_EDITABLE", "Un evento live o concluso non può essere modificato");
    if (event.status === "published") {
      const disallowed = Object.keys(body).filter((key) => !["title", "description", "program", "coverUrl"].includes(key));
      if (disallowed.length > 0) throw new HttpError(409, "PUBLISHED_EVENT_LOCKED", "Dopo la pubblicazione puoi modificare soltanto titolo, descrizione, programma e copertina");
    }
    const startsAt = body.startsAt ?? iso(event.starts_at);
    const endsAt = body.endsAt ?? iso(event.ends_at);
    if (new Date(endsAt) <= new Date(startsAt)) throw new HttpError(400, "INVALID_INTERVAL", "La fine deve essere successiva all'inizio");
    const next = {
      title: body.title ?? event.title,
      description: body.description ?? event.description,
      program: body.program ?? jsonValue(event.program ?? []),
      locationName: body.locationName ?? event.location_name,
      coverUrl: body.coverUrl === undefined ? event.cover_url : body.coverUrl,
      kind: body.kind ?? event.kind,
      startsAt,
      endsAt,
      latitude: body.latitude ?? Number(event.latitude),
      longitude: body.longitude ?? Number(event.longitude),
      discoveryRadiusM: body.discoveryRadiusM ?? event.discovery_radius_m,
      audioAllowed: body.audioAllowed ?? event.audio_allowed,
      torchAllowed: body.torchAllowed ?? event.torch_allowed,
      accessPolicy: body.accessPolicy ?? jsonValue(event.access_policy),
    };
    await database.query("UPDATE events SET title = $2, description = $3, program = $4, location_name = $5, cover_url = $6, kind = $7, starts_at = $8, ends_at = $9, latitude = $10, longitude = $11, discovery_radius_m = $12, audio_allowed = $13, torch_allowed = $14, access_policy = $15, updated_at = now() WHERE id = $1", [eventId, next.title, next.description, JSON.stringify(next.program), next.locationName, next.coverUrl, next.kind, next.startsAt, next.endsAt, next.latitude, next.longitude, next.discoveryRadiusM, next.audioAllowed, next.torchAllowed, JSON.stringify(next.accessPolicy)]);
    await audit(claims, "event.updated", "event", eventId, { fields: Object.keys(body) });
    return { id: eventId, status: event.status, ...next };
  });

  app.post("/v1/events", async (request, reply) => {
    const claims = access(request);
    if (!claims.organizationId) throw new HttpError(400, "ORGANIZATION_REQUIRED", "Seleziona un'organizzazione");
    const body = eventSchema.parse(request.body);
    if (new Date(body.endsAt) <= new Date(body.startsAt)) throw new HttpError(400, "INVALID_INTERVAL", "La fine deve essere successiva all'inizio");
    const venue = await one<{ id: string; capacity: number; organization_id: string; map: { elements?: VenueElement[] } | string }>(database, "SELECT id, capacity, organization_id, map FROM venues WHERE id = $1", [body.venueId]);
    if (!venue || venue.organization_id !== claims.organizationId) throw new HttpError(404, "VENUE_NOT_FOUND", "Struttura non trovata");
    const layout = body.layoutId
      ? await one<{ id: string; organization_id: string; capacity: number; document: VenueDocument | string }>(database, "SELECT id, organization_id, capacity, document FROM venue_layouts WHERE id = $1 AND venue_id = $2 AND archived_at IS NULL", [body.layoutId, body.venueId])
      : await ensureDefaultLayout(venue);
    if (!layout || ("organization_id" in layout && layout.organization_id !== claims.organizationId)) throw new HttpError(404, "LAYOUT_NOT_FOUND", "Configurazione non trovata");
    const payment = await one<{ id: string; participant_limit: number; status: string }>(database, "SELECT id, participant_limit, status FROM event_payments WHERE id = $1 AND organization_id = $2", [body.paymentId, claims.organizationId]);
    if (!payment || payment.status !== "paid") throw new HttpError(402, "EVENT_PAYMENT_REQUIRED", "Acquista una fascia prima di creare l'evento");
    if (layout.capacity > payment.participant_limit) throw new HttpError(409, "PAYMENT_TIER_TOO_SMALL", `La configurazione contiene ${layout.capacity} posti, oltre il limite acquistato di ${payment.participant_limit}`);
    const id = `event_${randomUUID()}`;
    const layoutDocument = jsonValue<VenueDocument>(layout.document);
    await database.transaction(async (transaction) => {
      await transaction.query("INSERT INTO events (id, organization_id, venue_id, layout_id, payment_id, title, description, program, location_name, cover_url, kind, status, starts_at, ends_at, latitude, longitude, discovery_radius_m, audio_allowed, torch_allowed, access_policy, participant_limit, layout_snapshot) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft', $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)", [id, claims.organizationId, body.venueId, layout.id, body.paymentId, body.title, body.description, JSON.stringify(body.program), body.locationName, body.coverUrl ?? null, body.kind, body.startsAt, body.endsAt, body.latitude, body.longitude, body.discoveryRadiusM, body.audioAllowed, body.torchAllowed, JSON.stringify(body.accessPolicy), payment.participant_limit, JSON.stringify(layoutDocument)]);
      const consumed = await transaction.query("UPDATE event_payments SET status = 'consumed', consumed_event_id = $2, consumed_at = now() WHERE id = $1 AND status = 'paid' RETURNING id", [body.paymentId, id]);
      if (consumed.rows.length === 0) throw new HttpError(409, "PAYMENT_ALREADY_USED", "Questo pagamento è già stato utilizzato");
    });
    await audit(claims, "event.created", "event", id);
    return reply.code(201).send({ id, status: "draft", participantLimit: payment.participant_limit, layoutId: layout.id });
  });

  app.get("/v1/events/:eventId/route", async (request) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const { event } = await ownedEvent(request, eventId);
    if (event.kind !== "parade") throw new HttpError(409, "ROUTE_NOT_AVAILABLE", "Il percorso è disponibile soltanto per un corteo");
    return routePlanFor(event);
  });

  app.put("/v1/events/:eventId/route", async (request) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const { claims, event } = await ownedEvent(request, eventId);
    if (event.kind !== "parade") throw new HttpError(409, "ROUTE_NOT_AVAILABLE", "Il percorso può essere configurato soltanto per un corteo");
    const body = routePlanSchema.parse(request.body);
    if (body.route && body.routeStops.some((stop) => distanceToRouteMeters(stop.latitude, stop.longitude, body.route!.coordinates) > 50)) {
      throw new HttpError(400, "ROUTE_STOP_OUTSIDE_ROUTE", "Ogni tappa deve trovarsi entro 50 metri dal percorso");
    }
    for (const stop of body.routeStops) {
      if (stop.trigger !== "schedule") continue;
      const scheduledFor = new Date(event.starts_at).getTime() + (stop.offsetMinutes ?? 0) * 60_000;
      if (scheduledFor > new Date(event.ends_at).getTime()) throw new HttpError(400, "ROUTE_STOP_AFTER_EVENT", `La tappa ${stop.label} è programmata dopo la fine dell'evento`);
    }
    const currentPolicy = jsonValue<EventAccessPolicy>(event.access_policy ?? { visibility: "public", methods: ["qr"], discoveryRadiusM: event.discovery_radius_m });
    const accessPolicy: EventAccessPolicy = {
      ...currentPolicy,
      route: body.route ?? undefined,
      routeStops: body.routeStops.map((stop) => ({ ...stop, cue: { ...stop.cue, color: stop.cue.color as `#${string}` | undefined } })),
    };
    const existingRuns = await many<RouteStopRunRow>(database, "SELECT event_id, stop_id, status, scheduled_for, command_id, triggered_by, triggered_at, updated_at FROM parade_route_stop_runs WHERE event_id = $1", [eventId]);
    const previousStops = new Map((currentPolicy.routeStops ?? []).map((stop) => [stop.id, stop]));
    const nextIds = new Set(body.routeStops.map((stop) => stop.id));
    await database.transaction(async (transaction) => {
      await transaction.query("UPDATE events SET access_policy = $2, updated_at = now() WHERE id = $1", [eventId, JSON.stringify(accessPolicy)]);
      for (const stop of body.routeStops) {
        const existingRun = existingRuns.find((run) => run.stop_id === stop.id);
        const changed = JSON.stringify(previousStops.get(stop.id)) !== JSON.stringify(stop);
        if (changed && existingRun?.status === "scheduled" && existingRun.command_id) {
          cancelScheduledCommand(existingRun.command_id);
          await transaction.query("UPDATE live_commands SET payload = payload || '{\"cancelled\":true}'::jsonb WHERE id = $1", [existingRun.command_id]);
        }
        await transaction.query("INSERT INTO parade_route_stop_runs (event_id, stop_id, status) VALUES ($1, $2, 'pending') ON CONFLICT (event_id, stop_id) DO UPDATE SET status = CASE WHEN $3::boolean AND parade_route_stop_runs.status <> 'executed' THEN 'pending' ELSE parade_route_stop_runs.status END, scheduled_for = CASE WHEN $3::boolean AND parade_route_stop_runs.status <> 'executed' THEN NULL ELSE parade_route_stop_runs.scheduled_for END, command_id = CASE WHEN $3::boolean AND parade_route_stop_runs.status <> 'executed' THEN NULL ELSE parade_route_stop_runs.command_id END, triggered_by = CASE WHEN $3::boolean AND parade_route_stop_runs.status <> 'executed' THEN NULL ELSE parade_route_stop_runs.triggered_by END, triggered_at = CASE WHEN $3::boolean AND parade_route_stop_runs.status <> 'executed' THEN NULL ELSE parade_route_stop_runs.triggered_at END, updated_at = now()", [eventId, stop.id, changed]);
      }
      for (const run of existingRuns) {
        if (!nextIds.has(run.stop_id)) {
          if (run.status === "scheduled" && run.command_id) {
            cancelScheduledCommand(run.command_id);
            await transaction.query("UPDATE live_commands SET payload = payload || '{\"cancelled\":true}'::jsonb WHERE id = $1", [run.command_id]);
          }
          await transaction.query("DELETE FROM parade_route_stop_runs WHERE event_id = $1 AND stop_id = $2", [eventId, run.stop_id]);
        }
      }
    });
    await audit(claims, "event.route.updated", "event", eventId, { points: body.route?.coordinates.length ?? 0, stops: body.routeStops.length });
    return routePlanFor({ ...event, access_policy: accessPolicy });
  });

  app.post("/v1/events/:eventId/route/activate", async (request) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const { claims, event } = await ownedEvent(request, eventId);
    if (event.kind !== "parade") throw new HttpError(409, "ROUTE_NOT_AVAILABLE", "Il percorso può essere attivato soltanto per un corteo");
    const body = routeActivateSchema.parse(request.body ?? {});
    const policy = jsonValue<EventAccessPolicy>(event.access_policy ?? { visibility: "public", methods: ["qr"], discoveryRadiusM: event.discovery_radius_m });
    const scheduledStops = (policy.routeStops ?? []).filter((stop) => stop.enabled && stop.trigger === "schedule");
    const operations: unknown[] = [];
    for (const stop of scheduledStops) {
      const executeAt = new Date(new Date(event.starts_at).getTime() + (stop.offsetMinutes ?? 0) * 60_000);
      if (executeAt.getTime() <= Date.now() + 75) {
        const current = await one<RouteStopRunRow>(database, "SELECT event_id, stop_id, status, scheduled_for, command_id, triggered_by, triggered_at, updated_at FROM parade_route_stop_runs WHERE event_id = $1 AND stop_id = $2", [eventId, stop.id]);
        if (current?.status !== "executed" && (body.replaceExisting || current?.status !== "scheduled")) {
          await database.query("INSERT INTO parade_route_stop_runs (event_id, stop_id, status, scheduled_for, updated_at) VALUES ($1, $2, 'missed', $3, now()) ON CONFLICT (event_id, stop_id) DO UPDATE SET status = 'missed', scheduled_for = EXCLUDED.scheduled_for, command_id = NULL, triggered_by = NULL, triggered_at = NULL, updated_at = now()", [eventId, stop.id, executeAt.toISOString()]);
        }
        operations.push({ stopId: stop.id, operation: { status: "missed", scheduledFor: executeAt.toISOString() } });
        continue;
      }
      operations.push(await issueRouteStop(event, claims, stop, executeAt.toISOString(), body.replaceExisting));
    }
    await audit(claims, "event.route.activated", "event", eventId, { scheduledStops: scheduledStops.length, replaceExisting: body.replaceExisting });
    return { ...(await routePlanFor(event)), operations };
  });

  app.patch("/v1/events/:eventId/route/stops/:stopId", async (request) => {
    const { eventId, stopId } = z.object({ eventId: z.string(), stopId: z.string() }).parse(request.params);
    const { claims, event } = await ownedEvent(request, eventId);
    if (event.kind !== "parade") throw new HttpError(409, "ROUTE_NOT_AVAILABLE", "Le tappe sono disponibili soltanto per un corteo");
    const body = routeStopActionSchema.parse(request.body);
    const policy = jsonValue<EventAccessPolicy>(event.access_policy ?? { visibility: "public", methods: ["qr"], discoveryRadiusM: event.discovery_radius_m });
    const stop = policy.routeStops?.find((candidate) => candidate.id === stopId);
    if (!stop) throw new HttpError(404, "ROUTE_STOP_NOT_FOUND", "Tappa non trovata");
    if (!stop.enabled && body.action !== "reset") throw new HttpError(409, "ROUTE_STOP_DISABLED", "Abilita la tappa prima di usarla");
    if (body.action === "trigger") return issueRouteStop(event, claims, stop, undefined, body.force);
    if (body.action === "schedule") {
      const executeAt = body.executeAt ?? (stop.trigger === "schedule" ? new Date(new Date(event.starts_at).getTime() + (stop.offsetMinutes ?? 0) * 60_000).toISOString() : undefined);
      if (!executeAt) throw new HttpError(400, "ROUTE_STOP_TIME_REQUIRED", "Indica quando deve partire la tappa");
      return issueRouteStop(event, claims, stop, executeAt, body.force);
    }
    const existing = await one<RouteStopRunRow>(database, "SELECT event_id, stop_id, status, scheduled_for, command_id, triggered_by, triggered_at, updated_at FROM parade_route_stop_runs WHERE event_id = $1 AND stop_id = $2", [eventId, stopId]);
    if (existing?.command_id) {
      cancelScheduledCommand(existing.command_id);
      await database.query("UPDATE live_commands SET payload = payload || '{\"cancelled\":true}'::jsonb WHERE id = $1 AND execute_at > now()", [existing.command_id]);
    }
    const status: RouteStopRunStatus = body.action === "cancel" ? "cancelled" : "pending";
    await database.query("INSERT INTO parade_route_stop_runs (event_id, stop_id, status, updated_at) VALUES ($1, $2, $3, now()) ON CONFLICT (event_id, stop_id) DO UPDATE SET status = EXCLUDED.status, scheduled_for = NULL, command_id = NULL, triggered_by = NULL, triggered_at = NULL, updated_at = now()", [eventId, stopId, status]);
    const operation = routeRunState(await one<RouteStopRunRow>(database, "SELECT event_id, stop_id, status, scheduled_for, command_id, triggered_by, triggered_at, updated_at FROM parade_route_stop_runs WHERE event_id = $1 AND stop_id = $2", [eventId, stopId]));
    hub.broadcast(eventId, { type: "route_stop", eventId, stopId, label: stop.label, ...operation });
    await audit(claims, body.action === "cancel" ? "event.route.stop.cancelled" : "event.route.stop.reset", "event", eventId, { stopId });
    return { stopId, operation };
  });

  app.post("/v1/events/:eventId/upgrade", async (request) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const { claims, event } = await ownedEvent(request, eventId);
    const { paymentId } = z.object({ paymentId: z.string() }).parse(request.body);
    const payment = await one<{ id: string; participant_limit: number; status: string }>(database, "SELECT id, participant_limit, status FROM event_payments WHERE id = $1 AND organization_id = $2", [paymentId, event.organization_id]);
    if (!payment || payment.status !== "paid") throw new HttpError(402, "UPGRADE_PAYMENT_REQUIRED", "Completa il pagamento della nuova fascia");
    if (payment.participant_limit <= (event.participant_limit ?? 0)) throw new HttpError(409, "UPGRADE_TIER_TOO_SMALL", "La nuova fascia deve aumentare la capienza");
    await database.transaction(async (transaction) => {
      await transaction.query("UPDATE events SET participant_limit = $2, updated_at = now() WHERE id = $1", [eventId, payment.participant_limit]);
      const consumed = await transaction.query("UPDATE event_payments SET status = 'consumed', consumed_event_id = $2, consumed_at = now() WHERE id = $1 AND status = 'paid' RETURNING id", [paymentId, eventId]);
      if (consumed.rows.length === 0) throw new HttpError(409, "PAYMENT_ALREADY_USED", "Questo pagamento è già stato utilizzato");
    });
    await audit(claims, "event.capacity.upgraded", "event", eventId, { paymentId, participantLimit: payment.participant_limit });
    return { eventId, participantLimit: payment.participant_limit, upgraded: true };
  });

  app.post("/v1/events/:eventId/timeline", async (request, reply) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const { claims } = await ownedEvent(request, eventId);
    const body = timelineSchema.parse(request.body);
    const latest = await one<{ version: number }>(database, "SELECT version FROM choreography_versions WHERE event_id = $1 ORDER BY version DESC LIMIT 1", [eventId]);
    const version = (latest?.version ?? 0) + 1;
    const checksum = sha256(canonicalJson({ cues: body.cues, assets: body.assets }));
    await database.transaction(async (transaction) => {
      await transaction.query("INSERT INTO choreography_versions (id, event_id, version, cues, assets, checksum, published_at) VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $7 THEN now() ELSE NULL END)", [randomUUID(), eventId, version, JSON.stringify(body.cues), JSON.stringify(body.assets), checksum, body.publish]);
      if (body.publish) await transaction.query("UPDATE events SET status = 'published', package_version = $2, updated_at = now() WHERE id = $1", [eventId, version]);
    });
    await audit(claims, body.publish ? "timeline.published" : "timeline.saved", "event", eventId, { version, checksum });
    return reply.code(201).send({ eventId, version, checksum, published: body.publish });
  });

  app.post("/v1/events/:eventId/media", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const { claims, event } = await ownedEvent(request, eventId);
    const file = await request.file();
    if (!file) throw new HttpError(400, "MEDIA_REQUIRED", "Seleziona un'immagine, GIF o video");
    const allowed = new Map([
      ["image/png", ".png"], ["image/jpeg", ".jpg"], ["image/gif", ".gif"],
      ["video/mp4", ".mp4"], ["video/webm", ".webm"], ["video/quicktime", ".mov"],
    ]);
    const extension = allowed.get(file.mimetype);
    if (!extension) throw new HttpError(415, "MEDIA_TYPE_UNSUPPORTED", "Formato supportato: PNG, JPG, GIF, MP4, WebM o MOV");
    const mediaId = randomUUID();
    const eventDirectory = resolve(workingStorageRoot, eventId);
    await mkdir(eventDirectory, { recursive: true });
    const sourcePath = resolve(eventDirectory, `${mediaId}${extension}`);
    await pipeline(file.file, createWriteStream(sourcePath, { flags: "wx", mode: 0o640 }));
    if (file.file.truncated) {
      await rm(sourcePath, { force: true });
      throw new HttpError(413, "MEDIA_TOO_LARGE", "Il file supera 60 MB");
    }
    const venue = await one<{ map: { elements?: VenueElement[] } | string }>(database, "SELECT map FROM venues WHERE id = $1", [event.venue_id]);
    const zones = venue ? (jsonValue<{ elements?: VenueElement[] }>(venue.map).elements ?? []).filter((element) => element.kind === "sector").map((element) => element.id) : [];
    let compiled;
    try {
      compiled = await compileMedia({ inputPath: sourcePath, zones, maxDurationSeconds: 45, fps: 5 });
    } catch (error) {
      await rm(sourcePath, { force: true }).catch(() => undefined);
      throw new HttpError(422, "MEDIA_CONVERSION_FAILED", error instanceof Error ? error.message : "Conversione media non riuscita");
    }
    const source = await readFile(sourcePath);
    try {
      await persistAsset(eventId, `${mediaId}${extension}`, source, file.mimetype);
    } finally {
      if (usesBlobAssets) await rm(sourcePath, { force: true }).catch(() => undefined);
    }
    const asset = { url: `/v1/public/assets/${eventId}/${mediaId}${extension}`, sha256: sha256(source), bytes: source.byteLength, mimeType: file.mimetype };
    await audit(claims, "media.compiled", "event", eventId, { mediaId, mimeType: file.mimetype, frames: compiled.frameCount, cues: compiled.cues.length });
    return reply.code(201).send({ mediaId, ...compiled, sourceAsset: asset });
  });

  app.post("/v1/events/:eventId/audio", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const { claims } = await ownedEvent(request, eventId);
    const file = await request.file({ limits: { files: 1, fileSize: 20 * 1024 * 1024 } });
    if (!file) throw new HttpError(400, "AUDIO_REQUIRED", "Seleziona un file audio");
    const allowed = new Map([
      ["audio/mpeg", ".mp3"], ["audio/wav", ".wav"], ["audio/x-wav", ".wav"],
      ["audio/ogg", ".ogg"], ["audio/mp4", ".m4a"], ["audio/aac", ".aac"],
    ]);
    const extension = allowed.get(file.mimetype);
    if (!extension) throw new HttpError(415, "AUDIO_TYPE_UNSUPPORTED", "Formato supportato: MP3, WAV, OGG, M4A o AAC");
    const audioId = randomUUID();
    const eventDirectory = resolve(workingStorageRoot, eventId);
    await mkdir(eventDirectory, { recursive: true });
    const path = resolve(eventDirectory, `${audioId}${extension}`);
    await pipeline(file.file, createWriteStream(path, { flags: "wx", mode: 0o640 }));
    if (file.file.truncated) {
      await rm(path, { force: true });
      throw new HttpError(413, "AUDIO_TOO_LARGE", "Il file supera 20 MB");
    }
    const source = await readFile(path);
    try {
      await persistAsset(eventId, `${audioId}${extension}`, source, file.mimetype);
    } finally {
      if (usesBlobAssets) await rm(path, { force: true }).catch(() => undefined);
    }
    const asset = { url: `/v1/public/assets/${eventId}/${audioId}${extension}`, sha256: sha256(source), bytes: source.byteLength, mimeType: file.mimetype };
    await audit(claims, "audio.uploaded", "event", eventId, { audioId, mimeType: file.mimetype, bytes: source.byteLength });
    return reply.code(201).send({ audioId, asset });
  });

  app.post("/v1/events/:eventId/cover", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const { claims } = await ownedEvent(request, eventId);
    const file = await request.file({ limits: { files: 1, fileSize: 12 * 1024 * 1024 } });
    if (!file) throw new HttpError(400, "COVER_REQUIRED", "Seleziona una copertina");
    const allowed = new Map([["image/png", ".png"], ["image/jpeg", ".jpg"], ["image/webp", ".webp"]]);
    const extension = allowed.get(file.mimetype);
    if (!extension) throw new HttpError(415, "COVER_TYPE_UNSUPPORTED", "Formato supportato: PNG, JPG o WebP");
    const coverId = `cover-${randomUUID()}`;
    const eventDirectory = resolve(workingStorageRoot, eventId);
    await mkdir(eventDirectory, { recursive: true });
    const path = resolve(eventDirectory, `${coverId}${extension}`);
    await pipeline(file.file, createWriteStream(path, { flags: "wx", mode: 0o640 }));
    if (file.file.truncated) {
      await rm(path, { force: true });
      throw new HttpError(413, "COVER_TOO_LARGE", "La copertina supera 12 MB");
    }
    const source = await readFile(path);
    try {
      await persistAsset(eventId, `${coverId}${extension}`, source, file.mimetype);
    } finally {
      if (usesBlobAssets) await rm(path, { force: true }).catch(() => undefined);
    }
    const coverUrl = `/v1/public/assets/${eventId}/${coverId}${extension}`;
    await database.query("UPDATE events SET cover_url = $2, updated_at = now() WHERE id = $1", [eventId, coverUrl]);
    await audit(claims, "event.cover.updated", "event", eventId, { coverUrl });
    return reply.code(201).send({ eventId, coverUrl });
  });

  app.get("/v1/public/assets/:eventId/:filename", async (request, reply) => {
    const { eventId, filename } = z.object({ eventId: z.string().regex(/^[a-zA-Z0-9_-]+$/), filename: z.string().regex(/^[a-zA-Z0-9_-]+\.[a-z0-9]+$/) }).parse(request.params);
    if (usesBlobAssets) {
      const stored = await retrieveAsset(eventId, filename);
      if (!stored) throw new HttpError(404, "ASSET_NOT_FOUND", "Asset non trovato");
      reply.header("content-type", stored.contentType);
      reply.header("cache-control", "public, max-age=31536000, immutable");
      reply.header("content-length", stored.size);
      return reply.send(stored.stream);
    }
    const path = resolve(storageRoot, eventId, filename);
    if (!path.startsWith(resolve(storageRoot, eventId))) throw new HttpError(400, "ASSET_PATH_INVALID", "Percorso non valido");
    const details = await stat(path).catch(() => null);
    if (!details?.isFile()) throw new HttpError(404, "ASSET_NOT_FOUND", "Asset non trovato");
    const types: Record<string, string> = {
      ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
      ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".aac": "audio/aac",
    };
    reply.header("content-type", types[extname(filename)] ?? "application/octet-stream");
    reply.header("cache-control", "public, max-age=31536000, immutable");
    reply.header("content-length", details.size);
    return reply.send(createReadStream(path));
  });

  app.post("/v1/events/:eventId/qr", async (request, reply) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const { claims, event } = await ownedEvent(request, eventId);
    const body = qrSchema.parse(request.body);
    const elements = await eventQrElements(event);
    if (!elements.some((element) => element.id === body.zoneId)) throw new HttpError(400, "ZONE_INVALID", "Zona non presente nella configurazione dell'evento");
    const issued = await issueQr(event, body.zoneId, body.seatId, body.expiresAt);
    await audit(claims, "qr.issued", "event", eventId, { qrId: issued.qrId, zoneId: body.zoneId, seatId: body.seatId });
    return reply.code(201).send(issued);
  });

  app.post("/v1/events/:eventId/qr/bulk", async (request, reply) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const { claims, event } = await ownedEvent(request, eventId);
    const body = z.object({ zoneIds: z.array(z.string()).max(500).optional(), includeSeats: z.boolean().default(false), expiresAt: z.string().datetime().optional() }).parse(request.body);
    const elements = (await eventQrElements(event)).filter((element) => !body.zoneIds?.length || body.zoneIds.includes(element.id));
    if (elements.length === 0) throw new HttpError(400, "ZONE_INVALID", "Nessuna zona selezionata");
    const requested = elements.reduce((total, element) => total + (body.includeSeats ? Math.max(1, venueElementSeatIds(element).length) : 1), 0);
    if (requested > 5000) throw new HttpError(413, "QR_BATCH_TOO_LARGE", "Genera al massimo 5.000 QR per lotto");
    const codes: Awaited<ReturnType<typeof issueQr>>[] = [];
    for (const element of elements) {
      if (!body.includeSeats) {
        codes.push(await issueQr(event, element.id, undefined, body.expiresAt));
        continue;
      }
      const seatIds = venueElementSeatIds(element);
      for (const seatId of seatIds) codes.push(await issueQr(event, element.id, seatId, body.expiresAt));
      if (seatIds.length === 0) codes.push(await issueQr(event, element.id, undefined, body.expiresAt));
    }
    await audit(claims, "qr.bulk.issued", "event", eventId, { count: codes.length, includeSeats: body.includeSeats });
    return reply.code(201).send({ eventId, count: codes.length, codes });
  });

  app.post("/v1/public/qr/resolve", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request) => {
    const { token, installationId, participantToken } = z.object({ token: z.string().min(20), installationId: z.string().min(8).max(120).optional(), participantToken: z.string().optional() }).parse(request.body);
    let claims: QrClaims;
    try {
      claims = verifyPayload<QrClaims>(token, secret);
      if (claims.purpose !== "qr") throw new Error("TOKEN_INVALID");
    } catch {
      throw new HttpError(401, "QR_INVALID", "QR non valido o scaduto");
    }
    const qr = await one<{ id: string; revoked_at?: string | Date }>(database, "SELECT id, revoked_at FROM qr_codes WHERE id = $1 AND token_hash = $2 AND expires_at > now()", [claims.qrId, sha256(token)]);
    if (!qr || qr.revoked_at) throw new HttpError(401, "QR_REVOKED", "QR revocato o scaduto");
    const event = await one<EventRow>(database, "SELECT * FROM events WHERE id = $1 AND status IN ('published', 'live')", [claims.eventId]);
    if (!event) throw new HttpError(409, "EVENT_UNAVAILABLE", "Evento non disponibile");
    const participant = await participantFromToken(participantToken);
    const installation = installationId ?? `qr-${claims.qrId}`;
    const join = await registerJoin(event, installation, "qr", claims.zoneId, claims.seatId, participant?.sub);
    return { sessionId: join.joinId, joinToken: join.token, event: { id: event.id, title: event.title, startsAt: iso(event.starts_at), status: event.status }, manifest: await manifestFor(event, join.zoneId, join.seatId), realtimeUrl: `/v1/realtime/${event.id}?token=${encodeURIComponent(join.token)}` };
  });

  app.get("/v1/public/events/:eventId", async (request) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const event = await one<EventRow & { venue_name: string; organization_name: string; organization_brand: unknown }>(database, "SELECT e.*, v.name AS venue_name, o.name AS organization_name, o.brand AS organization_brand FROM events e JOIN venues v ON v.id = e.venue_id JOIN organizations o ON o.id = e.organization_id WHERE e.id = $1 AND e.status IN ('published', 'live')", [eventId]);
    if (!event) throw new HttpError(404, "EVENT_NOT_FOUND", "Evento non trovato");
    const joined = await one<{ count: number }>(database, "SELECT count(*)::int AS count FROM event_joins WHERE event_id = $1", [eventId]);
    return { ...event, starts_at: iso(event.starts_at), ends_at: iso(event.ends_at), access_policy: jsonValue(event.access_policy ?? {}), joined: joined?.count ?? 0 };
  });

  app.get("/v1/public/events/:eventId/route", async (request) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const event = await one<EventRow>(database, "SELECT * FROM events WHERE id = $1 AND kind = 'parade' AND status IN ('published', 'live')", [eventId]);
    if (!event) throw new HttpError(404, "EVENT_NOT_FOUND", "Corteo non disponibile");
    const plan = await routePlanFor(event);
    return {
      ...plan,
      routeStops: plan.routeStops.map((stop) => ({ ...stop, operation: { ...stop.operation, triggeredBy: undefined } })),
    };
  });

  app.post("/v1/public/events/:eventId/join/location", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (request) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const body = locationJoinSchema.parse(request.body);
    const event = await one<EventRow>(database, "SELECT * FROM events WHERE id = $1 AND status IN ('published', 'live')", [eventId]);
    if (!event) throw new HttpError(404, "EVENT_NOT_FOUND", "Evento non disponibile");
    const policy = jsonValue<EventAccessPolicy>(event.access_policy ?? { visibility: "public", methods: ["qr"], discoveryRadiusM: event.discovery_radius_m });
    let method: JoinClaims["method"] | undefined;
    let zoneId = zoneAtLocation(policy, body.longitude, body.latitude);
    if (policy.methods.includes("fixed_geofence")) {
      const insideFixed = pointInGeometry(body.longitude, body.latitude, policy.fixedGeometry) || Boolean(zoneId);
      if (insideFixed) method = "fixed_geofence";
    }
    if (!method && policy.methods.includes("mobile_radius")) {
      const leader = await one<{ latitude: number; longitude: number; updated_at: string | Date }>(database, "SELECT latitude, longitude, updated_at FROM event_leader_location WHERE event_id = $1", [eventId]);
      if (leader && haversineMeters(body.latitude, body.longitude, leader.latitude, leader.longitude) <= (policy.mobileRadiusM ?? 500)) method = "mobile_radius";
    }
    if (!method) throw new HttpError(403, "OUTSIDE_EVENT_AREA", "Non sei ancora nell'area di accesso dell'evento");
    zoneId ??= method === "mobile_radius" ? "CORTEO" : "GPS";
    const participant = await participantFromToken(body.participantToken);
    const join = await registerJoin(event, body.installationId, method, zoneId, undefined, participant?.sub);
    return { sessionId: join.joinId, joinToken: join.token, event: { id: event.id, title: event.title, startsAt: iso(event.starts_at), status: event.status }, manifest: await manifestFor(event, join.zoneId, join.seatId), realtimeUrl: `/v1/realtime/${event.id}?token=${encodeURIComponent(join.token)}` };
  });

  app.post("/v1/public/events/:eventId/join/location/update", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async (request) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const body = z.object({ joinToken: z.string(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).parse(request.body);
    let claims: JoinClaims;
    try {
      claims = verifyPayload<JoinClaims>(body.joinToken, secret);
      if (claims.purpose !== "event_join" || claims.eventId !== eventId) throw new Error("TOKEN_INVALID");
    } catch {
      throw new HttpError(401, "JOIN_INVALID", "Sessione evento non valida");
    }
    if (claims.method === "qr") return { eventId, zoneId: claims.zoneId, seatId: claims.seatId ?? null, lockedByQr: true, changed: false };
    const event = await one<EventRow>(database, "SELECT * FROM events WHERE id = $1 AND status IN ('published', 'live')", [eventId]);
    if (!event) throw new HttpError(404, "EVENT_NOT_FOUND", "Evento non disponibile");
    if (claims.method === "mobile_radius") return { eventId, zoneId: claims.zoneId, lockedByQr: false, changed: false };
    const policy = jsonValue<EventAccessPolicy>(event.access_policy ?? { visibility: "public", methods: ["fixed_geofence"], discoveryRadiusM: event.discovery_radius_m });
    const targetZone = zoneAtLocation(policy, body.longitude, body.latitude);
    const join = await one<{ id: string; zone_id: string; seat_id?: string; candidate_zone_id?: string; candidate_since?: string | Date }>(database, "SELECT id, zone_id, seat_id, candidate_zone_id, candidate_since FROM event_joins WHERE id = $1 AND event_id = $2", [claims.joinId, eventId]);
    if (!join) throw new HttpError(404, "JOIN_NOT_FOUND", "Sessione evento non trovata");
    if (!targetZone || targetZone === join.zone_id) {
      await database.query("UPDATE event_joins SET candidate_zone_id = NULL, candidate_since = NULL, last_seen_at = now() WHERE id = $1", [join.id]);
      return { eventId, zoneId: join.zone_id, lockedByQr: false, changed: false };
    }
    const dwellSeconds = policy.geoZones?.find((zone) => zone.id === targetZone)?.dwellSeconds ?? 8;
    if (join.candidate_zone_id !== targetZone || !join.candidate_since) {
      await database.query("UPDATE event_joins SET candidate_zone_id = $2, candidate_since = now(), last_seen_at = now() WHERE id = $1", [join.id, targetZone]);
      return { eventId, zoneId: join.zone_id, candidateZoneId: targetZone, dwellRemainingSeconds: dwellSeconds, changed: false };
    }
    const elapsedSeconds = (Date.now() - new Date(join.candidate_since).getTime()) / 1000;
    if (elapsedSeconds < dwellSeconds) return { eventId, zoneId: join.zone_id, candidateZoneId: targetZone, dwellRemainingSeconds: Math.ceil(dwellSeconds - elapsedSeconds), changed: false };
    await database.query("UPDATE event_joins SET zone_id = $2, candidate_zone_id = NULL, candidate_since = NULL, last_seen_at = now() WHERE id = $1", [join.id, targetZone]);
    const nextClaims: JoinClaims = { ...claims, zoneId: targetZone };
    const joinToken = signPayload(nextClaims, secret);
    return { eventId, zoneId: targetZone, changed: true, joinToken, manifest: await manifestFor(event, targetZone), realtimeUrl: `/v1/realtime/${event.id}?token=${encodeURIComponent(joinToken)}` };
  });

  app.put("/v1/events/:eventId/leader/location", async (request) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const { claims, event } = await ownedEvent(request, eventId);
    const body = leaderLocationSchema.parse(request.body);
    const policy = jsonValue<EventAccessPolicy>(event.access_policy ?? { visibility: "private", methods: ["qr"], discoveryRadiusM: event.discovery_radius_m });
    if (!policy.methods?.includes("mobile_radius")) throw new HttpError(409, "MOBILE_RADIUS_DISABLED", "Il raggio mobile non è attivo per questo evento");
    await database.query("INSERT INTO event_leader_location (event_id, user_id, latitude, longitude, accuracy_m, updated_at) VALUES ($1, $2, $3, $4, $5, now()) ON CONFLICT (event_id) DO UPDATE SET user_id = EXCLUDED.user_id, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, accuracy_m = EXCLUDED.accuracy_m, updated_at = now()", [eventId, claims.sub, body.latitude, body.longitude, body.accuracyM]);
    const activatedStops = [];
    if (event.kind === "parade" && event.status === "live") {
      for (const stop of policy.routeStops ?? []) {
        if (!stop.enabled || stop.trigger !== "arrival") continue;
        if (haversineMeters(body.latitude, body.longitude, stop.latitude, stop.longitude) > (stop.radiusM ?? 50)) continue;
        activatedStops.push(await issueRouteStop(event, claims, stop));
      }
    }
    return { eventId, active: true, latitude: body.latitude, longitude: body.longitude, accuracyM: body.accuracyM, updatedAt: new Date().toISOString(), activatedStops };
  });

  app.get("/v1/public/events/nearby", async (request) => {
    const query = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180), radiusM: z.coerce.number().int().min(100).max(50_000).default(10_000) }).parse(request.query);
    return findNearbyEvents(query.lat, query.lng, query.radiusM);
  });

  app.post("/v1/public/installations/:installationId/nearby", async (request) => {
    const { installationId } = z.object({ installationId: z.string().min(8).max(120) }).parse(request.params);
    const body = z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), radiusM: z.number().int().min(100).max(50_000).default(10_000) }).parse(request.body);
    const installation = await one<{ id: string; notifications_enabled: boolean }>(database, "SELECT id, notifications_enabled FROM app_installations WHERE id = $1", [installationId]);
    if (!installation) throw new HttpError(404, "INSTALLATION_NOT_FOUND", "Dispositivo non registrato");
    const events = await findNearbyEvents(body.latitude, body.longitude, body.radiusM);
    let notificationsCreated = 0;
    if (installation.notifications_enabled) {
      for (const event of events) {
        const result = await database.query("INSERT INTO app_notifications (id, installation_id, event_id, kind, title_it, title_en, body_it, body_en) VALUES ($1, $2, $3, 'nearby_event', 'Evento nelle vicinanze', 'Event nearby', $4, $5) ON CONFLICT (installation_id, event_id, kind) WHERE event_id IS NOT NULL DO NOTHING RETURNING id", [randomUUID(), installationId, event.id, `${event.title} è a ${event.distanceM} metri da te. Apri onePixel per partecipare.`, `${event.title} is ${event.distanceM} metres away. Open onePixel to join.`]);
        notificationsCreated += result.rows.length;
      }
    }
    return { events, notificationsCreated };
  });

  app.post("/v1/events/:eventId/commands", async (request, reply) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const { claims } = await ownedEvent(request, eventId);
    const body = commandSchema.parse(request.body);
    const previous = await one<{ sequence: number }>(database, "SELECT sequence FROM live_commands WHERE event_id = $1 ORDER BY sequence DESC LIMIT 1", [eventId]);
    const command: LiveCommand = { protocolVersion, eventId, sequence: (previous?.sequence ?? 0) + 1, commandId: randomUUID(), issuedAt: new Date().toISOString(), executeAt: body.executeAt ?? new Date(Date.now() + 350).toISOString(), type: body.type, cue: body.cue as TimelineCue | undefined, reason: body.reason };
    await database.transaction(async (transaction) => {
      await transaction.query("INSERT INTO live_commands (id, event_id, sequence, type, payload, issued_at, execute_at) VALUES ($1, $2, $3, $4, $5, $6, $7)", [command.commandId, eventId, command.sequence, command.type, JSON.stringify({ cue: command.cue, reason: command.reason, scheduled: Boolean(body.executeAt), cancelled: false }), command.issuedAt, command.executeAt]);
      if (command.type === "start") await transaction.query("UPDATE events SET status = 'live', updated_at = now() WHERE id = $1", [eventId]);
      if (command.type === "stop") await transaction.query("UPDATE events SET status = 'stopped', updated_at = now() WHERE id = $1", [eventId]);
    });
    if (command.type === "stop") {
      cancelScheduledCommands(eventId);
      await database.query("UPDATE live_commands SET payload = payload || '{\"cancelled\":true}'::jsonb WHERE event_id = $1 AND type = 'cue' AND execute_at > now()", [eventId]);
      await database.query("UPDATE parade_route_stop_runs SET status = 'cancelled', updated_at = now() WHERE event_id = $1 AND status = 'scheduled'", [eventId]);
      hub.broadcast(eventId, { type: "route_stopped", eventId, status: "cancelled", updatedAt: new Date().toISOString() });
    }
    const delivery = dispatchCommand(command, Boolean(body.executeAt));
    await audit(claims, `live.${command.type}`, "event", eventId, { sequence: command.sequence, ...delivery });
    return reply.code(202).send({ command, ...delivery });
  });

  app.get("/v1/events/:eventId/presence", async (request) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    await ownedEvent(request, eventId);
    const totals = await one<{ connected: number; ready: number; avg_offset_ms: number }>(database, "SELECT count(*)::int AS connected, count(*) FILTER (WHERE ready)::int AS ready, COALESCE(round(avg(abs(clock_offset_ms))), 0)::int AS avg_offset_ms FROM device_sessions WHERE event_id = $1 AND last_seen_at > now() - interval '45 seconds'", [eventId]);
    const zones = await many<{ zone_id: string; connected: number; ready: number }>(database, "SELECT zone_id, count(*)::int AS connected, count(*) FILTER (WHERE ready)::int AS ready FROM device_sessions WHERE event_id = $1 AND last_seen_at > now() - interval '45 seconds' GROUP BY zone_id ORDER BY zone_id", [eventId]);
    return { ...totals, websocketConnections: hub.count(eventId), zones, sampledAt: new Date().toISOString() };
  });

  app.get("/v1/events/:eventId/report", async (request) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    await ownedEvent(request, eventId);
    const devices = await one<{ unique_devices: number; ready_devices: number; avg_offset_ms: number }>(database, "SELECT count(DISTINCT session_id)::int AS unique_devices, count(DISTINCT session_id) FILTER (WHERE ready)::int AS ready_devices, COALESCE(round(avg(abs(clock_offset_ms))), 0)::int AS avg_offset_ms FROM device_sessions WHERE event_id = $1", [eventId]);
    const commands = await one<{ total_commands: number; stop_commands: number }>(database, "SELECT count(*)::int AS total_commands, count(*) FILTER (WHERE type = 'stop')::int AS stop_commands FROM live_commands WHERE event_id = $1", [eventId]);
    const zones = await many<{ zone_id: string; unique_devices: number; ready_devices: number; avg_offset_ms: number }>(database, "SELECT zone_id, count(DISTINCT session_id)::int AS unique_devices, count(DISTINCT session_id) FILTER (WHERE ready)::int AS ready_devices, COALESCE(round(avg(abs(clock_offset_ms))), 0)::int AS avg_offset_ms FROM device_sessions WHERE event_id = $1 GROUP BY zone_id ORDER BY zone_id", [eventId]);
    return { eventId, devices, commands, zones, generatedAt: new Date().toISOString() };
  });

  app.get("/v1/realtime/:eventId", { websocket: true }, (socket, request) => {
    const { eventId } = z.object({ eventId: z.string() }).parse(request.params);
    const { token } = z.object({ token: z.string() }).parse(request.query);
    try {
      const claims = verifyPayload<QrClaims | JoinClaims>(token, secret);
      if ((claims.purpose !== "qr" && claims.purpose !== "event_join") || claims.eventId !== eventId) throw new Error("TOKEN_INVALID");
    } catch {
      socket.close(1008, "invalid token");
      return;
    }
    hub.add(eventId, socket);
    socket.send(JSON.stringify({ type: "sync", protocolVersion, eventId, serverTime: new Date().toISOString() }));
    socket.on("message", async (raw) => {
      try {
        const heartbeat = heartbeatSchema.parse(JSON.parse(raw.toString()));
        await database.query("INSERT INTO device_sessions (session_id, event_id, zone_id, package_version, clock_offset_ms, ready, last_seen_at) VALUES ($1, $2, $3, $4, $5, $6, now()) ON CONFLICT (session_id) DO UPDATE SET zone_id = EXCLUDED.zone_id, package_version = EXCLUDED.package_version, clock_offset_ms = EXCLUDED.clock_offset_ms, ready = EXCLUDED.ready, last_seen_at = now()", [heartbeat.sessionId, eventId, heartbeat.zoneId, heartbeat.packageVersion, heartbeat.clockOffsetMs, heartbeat.ready]);
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "heartbeat_ack", serverTime: new Date().toISOString() }));
      } catch {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "error", error: "INVALID_MESSAGE" }));
      }
    });
  });

  return app;
}
