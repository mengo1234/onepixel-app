import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

export type BackupManifest = {
  format: 1;
  createdAt: string;
  database: { file: string; sha256: string; bytes: number };
  storage: { directory: string; files: number };
};

function digest(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

async function assertEmptyOrMissing(path: string): Promise<void> {
  const details = await stat(path).catch(() => null);
  if (!details) return;
  if (!details.isDirectory()) throw new Error(`Restore target is not a directory: ${path}`);
  if ((await readdir(path)).length > 0) throw new Error(`Restore target must be empty: ${path}`);
}

async function countFiles(path: string): Promise<number> {
  const details = await stat(path).catch(() => null);
  if (!details) return 0;
  if (details.isFile()) return 1;
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => countFiles(resolve(path, entry.name))))).reduce((sum, value) => sum + value, 0);
}

export async function createBackup(options: { databaseDir: string; storageDir: string; outputDir: string }): Promise<BackupManifest> {
  const outputDir = resolve(options.outputDir);
  await assertEmptyOrMissing(outputDir);
  await mkdir(outputDir, { recursive: true, mode: 0o750 });

  const database = await PGlite.create(resolve(options.databaseDir));
  const dump = await database.dumpDataDir("gzip");
  await database.close();
  const bytes = new Uint8Array(await dump.arrayBuffer());
  const databaseFile = "database.tgz";
  await writeFile(resolve(outputDir, databaseFile), bytes, { flag: "wx", mode: 0o640 });

  const storageDirectory = "storage";
  const sourceStorage = resolve(options.storageDir);
  if (await stat(sourceStorage).catch(() => null)) {
    await cp(sourceStorage, resolve(outputDir, storageDirectory), { recursive: true, errorOnExist: true, force: false });
  } else {
    await mkdir(resolve(outputDir, storageDirectory), { mode: 0o750 });
  }

  const manifest: BackupManifest = {
    format: 1,
    createdAt: new Date().toISOString(),
    database: { file: databaseFile, sha256: digest(bytes), bytes: bytes.byteLength },
    storage: { directory: storageDirectory, files: await countFiles(resolve(outputDir, storageDirectory)) },
  };
  await writeFile(resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx", mode: 0o640 });
  return manifest;
}

export async function restoreBackup(options: { backupDir: string; databaseDir: string; storageDir: string }): Promise<BackupManifest> {
  const backupDir = resolve(options.backupDir);
  const manifest = JSON.parse(await readFile(resolve(backupDir, "manifest.json"), "utf8")) as BackupManifest;
  if (manifest.format !== 1) throw new Error(`Unsupported backup format: ${manifest.format}`);
  const databaseDump = await readFile(resolve(backupDir, basename(manifest.database.file)));
  if (databaseDump.byteLength !== manifest.database.bytes || digest(databaseDump) !== manifest.database.sha256) {
    throw new Error("Backup database checksum mismatch");
  }

  const databaseDir = resolve(options.databaseDir);
  const storageDir = resolve(options.storageDir);
  await assertEmptyOrMissing(databaseDir);
  await assertEmptyOrMissing(storageDir);
  await mkdir(databaseDir, { recursive: true, mode: 0o750 });
  const database = await PGlite.create({ dataDir: databaseDir, loadDataDir: new Blob([databaseDump]) });
  await database.close();

  const sourceStorage = resolve(backupDir, basename(manifest.storage.directory));
  await cp(sourceStorage, storageDir, { recursive: true, errorOnExist: false, force: false });
  const restoredFiles = await countFiles(storageDir);
  if (restoredFiles !== manifest.storage.files) throw new Error(`Storage restore mismatch: expected ${manifest.storage.files}, found ${restoredFiles}`);
  return manifest;
}
