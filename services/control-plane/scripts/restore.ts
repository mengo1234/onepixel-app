import { resolve } from "node:path";
import { restoreBackup } from "../src/backup-tools.js";

const [backup, database, storage] = process.argv.slice(2);
if (!backup || !database || !storage) throw new Error("Usage: npm run restore -- /backup/directory /empty/database/directory /empty/storage/directory");
const manifest = await restoreBackup({ backupDir: resolve(backup), databaseDir: resolve(database), storageDir: resolve(storage) });
process.stdout.write(`Restored backup created at ${manifest.createdAt}\n`);
