import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const sessionCookie = "onepixel_session";
export const roleCookie = "onepixel_role";
export const emailCookie = "onepixel_email";

export function controlPlaneUrl(path: string): string {
  const base = process.env.ONEPIXEL_API_URL ?? "http://127.0.0.1:4100";
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

export async function controlPlaneGet<T>(path: string): Promise<T> {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) redirect("/login");
  const response = await fetch(controlPlaneUrl(path), {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`CONTROL_PLANE_${response.status}`);
  return response.json() as Promise<T>;
}

export async function controlPlanePost<T>(path: string, body: unknown): Promise<T> {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) redirect("/login");
  const response = await fetch(controlPlaneUrl(path), {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`CONTROL_PLANE_${response.status}`);
  return response.json() as Promise<T>;
}
