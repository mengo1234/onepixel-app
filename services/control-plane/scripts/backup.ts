import { resolve } from "node:path";
import { createBackup } from "../src/backup-tools.js";

const output = process.argv[2];
if (!output) throw new Error("Usage: npm run backup -- /absolute/output/directory (stop the service first)");
const manifest = await createBackup({
  databaseDir: process.env.ONEPIXEL_DATABASE ?? resolve(".data/postgres"),
  storageDir: process.env.ONEPIXEL_STORAGE ?? resolve(".data/storage"),
  outputDir: output,
});
process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
