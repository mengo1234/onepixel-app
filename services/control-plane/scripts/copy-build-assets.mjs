import { copyFile, mkdir, readdir } from "node:fs/promises";

const source = new URL("../src/migrations/", import.meta.url);
const target = new URL("../dist/services/control-plane/src/migrations/", import.meta.url);
await mkdir(target, { recursive: true });
const migrationFiles = (await readdir(source, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
  .map((entry) => entry.name)
  .sort();

if (migrationFiles.length === 0) throw new Error("NO_DATABASE_MIGRATIONS_FOUND");
await Promise.all(migrationFiles.map((name) => copyFile(new URL(name, source), new URL(name, target))));
