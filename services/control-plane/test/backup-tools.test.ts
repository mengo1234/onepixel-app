import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createBackup, restoreBackup } from "../src/backup-tools.js";
import { openDatabase } from "../src/database.js";

const roots: string[] = [];

afterAll(async () => {
  // Test directories intentionally remain in the OS temp area for post-test inspection.
});

describe("backup and disaster recovery", () => {
  it("restores database rows and media with checksum verification", async () => {
    const root = await mkdtemp(resolve(tmpdir(), "onepixel-recovery-"));
    roots.push(root);
    const sourceDatabase = resolve(root, "source-db");
    const sourceStorage = resolve(root, "source-storage");
    const backup = resolve(root, "backup");
    const restoredDatabase = resolve(root, "restored-db");
    const restoredStorage = resolve(root, "restored-storage");
    const database = await openDatabase(sourceDatabase);
    await database.query("INSERT INTO organizations (id, slug, name, status, brand) VALUES ('org_recovery', 'recovery', 'Recovery proof', 'active', '{}')");
    await database.close();
    await mkdir(resolve(sourceStorage, "event-proof"), { recursive: true });
    await writeFile(resolve(sourceStorage, "event-proof", "cue.png"), "onePixel media proof");

    const manifest = await createBackup({ databaseDir: sourceDatabase, storageDir: sourceStorage, outputDir: backup });
    expect(manifest.database.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.storage.files).toBe(1);
    await restoreBackup({ backupDir: backup, databaseDir: restoredDatabase, storageDir: restoredStorage });

    const restored = await openDatabase(restoredDatabase);
    const rows = await restored.query<{ name: string }>("SELECT name FROM organizations WHERE id = 'org_recovery'");
    await restored.close();
    expect(rows.rows).toEqual([{ name: "Recovery proof" }]);
    expect(await readFile(resolve(restoredStorage, "event-proof", "cue.png"), "utf8")).toBe("onePixel media proof");
  }, 30_000);
});
