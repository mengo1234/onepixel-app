import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { compileMedia } from "../src/media-compiler.js";

describe("media compiler", () => {
  it("trasforma un'immagine in cue colore per tutti i settori", async () => {
    const zones = Array.from({ length: 12 }, (_, index) => `N${index + 1}`);
    const result = await compileMedia({
      inputPath: resolve("../../assets/generated/backgrounds/stadium-pixel-wave-v1.png"),
      zones,
      fps: 2,
      maxDurationSeconds: 1,
    });
    expect(result.width).toBe(4);
    expect(result.height).toBe(3);
    expect(result.frameCount).toBeGreaterThan(0);
    expect(result.durationMs).toBeLessThanOrEqual(1000);
    expect(new Set(result.cues.flatMap((cue) => cue.zones))).toEqual(new Set(zones));
    expect(result.cues.every((cue) => /^#[0-9A-F]{6}$/.test(cue.color ?? ""))).toBe(true);
  }, 30_000);
});
