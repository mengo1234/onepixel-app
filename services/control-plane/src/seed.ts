import { randomUUID } from "node:crypto";
import type { TimelineCue, VenueElement } from "../../../packages/protocol/src/index.js";
import { openDatabase, one, type Database } from "./database.js";
import { canonicalJson, hashPassword, sha256 } from "./security.js";

export const demoIds = {
  organization: "org_arena_nord",
  venue: "venue_arena_nord",
  layout: "layout_arena_nord_campionato",
  event: "event_finale_luce",
  choreography: "choreo_finale_luce_v1",
};

export async function seedDemo(database: Database): Promise<void> {
  const existing = await one<{ count: number }>(database, "SELECT count(*)::int AS count FROM users");
  const now = new Date();
  const start = new Date(now.getTime() + 45 * 60_000);
  const end = new Date(start.getTime() + 3 * 60 * 60_000);
  const expiry = new Date(now.getTime() + 365 * 24 * 60 * 60_000);
  const superPassword = await hashPassword("OnePixel!2026");
  const organizationPassword = await hashPassword("Arena!2026");

  const sectors: VenueElement[] = Array.from({ length: 12 }, (_, index) => ({
    id: `N${index + 1}`,
    kind: "sector",
    label: `Settore N${index + 1}`,
    polygon: [
      { x: 8 + (index % 4) * 23, y: 8 + Math.floor(index / 4) * 30 },
      { x: 27 + (index % 4) * 23, y: 8 + Math.floor(index / 4) * 30 },
      { x: 27 + (index % 4) * 23, y: 31 + Math.floor(index / 4) * 30 },
      { x: 8 + (index % 4) * 23, y: 31 + Math.floor(index / 4) * 30 },
    ],
    rows: 36,
    seatsPerRow: 74,
    levelId: `ring-${Math.floor(index / 4) + 1}`,
    rowStyle: index % 4 === 0 || index % 4 === 3 ? "curved" : "straight",
  }));
  const layoutDocument = {
    schemaVersion: 2 as const,
    unit: "m" as const,
    widthM: 120,
    heightM: 105,
    levels: [
      { id: "ring-1", name: "Anello inferiore", order: 0, elevationM: 0 },
      { id: "ring-2", name: "Anello intermedio", order: 1, elevationM: 8 },
      { id: "ring-3", name: "Anello superiore", order: 2, elevationM: 17 },
    ],
    elements: [
      ...sectors,
      { id: "field-main", kind: "field" as const, label: "Campo centrale", levelId: "ring-1", polygon: [{ x: 30, y: 33 }, { x: 90, y: 33 }, { x: 90, y: 72 }, { x: 30, y: 72 }] },
      { id: "stage-north", kind: "stage" as const, label: "Palco modulare nord", levelId: "ring-1", polygon: [{ x: 44, y: 10 }, { x: 76, y: 10 }, { x: 76, y: 20 }, { x: 44, y: 20 }] },
      { id: "entrance-a", kind: "entrance" as const, label: "Ingresso A", levelId: "ring-1", polygon: [{ x: 4, y: 46 }, { x: 9, y: 46 }, { x: 9, y: 58 }, { x: 4, y: 58 }] },
      { id: "accessible-1", kind: "accessible-area" as const, label: "Pedana accessibile", levelId: "ring-1", polygon: [{ x: 94, y: 45 }, { x: 104, y: 45 }, { x: 104, y: 57 }, { x: 94, y: 57 }], rows: 2, seatsPerRow: 10 },
    ],
  };
  const cues: TimelineCue[] = [
    { id: "cue-countdown", atMs: 0, durationMs: 3000, zones: ["*"], color: "#D1E66A", text: { it: "ALZA LA LUCE", en: "RAISE YOUR LIGHT" }, vibration: [80, 80, 80] },
    { id: "cue-wave-north", atMs: 3000, durationMs: 6000, zones: ["N1", "N2", "N3", "N4"], color: "#77A4A1", torch: false },
    { id: "cue-final", atMs: 9000, durationMs: 5000, zones: ["*"], color: "#E2A65A", text: { it: "INSIEME", en: "TOGETHER" }, vibration: [140, 70, 140] },
  ];
  const checksum = sha256(canonicalJson({ cues, assets: [] }));
  const accessPolicy = {
    visibility: "public",
    methods: ["qr", "fixed_geofence"],
    discoveryRadiusM: 5000,
    fixedGeometry: { type: "Polygon", coordinates: [[[9.1208, 45.4757], [9.1272, 45.4757], [9.1272, 45.4805], [9.1208, 45.4805], [9.1208, 45.4757]]] },
    geoZones: [
      { id: "NORD", label: "Macro zona nord", dwellSeconds: 6, geometry: { type: "Polygon", coordinates: [[[9.1208, 45.4781], [9.1272, 45.4781], [9.1272, 45.4805], [9.1208, 45.4805], [9.1208, 45.4781]]] } },
      { id: "SUD", label: "Macro zona sud", dwellSeconds: 6, geometry: { type: "Polygon", coordinates: [[[9.1208, 45.4757], [9.1272, 45.4757], [9.1272, 45.4781], [9.1208, 45.4781], [9.1208, 45.4757]]] } },
    ],
  };

  if ((existing?.count ?? 0) > 0) {
    await database.transaction(async (transaction) => {
      await transaction.query("INSERT INTO venue_layouts (id, venue_id, organization_id, name, version, is_default, capacity, document) VALUES ($1, $2, $3, $4, 1, true, 31988, $5) ON CONFLICT (id) DO UPDATE SET document = EXCLUDED.document, capacity = EXCLUDED.capacity, updated_at = now()", [demoIds.layout, demoIds.venue, demoIds.organization, "Campionato + palco", JSON.stringify(layoutDocument)]);
      await transaction.query("UPDATE events SET starts_at = $2, ends_at = $3, status = 'published', layout_id = $4, layout_snapshot = $5, description = $6, location_name = $7, access_policy = $8, participant_limit = 50000, discovery_radius_m = 5000 WHERE id = $1", [demoIds.event, start.toISOString(), end.toISOString(), demoIds.layout, JSON.stringify(layoutDocument), "Evento dimostrativo completo: tre anelli, posti, palco modulare, accesso QR preciso e GPS per macro-zona.", "Milano · Arena Nord", JSON.stringify(accessPolicy)]);
    });
    return;
  }

  await database.transaction(async (transaction) => {
    await transaction.query("INSERT INTO organizations (id, slug, name, status, brand) VALUES ($1, $2, $3, 'active', $4)", [demoIds.organization, "arena-nord", "Arena Nord", JSON.stringify({ primary: "#D1E66A", logo: null })]);
    await transaction.query("INSERT INTO licenses (organization_id, starts_at, expires_at, max_events, max_devices, max_capacity, notes) VALUES ($1, $2, $3, 24, 80000, 65000, $4)", [demoIds.organization, now.toISOString(), expiry.toISOString(), "Licenza dimostrativa locale"]);
    await transaction.query("INSERT INTO users (id, organization_id, email, password_hash, role) VALUES ($1, NULL, $2, $3, 'super_admin')", [randomUUID(), "admin@onepixel.local", superPassword]);
    await transaction.query("INSERT INTO users (id, organization_id, email, password_hash, role) VALUES ($1, $2, $3, $4, 'organization_admin')", [randomUUID(), demoIds.organization, "regia@arenanord.it", organizationPassword]);
    await transaction.query("INSERT INTO venues (id, organization_id, name, kind, capacity, map) VALUES ($1, $2, $3, 'stadium', 31988, $4)", [demoIds.venue, demoIds.organization, "Arena Nord", JSON.stringify({ width: 120, height: 105, elements: sectors })]);
    await transaction.query("INSERT INTO venue_layouts (id, venue_id, organization_id, name, version, is_default, capacity, document) VALUES ($1, $2, $3, $4, 1, true, 31988, $5)", [demoIds.layout, demoIds.venue, demoIds.organization, "Campionato + palco", JSON.stringify(layoutDocument)]);
    await transaction.query("INSERT INTO events (id, organization_id, venue_id, title, kind, status, starts_at, ends_at, latitude, longitude, discovery_radius_m, audio_allowed, torch_allowed, layout_id, layout_snapshot, description, location_name, access_policy, participant_limit) VALUES ($1, $2, $3, $4, 'sport', 'published', $5, $6, 45.4781, 9.1240, 5000, true, true, $7, $8, $9, $10, $11, 50000)", [demoIds.event, demoIds.organization, demoIds.venue, "Finale Luce", start.toISOString(), end.toISOString(), demoIds.layout, JSON.stringify(layoutDocument), "Evento dimostrativo completo: tre anelli, posti, palco modulare, accesso QR preciso e GPS per macro-zona.", "Milano · Arena Nord", JSON.stringify(accessPolicy)]);
    await transaction.query("INSERT INTO choreography_versions (id, event_id, version, cues, assets, checksum, published_at) VALUES ($1, $2, 1, $3, '[]'::jsonb, $4, now())", [demoIds.choreography, demoIds.event, JSON.stringify(cues), checksum]);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const database = await openDatabase(process.env.ONEPIXEL_DATABASE ?? "./.data/postgres");
  await seedDemo(database);
  console.log("Demo ready: admin@onepixel.local / OnePixel!2026; regia@arenanord.it / Arena!2026");
  await database.close();
}
