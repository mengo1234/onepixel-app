import { resolve } from "node:path";
import "fastify";
import { createApp } from "./application.js";
import { openBlobDatabase, openDatabase, openPostgresDatabase } from "./database.js";

const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 4100);
const dataDirectory = process.env.ONEPIXEL_DATABASE ?? resolve(".data/postgres");
const secret = process.env.ONEPIXEL_QR_SECRET ?? "onepixel-local-development-secret-change-me";
const postgresUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const useBlobDatabase = process.env.ONEPIXEL_DATABASE_BACKEND === "blob" || Boolean(process.env.VERCEL);

const opened = postgresUrl
  ? { database: await openPostgresDatabase(postgresUrl), persist: undefined }
  : useBlobDatabase
  ? await openBlobDatabase(process.env.ONEPIXEL_DATABASE_BLOB_PATH)
  : { database: await openDatabase(dataDirectory), persist: undefined };
const { database } = opened;
const app = await createApp({
  database,
  secret,
  seed: process.env.ONEPIXEL_DEMO_SEED === "true",
  persistDatabase: opened.persist,
});

const shutdown = async () => {
  await app.close();
  await database.close();
  process.exit(0);
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

if (process.env.VERCEL) {
  void app.listen({ host, port });
} else {
  await app.listen({ host, port });
}
