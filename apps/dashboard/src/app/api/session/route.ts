import { NextResponse } from "next/server";
import { controlPlaneUrl, emailCookie, roleCookie, sessionCookie } from "@/lib/control-plane";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const isNativeForm = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");
  let body: string;
  try {
    if (isNativeForm) {
      const form = await request.formData();
      body = JSON.stringify({ email: form.get("email"), password: form.get("password") });
    } else {
      body = await request.text();
    }
  } catch {
    return isNativeForm
      ? NextResponse.redirect(new URL("/login?error=invalid_request", request.url), 303)
      : NextResponse.json({ error: "INVALID_REQUEST", message: "Richiesta di accesso non valida" }, { status: 400 });
  }

  const response = await fetch(controlPlaneUrl("/v1/auth/login"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);

  if (!response) return isNativeForm
    ? NextResponse.redirect(new URL("/login?error=offline", request.url), 303)
    : NextResponse.json({ error: "CONTROL_PLANE_OFFLINE", message: "Backend onePixel non raggiungibile" }, { status: 503 });
  const payload = await response.json();
  if (!response.ok) return isNativeForm
    ? NextResponse.redirect(new URL("/login?error=invalid_credentials", request.url), 303)
    : NextResponse.json(payload, { status: response.status });

  const expires = new Date(payload.expiresAt as string);
  const secureCookies = process.env.NODE_ENV === "production" && process.env.ONEPIXEL_COOKIE_SECURE !== "false";
  const result = isNativeForm
    ? NextResponse.redirect(new URL(payload.user.role === "super_admin" ? "/admin/organizations" : "/checkout", request.url), 303)
    : NextResponse.json({ user: payload.user, expiresAt: payload.expiresAt });
  result.cookies.set(sessionCookie, payload.token as string, {
    httpOnly: true,
    sameSite: "strict",
    secure: secureCookies,
    path: "/",
    expires,
    priority: "high",
  });
  const displayCookie = { httpOnly: true, sameSite: "strict" as const, secure: secureCookies, path: "/", expires, priority: "high" as const };
  result.cookies.set(roleCookie, payload.user.role as string, displayCookie);
  result.cookies.set(emailCookie, payload.user.email as string, displayCookie);
  return result;
}

export async function DELETE() {
  const response = NextResponse.json({ signedOut: true });
  response.cookies.delete(sessionCookie);
  response.cookies.delete(roleCookie);
  response.cookies.delete(emailCookie);
  return response;
}
