import { mkdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { get, put } from "@vercel/blob";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

type DatabaseQueryResult<T> = { rows: T[]; affectedRows?: number };

export type DatabaseTransaction = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<DatabaseQueryResult<T>>;
};

export type Database = DatabaseTransaction & {
  exec(sql: string): Promise<unknown>;
  transaction<T>(callback: (transaction: DatabaseTransaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

const databaseSnapshotPath = "onepixel/database.tgz";
const migrationFiles = [
  new URL("./migrations/001_initial.sql", import.meta.url),
  new URL("./migrations/002_platform_expansion.sql", import.meta.url),
  new URL("./migrations/003_operational_completion.sql", import.meta.url),
  new URL("./migrations/004_user_login_tracking.sql", import.meta.url),
  new URL("./migrations/005_parade_route_operations.sql", import.meta.url),
];

async function applyMigrations(database: Database): Promise<void> {
  for (const migrationFile of migrationFiles) {
    const migration = await readFile(migrationFile, "utf8");
    await database.exec(migration);
  }
}

export async function openDatabase(dataDir = "memory://onepixel"): Promise<Database> {
  if (!dataDir.startsWith("memory://")) await mkdir(dataDir, { recursive: true });
  const database = await PGlite.create(dataDir);
  await applyMigrations(database as Database);
  return database as Database;
}

export async function openBlobDatabase(pathname = databaseSnapshotPath): Promise<{
  database: Database;
  persist: () => Promise<void>;
}> {
  const snapshot = await get(pathname, { access: "private", useCache: false });
  const loadDataDir = snapshot?.statusCode === 200
    ? new Blob([await new Response(snapshot.stream).arrayBuffer()], { type: snapshot.blob.contentType })
    : undefined;
  const pglite = await PGlite.create({ dataDir: "memory://onepixel", loadDataDir });
  const database = pglite as Database;
  await applyMigrations(database);

  let queue: Promise<void> = Promise.resolve();
  const save = async () => {
    const dump = await pglite.dumpDataDir("gzip");
    await put(pathname, dump, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      contentType: "application/gzip",
    });
  };

  return {
    database,
    persist: () => {
      const operation = queue.then(save, save);
      queue = operation.catch(() => undefined);
      return operation;
    },
  };
}

class PostgresTransaction implements DatabaseTransaction {
  constructor(private readonly client: PoolClient) {}

  async query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<DatabaseQueryResult<T>> {
    const result = await this.client.query<T & QueryResultRow>(sql, params);
    return { rows: result.rows as T[], affectedRows: result.rowCount ?? undefined };
  }
}

class PostgresDatabase implements Database {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 15_000 });
  }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<DatabaseQueryResult<T>> {
    const result = await this.pool.query<T & QueryResultRow>(sql, params);
    return { rows: result.rows as T[], affectedRows: result.rowCount ?? undefined };
  }

  async exec(sql: string): Promise<unknown> {
    return this.pool.query(sql);
  }

  async transaction<T>(callback: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(new PostgresTransaction(client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export async function openPostgresDatabase(connectionString: string): Promise<Database> {
  const database = new PostgresDatabase(connectionString);
  await applyMigrations(database);
  return database;
}

export async function one<T extends Record<string, unknown>>(
  database: Database,
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  const result = await database.query<T>(sql, params);
  return result.rows[0];
}

export async function many<T extends Record<string, unknown>>(
  database: Database,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await database.query<T>(sql, params);
  return result.rows;
}
