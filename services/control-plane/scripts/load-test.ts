import { randomUUID } from "node:crypto";
import WebSocket from "ws";

const apiUrl = (process.env.ONEPIXEL_LOAD_API ?? "http://127.0.0.1:4100").replace(/\/$/, "");
const connections = Number(process.env.ONEPIXEL_LOAD_CONNECTIONS ?? 250);
const eventId = process.env.ONEPIXEL_LOAD_EVENT ?? "event_finale_luce";

async function jsonRequest(path: string, init?: RequestInit): Promise<any> {
  const response = await fetch(`${apiUrl}${path}`, init);
  const payload = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

const login = await jsonRequest("/v1/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "regia@arenanord.it", password: "Arena!2026" }) });
const qr = await jsonRequest(`/v1/events/${eventId}/qr`, { method: "POST", headers: { authorization: `Bearer ${login.token}`, "content-type": "application/json" }, body: JSON.stringify({ zoneId: "N1" }) });
const wsBase = apiUrl.replace(/^http/, "ws");
const sockets: WebSocket[] = [];
const receivedAt: number[] = [];

await Promise.all(Array.from({ length: connections }, (_, index) => new Promise<void>((resolve, reject) => {
  const socket = new WebSocket(`${wsBase}/v1/realtime/${eventId}?token=${encodeURIComponent(qr.token)}`);
  sockets.push(socket);
  const timeout = setTimeout(() => reject(new Error(`connection ${index} timed out`)), 10_000);
  socket.once("error", reject);
  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    if (message.type === "sync") {
      socket.send(JSON.stringify({ type: "heartbeat", sessionId: randomUUID(), zoneId: "N1", packageVersion: 1, clockOffsetMs: index % 31, ready: true }));
    }
    if (message.type === "heartbeat_ack") {
      clearTimeout(timeout);
      resolve();
    }
    if (message.type === "command") receivedAt.push(performance.now());
  });
})));

const sentAt = performance.now();
const command = await jsonRequest(`/v1/events/${eventId}/commands`, { method: "POST", headers: { authorization: `Bearer ${login.token}`, "content-type": "application/json" }, body: JSON.stringify({ type: "cue", cue: { id: `load-${Date.now()}`, atMs: 0, durationMs: 500, zones: ["*"], color: "#D1E66A" } }) });

const deadline = Date.now() + 10_000;
while (receivedAt.length < connections && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
const latencies = receivedAt.map((time) => time - sentAt).sort((left, right) => left - right);
const percentile = (fraction: number) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * fraction))] ?? Number.POSITIVE_INFINITY;
const result = { requestedConnections: connections, commandDelivered: command.delivered, received: receivedAt.length, p50Ms: Math.round(percentile(.5) * 10) / 10, p95Ms: Math.round(percentile(.95) * 10) / 10, maxMs: Math.round(percentile(1) * 10) / 10 };
console.log(JSON.stringify(result, null, 2));
for (const socket of sockets) socket.close();
if (receivedAt.length !== connections || command.delivered !== connections || percentile(.95) > 1000) process.exitCode = 1;
