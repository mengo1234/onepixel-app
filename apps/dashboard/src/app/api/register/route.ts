import { NextResponse } from "next/server";
import { controlPlaneUrl, emailCookie, roleCookie, sessionCookie } from "@/lib/control-plane";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isNativeForm = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
  let body: string;
  try {
    if (isNativeForm) {
      const form = await request.formData();
      body = JSON.stringify({ name: form.get("name"), organizationName: form.get("organizationName"), email: form.get("email"), password: form.get("password") });
    } else {
      body = await request.text();
    }
  } catch {
    return isNativeForm
      ? NextResponse.redirect(new URL("/register?error=invalid_request", request.url), 303)
      : NextResponse.json({ error: "INVALID_REQUEST", message: "Richiesta di registrazione non valida" }, { status: 400 });
  }

  const response = await fetch(controlPlaneUrl("/v1/auth/register"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response) return isNativeForm
    ? NextResponse.redirect(new URL("/register?error=offline", request.url), 303)
    : NextResponse.json({ error: "CONTROL_PLANE_OFFLINE", message: "Backend onePixel non raggiungibile" }, { status: 503 });
  const payload = await response.json();
  if (!response.ok) return isNativeForm
    ? NextResponse.redirect(new URL("/register?error=registration_failed", request.url), 303)
    : NextResponse.json(payload, { status: response.status });
  const expires = new Date(payload.expiresAt as string);
  const secure = process.env.NODE_ENV === "production" && process.env.ONEPIXEL_COOKIE_SECURE !== "false";
  const options = { httpOnly: true, sameSite: "strict" as const, secure, path: "/", expires, priority: "high" as const };
  const result = isNativeForm
    ? NextResponse.redirect(new URL("/checkout", request.url), 303)
    : NextResponse.json({ user: payload.user, organization: payload.organization, expiresAt: payload.expiresAt });
  result.cookies.set(sessionCookie, payload.token as string, options);
  result.cookies.set(roleCookie, payload.user.role as string, options);
  result.cookies.set(emailCookie, payload.user.email as string, options);
  return result;
}
