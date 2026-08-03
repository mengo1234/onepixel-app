import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { controlPlaneUrl, sessionCookie } from "@/lib/control-plane";

type Context = { params: Promise<{ path: string[] }> };

async function proxy(request: Request, context: Context) {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const { path } = await context.params;
  const incoming = new URL(request.url);
  const target = new URL(controlPlaneUrl(path.join("/")));
  target.search = incoming.search;
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  const response = await fetch(target, {
    method: request.method,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    body,
    cache: "no-store",
  }).catch(() => null);
  if (!response) return NextResponse.json({ error: "CONTROL_PLANE_OFFLINE" }, { status: 503 });
  return new NextResponse(response.body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
