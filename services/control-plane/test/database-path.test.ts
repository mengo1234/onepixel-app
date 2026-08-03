import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../src/database.js";

describe("database path", () => {
  it("crea ricorsivamente una nuova directory persistente", async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), "onepixel-database-"));
    const database = await openDatabase(join(temporaryRoot, "nested", "database"));
    try {
      const result = await database.query<{ value: number }>("SELECT 1 AS value");
      expect(result.rows).toEqual([{ value: 1 }]);
    } finally {
      await database.close();
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }, 30_000);
});
