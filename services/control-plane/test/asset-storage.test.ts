import { readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp, type AssetStore } from "../src/application.js";
import { openDatabase, type Database } from "../src/database.js";
import { demoIds } from "../src/seed.js";

const secret = "onepixel-asset-storage-test-secret-2026";
const objects = new Map<string, { body: Buffer; contentType: string }>();
const assetStore: AssetStore = {
  async put(pathname, body, contentType) {
    objects.set(pathname, { body: Buffer.from(body), contentType });
  },
  async get(pathname) {
    const object = objects.get(pathname);
    return object ? { stream: Readable.from(object.body), contentType: object.contentType, size: object.body.byteLength } : null;
  },
};

function multipart(filename: string, contentType: string, body: Buffer) {
  const boundary = `onepixel-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`),
      body,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  };
}

let database: Database;
let app: Awaited<ReturnType<typeof createApp>>;
let token = "";

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  database = await openDatabase();
  app = await createApp({ database, secret, seed: true, assetStore });
  const login = await app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: "regia@arenanord.it", password: "Arena!2026" } });
  token = login.json().token;
});

afterAll(async () => {
  await app.close();
  await database.close();
});

describe.sequential("asset storage persistente", () => {
  it("salva e serve una copertina dal blob store senza dipendere dal filesystem locale", async () => {
    const image = await readFile(resolve("../../assets/generated/backgrounds/stadium-pixel-wave-v1.png"));
    const upload = multipart("cover.png", "image/png", image);
    const response = await app.inject({ method: "POST", url: `/v1/events/${demoIds.event}/cover`, headers: { authorization: `Bearer ${token}`, ...upload.headers }, payload: upload.payload });
    expect(response.statusCode).toBe(201);
    const coverUrl = response.json().coverUrl as string;
    const filename = coverUrl.split("/").at(-1)!;
    const stored = objects.get(`onepixel/assets/${demoIds.event}/${filename}`);
    expect(stored?.contentType).toBe("image/png");
    expect(stored?.body.equals(image)).toBe(true);
    await expect(stat(resolve(tmpdir(), "onepixel-assets", demoIds.event, filename))).rejects.toThrow();

    const downloaded = await app.inject({ method: "GET", url: coverUrl });
    expect(downloaded.statusCode).toBe(200);
    expect(downloaded.headers["content-type"]).toContain("image/png");
    expect(downloaded.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(downloaded.rawPayload).toEqual(image);
  }, 30_000);

  it("compila un media da /tmp e persiste il sorgente nel blob store", async () => {
    const image = await readFile(resolve("../../assets/generated/backgrounds/stadium-pixel-wave-v1.png"));
    const upload = multipart("scene.png", "image/png", image);
    const response = await app.inject({ method: "POST", url: `/v1/events/${demoIds.event}/media`, headers: { authorization: `Bearer ${token}`, ...upload.headers }, payload: upload.payload });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ frameCount: expect.any(Number), sourceAsset: { mimeType: "image/png", bytes: image.byteLength } });
    const sourceUrl = response.json().sourceAsset.url as string;
    const filename = sourceUrl.split("/").at(-1)!;
    expect(objects.has(`onepixel/assets/${demoIds.event}/${filename}`)).toBe(true);
    await expect(stat(resolve(tmpdir(), "onepixel-assets", demoIds.event, filename))).rejects.toThrow();
    const downloaded = await app.inject({ method: "GET", url: sourceUrl });
    expect(downloaded.rawPayload).toEqual(image);
  }, 90_000);
});
