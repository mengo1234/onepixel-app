import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export type AccessClaims = {
  purpose: "access";
  sub: string;
  role: "super_admin" | "organization_admin";
  organizationId?: string;
  exp: number;
};

export type QrClaims = {
  purpose: "qr";
  qrId: string;
  eventId: string;
  zoneId: string;
  seatId?: string;
  exp: number;
};

export type ParticipantClaims = {
  purpose: "participant_access";
  sub: string;
  email: string;
  exp: number;
};

export type JoinClaims = {
  purpose: "event_join";
  joinId: string;
  installationId: string;
  eventId: string;
  zoneId: string;
  seatId?: string;
  method: "qr" | "fixed_geofence" | "mobile_radius";
  exp: number;
};

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${base64Url(salt)}:${base64Url(key)}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, saltValue, keyValue] = encoded.split(":");
  if (algorithm !== "scrypt" || !saltValue || !keyValue) return false;
  const expected = Buffer.from(keyValue, "base64url");
  const actual = (await scrypt(password, Buffer.from(saltValue, "base64url"), expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type SignedClaims = AccessClaims | QrClaims | ParticipantClaims | JoinClaims;

export function signPayload<T extends SignedClaims>(payload: T, secret: string): string {
  const body = base64Url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyPayload<T extends SignedClaims>(token: string, secret: string): T {
  const [body, signature] = token.split(".");
  if (!body || !signature) throw new Error("TOKEN_INVALID");
  const expected = createHmac("sha256", secret).update(body).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("TOKEN_INVALID");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) throw new Error("TOKEN_EXPIRED");
  return payload;
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}
