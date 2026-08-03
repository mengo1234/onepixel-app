import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createApp } from "../src/application.js";
import { openDatabase, type Database } from "../src/database.js";
import { demoIds } from "../src/seed.js";

const secret = "onepixel-test-secret-that-is-long-enough-2026";
let database: Database;
let app: Awaited<ReturnType<typeof createApp>>;
let organizationToken = "";
let superAdminToken = "";
let qrToken = "";
let qrSessionId = "";
let selfServeToken = "";
let selfServeVenueId = "";
let selfServeLayoutId = "";
let selfServePaymentId = "";
let selfServeEventId = "";
let paradeEventId = "";
let participantToken = "";

function waitForMessage(socket: WebSocket, expectedType: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout waiting for ${expectedType}`)), 3000);
    const listener = (data: WebSocket.RawData) => {
      const message = JSON.parse(data.toString()) as Record<string, unknown>;
      if (message.type !== expectedType) return;
      clearTimeout(timeout);
      socket.off("message", listener);
      resolve(message);
    };
    socket.on("message", listener);
  });
}

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  database = await openDatabase();
  app = await createApp({ database, secret, seed: true });
  await app.listen({ host: "127.0.0.1", port: 0 });
});

afterAll(async () => {
  await app.close();
  await database.close();
});

describe.sequential("onePixel control plane", () => {
  it("espone salute e versione del protocollo", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", protocolVersion: 1 });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("autentica separatamente organizzazione e super amministratore", async () => {
    const organization = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "regia@arenanord.it", password: "Arena!2026" } });
    const admin = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "admin@onepixel.local", password: "OnePixel!2026" } });
    expect(organization.statusCode).toBe(200);
    expect(admin.statusCode).toBe(200);
    organizationToken = organization.json().token;
    superAdminToken = admin.json().token;
    expect(organization.json().user).toMatchObject({ role: "organization_admin", organizationId: demoIds.organization });
    expect(admin.json().user).toMatchObject({ role: "super_admin", organizationId: null });
  });

  it("impedisce a una organizzazione di usare la console super admin", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/admin/organizations", headers: { authorization: `Bearer ${organizationToken}` } });
    expect(response.statusCode).toBe(403);
    const allowed = await app.inject({ method: "GET", url: "/v1/admin/organizations", headers: { authorization: `Bearer ${superAdminToken}` } });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()[0]).toMatchObject({ id: demoIds.organization, name: "Arena Nord" });
  });

  it("mostra gli utenti al super admin e registra l'ultimo accesso", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/admin/users", headers: { authorization: `Bearer ${superAdminToken}` } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(expect.arrayContaining([
      expect.objectContaining({ email: "admin@onepixel.local", role: "super_admin", last_login_at: expect.any(String) }),
      expect.objectContaining({ email: "regia@arenanord.it", role: "organization_admin", last_login_at: expect.any(String) }),
    ]));
  });

  it("registra autonomamente un organizzatore e vende una fascia evento in modalità test", async () => {
    const registration = await app.inject({ method: "POST", url: "/v1/auth/register", payload: { name: "Livia Ferri", organizationName: "Luce Civica", email: "livia@lucecivica.test", password: "Evento!Sicuro2026" } });
    expect(registration.statusCode).toBe(201);
    selfServeToken = registration.json().token;
    const tiers = await app.inject({ method: "GET", url: "/v1/billing/tiers" });
    expect(tiers.json()).toMatchObject([{ id: "small", participantLimit: 500, amountCents: 300 }, { id: "medium", participantLimit: 5000, amountCents: 700 }, { id: "large", amountCents: 1900 }]);
    const checkout = await app.inject({ method: "POST", url: "/v1/billing/checkout", headers: { authorization: `Bearer ${selfServeToken}` }, payload: { tier: "small", successUrl: "https://onepixel.test/checkout/success", cancelUrl: "https://onepixel.test/checkout/cancel" } });
    expect(checkout.statusCode).toBe(201);
    expect(checkout.json()).toMatchObject({ mock: true });
    selfServePaymentId = checkout.json().paymentId;
    const confirmation = await app.inject({ method: "POST", url: "/v1/billing/confirm", headers: { authorization: `Bearer ${selfServeToken}` }, payload: { paymentId: selfServePaymentId, sessionId: checkout.json().providerSessionId } });
    expect(confirmation.statusCode).toBe(200);
    expect(confirmation.json()).toMatchObject({ paymentId: selfServePaymentId, status: "paid", confirmed: true });
  });

  it("crea una struttura con configurazione 2D versionata", async () => {
    const venue = await app.inject({ method: "POST", url: "/v1/venues", headers: { authorization: `Bearer ${selfServeToken}` }, payload: { name: "Piazza del Faro", kind: "square", capacity: 320 } });
    expect(venue.statusCode).toBe(201);
    selfServeVenueId = venue.json().id;
    selfServeLayoutId = venue.json().layoutId;
    expect(venue.json().document).toMatchObject({ schemaVersion: 2, unit: "m", levels: [{ name: "Piano terra" }] });
    const layouts = await app.inject({ method: "GET", url: `/v1/venues/${selfServeVenueId}/layouts`, headers: { authorization: `Bearer ${selfServeToken}` } });
    expect(layouts.statusCode).toBe(200);
    expect(layouts.json()[0]).toMatchObject({ id: selfServeLayoutId, is_default: true });
  });

  it("consuma il pagamento per creare un evento GPS e impedisce di riutilizzarlo", async () => {
    const accessPolicy = { visibility: "public", methods: ["qr", "fixed_geofence", "mobile_radius"], discoveryRadiusM: 4000, mobileRadiusM: 250, fixedGeometry: { type: "Polygon", coordinates: [[[9.12, 45.47], [9.13, 45.47], [9.13, 45.48], [9.12, 45.48], [9.12, 45.47]]] }, geoZones: [{ id: "PIAZZA", label: "Piazza", dwellSeconds: 8, geometry: { type: "Polygon", coordinates: [[[9.12, 45.47], [9.13, 45.47], [9.13, 45.48], [9.12, 45.48], [9.12, 45.47]]] } }] };
    const startsAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const endsAt = new Date(Date.now() + 3 * 60 * 60_000).toISOString();
    const payload = { venueId: selfServeVenueId, layoutId: selfServeLayoutId, paymentId: selfServePaymentId, title: "Luci in Piazza", description: "Evento civico sincronizzato", program: [{ at: startsAt, title: "Accensione" }], locationName: "Piazza del Faro", kind: "civic", startsAt, endsAt, latitude: 45.475, longitude: 9.125, discoveryRadiusM: 4000, audioAllowed: true, torchAllowed: false, accessPolicy };
    const created = await app.inject({ method: "POST", url: "/v1/events", headers: { authorization: `Bearer ${selfServeToken}` }, payload });
    expect(created.statusCode).toBe(201);
    selfServeEventId = created.json().id;
    expect(created.json()).toMatchObject({ participantLimit: 500, layoutId: selfServeLayoutId });
    const repeated = await app.inject({ method: "POST", url: "/v1/events", headers: { authorization: `Bearer ${selfServeToken}` }, payload: { ...payload, title: "Duplicato" } });
    expect(repeated.statusCode).toBe(402);
    const published = await app.inject({ method: "POST", url: `/v1/events/${selfServeEventId}/timeline`, headers: { authorization: `Bearer ${selfServeToken}` }, payload: { cues: [{ id: "welcome", atMs: 0, durationMs: 5000, zones: ["*"], color: "#D1E66A" }], assets: [], publish: true } });
    expect(published.statusCode).toBe(201);
  });

  it("salva un percorso corteo con tappe manuali, programmate e automatiche", async () => {
    const checkout = await app.inject({ method: "POST", url: "/v1/billing/checkout", headers: { authorization: `Bearer ${selfServeToken}` }, payload: { tier: "small", successUrl: "https://onepixel.test/checkout/success", cancelUrl: "https://onepixel.test/checkout/cancel" } });
    const paymentId = checkout.json().paymentId as string;
    await app.inject({ method: "POST", url: "/v1/billing/confirm", headers: { authorization: `Bearer ${selfServeToken}` }, payload: { paymentId, sessionId: checkout.json().providerSessionId } });
    const startsAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const route = { type: "LineString", coordinates: [[9.120, 45.470], [9.125, 45.475], [9.130, 45.480]] };
    const created = await app.inject({ method: "POST", url: "/v1/events", headers: { authorization: `Bearer ${selfServeToken}` }, payload: { venueId: selfServeVenueId, layoutId: selfServeLayoutId, paymentId, title: "Corteo delle Luci", description: "Percorso sincronizzato", program: [], locationName: "Centro città", kind: "parade", startsAt, endsAt: new Date(Date.now() + 4 * 60 * 60_000).toISOString(), latitude: 45.470, longitude: 9.120, discoveryRadiusM: 4000, audioAllowed: true, torchAllowed: true, accessPolicy: { visibility: "public", methods: ["qr", "mobile_radius"], discoveryRadiusM: 4000, mobileRadiusM: 250, route } } });
    expect(created.statusCode).toBe(201);
    paradeEventId = created.json().id;
    const routeStops = [
      { id: "start", label: "Partenza", latitude: 45.470, longitude: 9.120, trigger: "manual", enabled: true, cue: { durationMs: 5000, zones: ["*"], color: "#D1E66A", text: { it: "PARTIAMO", en: "LET'S GO" } } },
      { id: "square", label: "Piazza", latitude: 45.475, longitude: 9.125, trigger: "schedule", offsetMinutes: 15, enabled: true, cue: { durationMs: 4000, zones: ["*"], color: "#77A4A1" } },
      { id: "finish", label: "Arrivo", latitude: 45.480, longitude: 9.130, trigger: "arrival", radiusM: 80, enabled: true, cue: { durationMs: 6000, zones: ["*"], color: "#E2A65A", torch: true } },
    ];
    const saved = await app.inject({ method: "PUT", url: `/v1/events/${paradeEventId}/route`, headers: { authorization: `Bearer ${selfServeToken}` }, payload: { route, routeStops } });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({ eventId: paradeEventId, route, routeStops });
    expect(saved.json()).toMatchObject({ summary: { pending: 3, scheduled: 0, executed: 0, cancelled: 0, missed: 0 } });
    const routePlan = await app.inject({ method: "GET", url: `/v1/events/${paradeEventId}/route`, headers: { authorization: `Bearer ${selfServeToken}` } });
    expect(routePlan.statusCode).toBe(200);
    expect(routePlan.json().routeStops[0]).toMatchObject({ id: "start", operation: { status: "pending", commandId: null } });
    const forbidden = await app.inject({ method: "GET", url: `/v1/events/${paradeEventId}/route`, headers: { authorization: `Bearer ${organizationToken}` } });
    expect(forbidden.statusCode).toBe(403);
    const activated = await app.inject({ method: "POST", url: `/v1/events/${paradeEventId}/route/activate`, headers: { authorization: `Bearer ${selfServeToken}` }, payload: {} });
    expect(activated.statusCode).toBe(200);
    expect(activated.json().routeStops.find((stop: { id: string }) => stop.id === "square")).toMatchObject({ operation: { status: "scheduled", commandId: expect.any(String) } });
    const cancelled = await app.inject({ method: "PATCH", url: `/v1/events/${paradeEventId}/route/stops/square`, headers: { authorization: `Bearer ${selfServeToken}` }, payload: { action: "cancel" } });
    expect(cancelled.json()).toMatchObject({ stopId: "square", operation: { status: "cancelled", commandId: null } });
    const reset = await app.inject({ method: "PATCH", url: `/v1/events/${paradeEventId}/route/stops/square`, headers: { authorization: `Bearer ${selfServeToken}` }, payload: { action: "reset" } });
    expect(reset.json()).toMatchObject({ operation: { status: "pending" } });
    const triggered = await app.inject({ method: "PATCH", url: `/v1/events/${paradeEventId}/route/stops/start`, headers: { authorization: `Bearer ${selfServeToken}` }, payload: { action: "trigger" } });
    expect(triggered.statusCode).toBe(200);
    expect(triggered.json()).toMatchObject({ operation: { status: "executed" }, command: { type: "cue", cue: { id: "route:start" } }, reused: false });
    const triggeredAgain = await app.inject({ method: "PATCH", url: `/v1/events/${paradeEventId}/route/stops/start`, headers: { authorization: `Bearer ${selfServeToken}` }, payload: { action: "trigger" } });
    expect(triggeredAgain.json()).toMatchObject({ operation: { status: "executed" }, reused: true });
    await app.inject({ method: "PATCH", url: `/v1/events/${paradeEventId}/route/stops/start`, headers: { authorization: `Bearer ${selfServeToken}` }, payload: { action: "reset" } });
    const executeAt = new Date(Date.now() + 250).toISOString();
    const scheduledManual = await app.inject({ method: "PATCH", url: `/v1/events/${paradeEventId}/route/stops/start`, headers: { authorization: `Bearer ${selfServeToken}` }, payload: { action: "schedule", executeAt } });
    expect(scheduledManual.json()).toMatchObject({ operation: { status: "scheduled" }, scheduled: true });
    await new Promise((resolve) => setTimeout(resolve, 350));
    const executedPlan = await app.inject({ method: "GET", url: `/v1/events/${paradeEventId}/route`, headers: { authorization: `Bearer ${selfServeToken}` } });
    expect(executedPlan.json().routeStops.find((stop: { id: string }) => stop.id === "start")).toMatchObject({ operation: { status: "executed", triggeredAt: expect.any(String) } });
    const started = await app.inject({ method: "POST", url: `/v1/events/${paradeEventId}/commands`, headers: { authorization: `Bearer ${selfServeToken}` }, payload: { type: "start" } });
    expect(started.statusCode).toBe(202);
    const leader = await app.inject({ method: "PUT", url: `/v1/events/${paradeEventId}/leader/location`, headers: { authorization: `Bearer ${selfServeToken}` }, payload: { latitude: 45.4801, longitude: 9.1301, accuracyM: 5 } });
    expect(leader.statusCode).toBe(200);
    expect(leader.json().activatedStops[0]).toMatchObject({ stopId: "finish", operation: { status: "executed" } });
    const publicRoute = await app.inject({ method: "GET", url: `/v1/public/events/${paradeEventId}/route` });
    expect(publicRoute.statusCode).toBe(200);
    expect(publicRoute.json().routeStops.find((stop: { id: string }) => stop.id === "finish")).toMatchObject({ operation: { status: "executed" } });
    expect(publicRoute.json().routeStops[0].operation).not.toHaveProperty("triggeredBy");
    const listed = await app.inject({ method: "GET", url: "/v1/events", headers: { authorization: `Bearer ${selfServeToken}` } });
    const parade = listed.json().find((event: { id: string }) => event.id === paradeEventId);
    expect(parade.access_policy).toMatchObject({ route, routeStops });
    const invalid = await app.inject({ method: "PUT", url: `/v1/events/${paradeEventId}/route`, headers: { authorization: `Bearer ${selfServeToken}` }, payload: { route, routeStops: [{ ...routeStops[0], latitude: 40 }] } });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({ error: "ROUTE_STOP_OUTSIDE_ROUTE" });
  });

  it("aggancia automaticamente macro-area GPS e raggio mobile del capofila", async () => {
    const fixed = await app.inject({ method: "POST", url: `/v1/public/events/${selfServeEventId}/join/location`, payload: { installationId: "installation-fixed-001", latitude: 45.475, longitude: 9.125 } });
    expect(fixed.statusCode).toBe(200);
    expect(fixed.json().manifest).toMatchObject({ zoneId: "PIAZZA" });
    const leader = await app.inject({ method: "PUT", url: `/v1/events/${selfServeEventId}/leader/location`, headers: { authorization: `Bearer ${selfServeToken}` }, payload: { latitude: 45.49, longitude: 9.14, accuracyM: 8 } });
    expect(leader.statusCode).toBe(200);
    const mobile = await app.inject({ method: "POST", url: `/v1/public/events/${selfServeEventId}/join/location`, payload: { installationId: "installation-mobile-01", latitude: 45.4902, longitude: 9.1402 } });
    expect(mobile.statusCode).toBe(200);
    expect(mobile.json().manifest).toMatchObject({ zoneId: "CORTEO" });
    const outside = await app.inject({ method: "POST", url: `/v1/public/events/${selfServeEventId}/join/location`, payload: { installationId: "installation-outside-1", latitude: 44.0, longitude: 10.0 } });
    expect(outside.statusCode).toBe(403);
  });

  it("gestisce profilo, eventi salvati e notifiche del partecipante", async () => {
    const registration = await app.inject({ method: "POST", url: "/v1/participant/auth/register", payload: { name: "Marta Rossi", email: "marta@onepixel.test", password: "Partecipante!2026" } });
    expect(registration.statusCode).toBe(201);
    participantToken = registration.json().token;
    const profile = await app.inject({ method: "PATCH", url: "/v1/participant/me", headers: { authorization: `Bearer ${participantToken}` }, payload: { name: "Marta R.", avatarUrl: null, locale: "it", theme: "dark" } });
    expect(profile.statusCode).toBe(200);
    const saved = await app.inject({ method: "PUT", url: `/v1/participant/events/${selfServeEventId}/state`, headers: { authorization: `Bearer ${participantToken}` }, payload: { saved: true } });
    expect(saved.json()).toMatchObject({ eventId: selfServeEventId, saved: true });
    const events = await app.inject({ method: "GET", url: "/v1/participant/events", headers: { authorization: `Bearer ${participantToken}` } });
    expect(events.json()[0]).toMatchObject({ id: selfServeEventId, saved: true });

    await app.inject({ method: "PUT", url: "/v1/public/installations", payload: { installationId: "installation-notify-01", locale: "it", notificationsEnabled: true, locationEnabled: true } });
    const nearby = await app.inject({ method: "POST", url: "/v1/public/installations/installation-notify-01/nearby", payload: { latitude: 45.4781, longitude: 9.124, radiusM: 2000 } });
    expect(nearby.statusCode).toBe(200);
    expect(nearby.json().notificationsCreated).toBeGreaterThan(0);
    const notifications = await app.inject({ method: "GET", url: "/v1/public/installations/installation-notify-01/notifications" });
    expect(notifications.json()[0]).toMatchObject({ kind: "nearby_event" });
  });

  it("genera QR in lotto e aggiorna la capienza con un secondo pagamento", async () => {
    const bulk = await app.inject({ method: "POST", url: `/v1/events/${selfServeEventId}/qr/bulk`, headers: { authorization: `Bearer ${selfServeToken}` }, payload: { includeSeats: false } });
    expect(bulk.statusCode).toBe(201);
    expect(bulk.json().count).toBeGreaterThan(0);
    const checkout = await app.inject({ method: "POST", url: "/v1/billing/checkout", headers: { authorization: `Bearer ${selfServeToken}` }, payload: { tier: "medium", successUrl: "https://onepixel.test/events/upgrade", cancelUrl: "https://onepixel.test/events" } });
    const upgraded = await app.inject({ method: "POST", url: `/v1/events/${selfServeEventId}/upgrade`, headers: { authorization: `Bearer ${selfServeToken}` }, payload: { paymentId: checkout.json().paymentId } });
    expect(upgraded.statusCode).toBe(200);
    expect(upgraded.json()).toMatchObject({ participantLimit: 5000, upgraded: true });
  });

  it("trova l'evento soltanto nelle vicinanze", async () => {
    const near = await app.inject({ method: "GET", url: "/v1/public/events/nearby?lat=45.4781&lng=9.1240&radiusM=1000" });
    const far = await app.inject({ method: "GET", url: "/v1/public/events/nearby?lat=41.9028&lng=12.4964&radiusM=1000" });
    expect(near.statusCode).toBe(200);
    expect(near.json()[0]).toMatchObject({ id: demoIds.event, title: "Finale Luce", distanceM: 0 });
    expect(far.json()).toEqual([]);
  });

  it("emette un QR firmato e restituisce un pacchetto offline verificabile", async () => {
    const issued = await app.inject({ method: "POST", url: `/v1/events/${demoIds.event}/qr`, headers: { authorization: `Bearer ${organizationToken}` }, payload: { zoneId: "N1", seatId: "18-42" } });
    expect(issued.statusCode).toBe(201);
    qrToken = issued.json().token;
    const resolved = await app.inject({ method: "POST", url: "/v1/public/qr/resolve", payload: { token: qrToken } });
    expect(resolved.statusCode).toBe(200);
    qrSessionId = resolved.json().sessionId;
    expect(resolved.json().manifest).toMatchObject({ protocolVersion: 1, eventId: demoIds.event, zoneId: "N1", seatId: "18-42", audioAllowed: true, torchAllowed: true, version: 1, brand: { organizationName: "Arena Nord", primary: "#D1E66A" } });
    expect(resolved.json().manifest.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(resolved.json().manifest.cues.length).toBeGreaterThan(0);
  });

  it("fa prevalere il QR sul GPS e mantiene bloccati settore e posto", async () => {
    const installationId = "installation-qr-precedence-01";
    const gps = await app.inject({ method: "POST", url: `/v1/public/events/${demoIds.event}/join/location`, payload: { installationId, latitude: 45.4781, longitude: 9.124 } });
    expect(gps.statusCode).toBe(200);
    expect(gps.json().manifest).toMatchObject({ zoneId: "NORD" });

    const exact = await app.inject({ method: "POST", url: "/v1/public/qr/resolve", payload: { token: qrToken, installationId } });
    expect(exact.statusCode).toBe(200);
    expect(exact.json().manifest).toMatchObject({ zoneId: "N1", seatId: "18-42" });

    const gpsAgain = await app.inject({ method: "POST", url: `/v1/public/events/${demoIds.event}/join/location`, payload: { installationId, latitude: 45.477, longitude: 9.124 } });
    expect(gpsAgain.statusCode).toBe(200);
    expect(gpsAgain.json().manifest).toMatchObject({ zoneId: "N1", seatId: "18-42" });

    const update = await app.inject({ method: "POST", url: `/v1/public/events/${demoIds.event}/join/location/update`, payload: { joinToken: gpsAgain.json().joinToken, latitude: 45.477, longitude: 9.124 } });
    expect(update.statusCode).toBe(200);
    expect(update.json()).toMatchObject({ zoneId: "N1", seatId: "18-42", lockedByQr: true, changed: false });
  });

  it("rifiuta QR manomessi", async () => {
    const [body, signature] = qrToken.split(".");
    const tampered = `${body}.${signature.startsWith("a") ? "b" : "a"}${signature.slice(1)}`;
    const response = await app.inject({ method: "POST", url: "/v1/public/qr/resolve", payload: { token: tampered } });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "QR_INVALID" });
  });

  it("applica i limiti di licenza prima di creare una struttura", async () => {
    const response = await app.inject({ method: "POST", url: "/v1/venues", headers: { authorization: `Bearer ${organizationToken}` }, payload: { name: "Troppo grande", kind: "stadium", capacity: 65001 } });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "LICENSE_CAPACITY_EXCEEDED" });
  });

  it("salva le modifiche della mappa 2D sulla struttura esistente", async () => {
    const venues = await app.inject({ method: "GET", url: "/v1/venues", headers: { authorization: `Bearer ${organizationToken}` } });
    const venue = venues.json().find((item: { id: string }) => item.id === demoIds.venue);
    const map = typeof venue.map === "string" ? JSON.parse(venue.map) : venue.map;
    map.elements[0].polygon[0].x = 7;
    const response = await app.inject({ method: "PUT", url: `/v1/venues/${demoIds.venue}`, headers: { authorization: `Bearer ${organizationToken}` }, payload: { name: venue.name, kind: venue.kind, capacity: venue.capacity, map } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: demoIds.venue, saved: true });
    expect(response.json().map.elements[0].polygon[0].x).toBe(7);
  });

  it("sincronizza websocket, presenza e comando live numerato", async () => {
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server address");
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/v1/realtime/${demoIds.event}?token=${encodeURIComponent(qrToken)}`);
    const syncMessage = waitForMessage(socket, "sync");
    await new Promise<void>((resolve, reject) => { socket.once("open", () => resolve()); socket.once("error", reject); });
    const sync = await syncMessage;
    expect(sync).toMatchObject({ protocolVersion: 1, eventId: demoIds.event });

    const heartbeatAck = waitForMessage(socket, "heartbeat_ack");
    socket.send(JSON.stringify({ type: "heartbeat", sessionId: qrSessionId, zoneId: "N1", packageVersion: 1, clockOffsetMs: 23, ready: true }));
    await heartbeatAck;

    const liveMessage = waitForMessage(socket, "command");
    const commandResponse = await app.inject({ method: "POST", url: `/v1/events/${demoIds.event}/commands`, headers: { authorization: `Bearer ${organizationToken}` }, payload: { type: "start" } });
    expect(commandResponse.statusCode).toBe(202);
    expect(commandResponse.json()).toMatchObject({ delivered: 1, command: { sequence: 1, type: "start" } });
    expect(await liveMessage).toMatchObject({ command: { eventId: demoIds.event, sequence: 1, type: "start" } });

    const scheduledMessage = waitForMessage(socket, "command");
    const scheduledAt = Date.now() + 250;
    const scheduledResponse = await app.inject({ method: "POST", url: `/v1/events/${demoIds.event}/commands`, headers: { authorization: `Bearer ${organizationToken}` }, payload: { type: "cue", executeAt: new Date(scheduledAt).toISOString(), cue: { id: "scheduled-route-stop", atMs: 0, durationMs: 1200, zones: ["*"], color: "#D1E66A" } } });
    expect(scheduledResponse.statusCode).toBe(202);
    expect(scheduledResponse.json()).toMatchObject({ delivered: 0, scheduled: true, command: { sequence: 2, type: "cue" } });
    const scheduled = await scheduledMessage;
    expect(Date.now()).toBeGreaterThanOrEqual(scheduledAt - 50);
    expect(scheduled).toMatchObject({ command: { sequence: 2, type: "cue", cue: { id: "scheduled-route-stop" } } });

    const presence = await app.inject({ method: "GET", url: `/v1/events/${demoIds.event}/presence`, headers: { authorization: `Bearer ${organizationToken}` } });
    expect(presence.statusCode).toBe(200);
    expect(presence.json()).toMatchObject({ connected: 1, ready: 1, websocketConnections: 1, zones: [{ zone_id: "N1", connected: 1, ready: 1 }] });
    socket.close();
    await new Promise<void>((resolve) => socket.once("close", () => resolve()));
  });

  it("limita i tentativi ripetuti di login", async () => {
    const responses = [];
    for (let index = 0; index < 12; index += 1) {
      responses.push(await app.inject({ method: "POST", url: "/v1/auth/login", remoteAddress: "203.0.113.7", payload: { email: `wrong-${index}@example.test`, password: "not-the-password" } }));
    }
    expect(responses.some((response) => response.statusCode === 429)).toBe(true);
  });
});
