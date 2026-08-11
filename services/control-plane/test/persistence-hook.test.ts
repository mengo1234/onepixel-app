import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/application.js";
import { openDatabase } from "../src/database.js";

describe("database persistence hook", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()?.();
  });

  it("persists successful mutations but ignores reads and rejected writes", async () => {
    const database = await openDatabase();
    const persistDatabase = vi.fn(async () => undefined);
    const app = await createApp({
      database,
      secret: "onepixel-test-secret-that-is-long-enough-2026",
      seed: true,
      persistDatabase,
    });
    cleanups.push(async () => {
      await app.close();
      await database.close();
    });

    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(persistDatabase).not.toHaveBeenCalled();

    const rejected = await app.inject({ method: "POST", url: "/v1/auth/login", payload: {} });
    expect(rejected.statusCode).toBe(400);
    expect(persistDatabase).not.toHaveBeenCalled();

    const login = await app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "regia@arenanord.it", password: "Arena!2026" },
    });
    expect(login.statusCode).toBe(200);
    expect(persistDatabase).toHaveBeenCalledTimes(1);
  });
});
