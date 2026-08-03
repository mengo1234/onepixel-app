import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { extname } from "node:path";
import type { TimelineCue } from "../../../packages/protocol/src/index.js";

const require = createRequire(import.meta.url);
const ffmpegStatic = require("ffmpeg-static") as string | null;

type CompileOptions = {
  inputPath: string;
  zones: string[];
  fps?: number;
  maxDurationSeconds?: number;
};

export type CompiledMedia = {
  width: number;
  height: number;
  frameCount: number;
  durationMs: number;
  cues: TimelineCue[];
};

function runFfmpeg(args: string[], maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ffmpegPath = process.env.ONEPIXEL_FFMPEG_PATH?.trim() || ffmpegStatic || "ffmpeg";
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    let bytes = 0;
    let outputTooLarge = false;
    child.stdout.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        outputTooLarge = true;
        child.kill("SIGKILL");
      }
      else output.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (errors.reduce((total, value) => total + value.length, 0) < 64_000) errors.push(chunk);
    });
    child.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new Error(`FFMPEG_NOT_AVAILABLE: installa ffmpeg o configura ONEPIXEL_FFMPEG_PATH (percorso tentato: ${ffmpegPath})`));
        return;
      }
      reject(error);
    });
    child.once("close", (code, signal) => {
      if (outputTooLarge) {
        reject(new Error("MEDIA_OUTPUT_TOO_LARGE: riduci durata, risoluzione o frame rate"));
        return;
      }
      if (code === 0) resolve(Buffer.concat(output));
      else reject(new Error(`FFMPEG_FAILED (${signal ?? code}): ${Buffer.concat(errors).toString("utf8").slice(-1200)}`));
    });
  });
}

function hex(red: number, green: number, blue: number): `#${string}` {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export async function compileMedia(options: CompileOptions): Promise<CompiledMedia> {
  if (options.zones.length === 0) throw new Error("VENUE_HAS_NO_SECTORS");
  const fps = Math.max(1, Math.min(10, options.fps ?? 5));
  const maxDurationSeconds = Math.max(1, Math.min(45, options.maxDurationSeconds ?? 45));
  const width = Math.ceil(Math.sqrt(options.zones.length));
  const height = Math.ceil(options.zones.length / width);
  const frameBytes = width * height * 3;
  const maximumBytes = frameBytes * fps * maxDurationSeconds + frameBytes;
  const stillImage = [".png", ".jpg", ".jpeg"].includes(extname(options.inputPath).toLowerCase());
  const buffer = await runFfmpeg([
    "-hide_banner", "-loglevel", "error", ...(stillImage ? ["-loop", "1"] : []), "-i", options.inputPath,
    "-t", `${maxDurationSeconds}`, "-vf", `fps=${fps},scale=${width}:${height}:flags=area`,
    "-an", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1",
  ], maximumBytes);
  const frameCount = Math.floor(buffer.length / frameBytes);
  if (frameCount === 0) throw new Error("MEDIA_HAS_NO_FRAMES");
  const frameDuration = Math.round(1000 / fps);
  const cues: TimelineCue[] = [];

  for (let zoneIndex = 0; zoneIndex < options.zones.length; zoneIndex += 1) {
    let previous: TimelineCue | undefined;
    for (let frame = 0; frame < frameCount; frame += 1) {
      const offset = frame * frameBytes + zoneIndex * 3;
      const color = hex(buffer[offset], buffer[offset + 1], buffer[offset + 2]);
      if (previous?.color === color && previous.atMs + previous.durationMs === frame * frameDuration) {
        previous.durationMs += frameDuration;
        continue;
      }
      previous = { id: `media-${zoneIndex}-${frame}`, atMs: frame * frameDuration, durationMs: frameDuration, zones: [options.zones[zoneIndex]], color };
      cues.push(previous);
    }
  }

  cues.sort((left, right) => left.atMs - right.atMs || left.zones[0].localeCompare(right.zones[0]));
  return { width, height, frameCount, durationMs: frameCount * frameDuration, cues };
}
